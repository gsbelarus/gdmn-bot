import { FileDB } from "./util/fileDB";
import { IAccountLink, Platform, IUpdate, ICustomer, IEmployee } from "./types";
import Telegraf, { Context } from "telegraf";
import { Interpreter, Machine, StateMachine, interpret, assign } from "xstate";
import { botMachineConfig, IBotMachineContext, BotMachineEvent, EnterTextEvent, isEnterTextEvent } from "./machine";
import { getLocString, StringResource } from "./stringResources";
import path from 'path';
import { testNormalizeStr, testIdentStr } from "./util/utils";

const reply = (s: StringResource) => (_: any, { update }: BotMachineEvent) => update?.reply?.(getLocString(s));

// TODO: У нас сейчас серверная часть, которая отвечает за загрузку данных не связана с ботом
//       надо предусмотреть обновление или просто сброс данных после загрузки на сервер
//       из Гедымина.

export class Bot {
  private _telegramAccountLink: FileDB<IAccountLink>;
  private _viberAccountLink: FileDB<IAccountLink>;
  private _customers: FileDB<Omit<ICustomer, 'id'>>;
  private _telegram: Telegraf<Context>;
  private _service: { [id: string]: Interpreter<IBotMachineContext, any, BotMachineEvent> } = {};
  private _machine: StateMachine<IBotMachineContext, any, BotMachineEvent>;
  private _employees: { [companyId: string]: FileDB<Omit<IEmployee, 'id'>> } = {};

  constructor(telegramToken: string, telegramRoot: string, viberRoot: string) {
    this._telegramAccountLink = new FileDB<IAccountLink>(path.resolve(telegramRoot, '/accountlink.json'));
    this._viberAccountLink = new FileDB<IAccountLink>(path.resolve(viberRoot, '/accountlink.json'));
    this._customers = new FileDB<Omit<ICustomer, 'id'>>(path.resolve(process.cwd(), 'data/customers.json'));

    this._machine = Machine<IBotMachineContext, BotMachineEvent>(botMachineConfig,
      {
        actions: {
          askCompanyName: reply('askCompanyName'),
          unknownCompanyName: reply('unknownCompanyName'),
          assignCompanyId: assign<IBotMachineContext, BotMachineEvent>({ companyId: this._findCompany }),
          assignEmployeeId: assign<IBotMachineContext, BotMachineEvent>({ employeeId: this._findEmployee }),
          askPersonalNumber: reply('askPersonalNumber'),
          showMainMenu: reply('test'),
        },
        guards: {
          findCompany: (ctx, event) => !!this._findCompany(ctx, event),
          findEmployee: (ctx, event) => !!this._findEmployee(ctx, event),
        }
      }
    );

    this._telegram = new Telegraf(telegramToken);

    this._telegram.use((ctx, next) => {
      console.log(`Chat ${ctx.chat?.id}: ${ctx.updateType} ${ctx.message?.text !== undefined ? ('-- ' + ctx.message?.text) : ''}`);
      return next?.();
    });

    this._telegram.start(
      ctx => {
        if (!ctx.chat) {
          console.error('Invalid chat context');
        } else {
          this.onUpdate({
            platform: 'TELEGRAM',
            chatId: ctx.chat.id.toString(),
            type: 'COMMAND',
            body: '/start',
            reply: ctx.reply
          });
        }
      }
    );

    this._telegram.on('message',
      ctx => {
        if (!ctx.chat) {
          console.error('Invalid chat context');
        }
        else if (ctx.message?.text === undefined) {
          console.error('Invalid chat message');
        } else {
          this.onUpdate({
            platform: 'TELEGRAM',
            chatId: ctx.chat.id.toString(),
            type: 'MESSAGE',
            body: ctx.message.text,
            reply: ctx.reply
          });
        }
      }
    );
  }

  private _findCompany = (_: any, event: BotMachineEvent) => {
    if (isEnterTextEvent(event)) {
      const customers = this._customers.getMutable(false);
      for (const [companyId, { aliases }] of Object.entries(customers)) {
        if (aliases.find( alias => testNormalizeStr(alias, event.text) )) {
          return companyId;
        }
      }
    }
    return undefined;
  }

  private _findEmployee = ({ companyId }: IBotMachineContext, event: BotMachineEvent) => {
    if (isEnterTextEvent(event) && companyId) {
      let employees = this._employees[companyId];

      if (!employees) {
        const db = new FileDB<Omit<IEmployee, 'id'>>(path.resolve(process.cwd(), `data/payslip/${companyId}/employee.json`));
        if (!db.isEmpty()) {
          employees = db;
          this._employees[companyId] = db;
        }
      }

      if (employees) {
        for (const [employeeId, { passportId }] of Object.entries(employees.getMutable(false))) {
          if (testIdentStr(passportId, event.text)) {
            return employeeId;
          }
        }
      }
    }
    return undefined;
  }

  launch() {
    this._telegram.launch();
  }

  getMachineId(platform: Platform, chatId: string) {
    return chatId + (platform === 'TELEGRAM' ? 't' : 'v');
  }

  finalize() {
    this._telegramAccountLink.flush();
    this._viberAccountLink.flush();
  }

  createService(machineId: string) {
    const service = interpret(this._machine)
      .onTransition( (state, event) => console.log(`State: ${state.toStrings().join('->')}, Event: ${event.type}`) )
      .start();
    this._service[machineId] = service;
    return service;
  }

  /**
   * Сюда поступают все события из чатов пользователей: ввод текста,
   * выбор пункта в меню, вызов команды и т.п.
   * @param update IUpdate
   */
  onUpdate(update: IUpdate) {
    const { platform, chatId, type, body } = update;
    const machineId = this.getMachineId(platform, chatId);
    let service = this._service[machineId];
    const accountLinkDB = platform === 'TELEGRAM' ? this._telegramAccountLink : this._viberAccountLink;
    let accountLink = accountLinkDB.read(chatId);

    if (body === '/start' || !service) {
      this.createService(machineId).send({ type: accountLink ? 'MAIN_MENU' : 'START', update });
    } else {
      if (type === 'MESSAGE') {
        service.send({ type: 'ENTER_TEXT', text: body, update });
      }
    }
  }
};