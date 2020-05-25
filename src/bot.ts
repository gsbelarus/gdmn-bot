import { FileDB } from "./util/fileDB";
import { IAccountLink, Platform, IUpdate, ICustomer, IEmployee, IReplyParams } from "./types";
import Telegraf from "telegraf";
import { Context, Markup, Extra } from "telegraf";
import { Interpreter, Machine, StateMachine, interpret, assign } from "xstate";
import { botMachineConfig, IBotMachineContext, BotMachineEvent, isEnterTextEvent, CalendarMachineEvent, ICalendarMachineContext, calendarMachineConfig } from "./machine";
import { getLocString, StringResource } from "./stringResources";
import path from 'path';
import { testNormalizeStr, testIdentStr } from "./util/utils";
import { Menu, keyboardMenu, keyboardCalendar } from "./menu";

// TODO: добавить lang непосредственно в update?
const reply = (s: StringResource, menu?: Menu) =>
  (_: any, { update }: BotMachineEvent) =>
  update?.reply?.({ text: getLocString(s), menu });

// TODO: У нас сейчас серверная часть, которая отвечает за загрузку данных не связана с ботом
//       надо предусмотреть обновление или просто сброс данных после загрузки на сервер
//       из Гедымина.

export class Bot {
  private _telegramAccountLink: FileDB<IAccountLink>;
  private _viberAccountLink: FileDB<IAccountLink>;
  private _customers: FileDB<Omit<ICustomer, 'id'>>;
  private _telegram: Telegraf<Context>;
  private _service: { [id: string]: Interpreter<IBotMachineContext, any, BotMachineEvent> } = {};
  private _calendarMachine: StateMachine<ICalendarMachineContext, any, CalendarMachineEvent>;
  private _machine: StateMachine<IBotMachineContext, any, BotMachineEvent>;
  private _employees: { [companyId: string]: FileDB<Omit<IEmployee, 'id'>> } = {};

  constructor(telegramToken: string, telegramRoot: string, viberRoot: string) {
    this._telegramAccountLink = new FileDB<IAccountLink>(path.resolve(telegramRoot, 'accountlink.json'));
    this._viberAccountLink = new FileDB<IAccountLink>(path.resolve(viberRoot, 'accountlink.json'));
    this._customers = new FileDB<Omit<ICustomer, 'id'>>(path.resolve(process.cwd(), 'data/customers.json'));

    this._calendarMachine = Machine<ICalendarMachineContext, CalendarMachineEvent>(calendarMachineConfig,
      {
        actions: {
          showCalendar: ({ selectedDate, initialUpdate }, { update }) =>
            (update ?? initialUpdate)?.reply?.({ text: getLocString('selectFromCalendar'), menu: keyboardCalendar('ru', selectedDate.year) })
            // FIXME: язык прописан!
        }
      }
    );

    this._machine = Machine<IBotMachineContext, BotMachineEvent>(botMachineConfig(this._calendarMachine),
      {
        actions: {
          askCompanyName: reply('askCompanyName'),
          unknownCompanyName: reply('unknownCompanyName'),
          assignCompanyId: assign<IBotMachineContext, BotMachineEvent>({ companyId: this._findCompany }),
          assignEmployeeId: assign<IBotMachineContext, BotMachineEvent>({ employeeId: this._findEmployee }),
          askPersonalNumber: reply('askPersonalNumber'),
          showMainMenu: reply('mainMenuCaption', keyboardMenu),
          showPayslip: reply('payslip'),
          //showCalendar: ({ selectedDate }: any, { update }) =>
          //  update?.reply?.({ text: getLocString('selectFromCalendar'), menu: keyboardCalendar('ru', selectedDate.year) })
        },
        guards: {
          findCompany: (ctx, event) => !!this._findCompany(ctx, event),
          findEmployee: (ctx, event) => !!this._findEmployee(ctx, event),
        }
      }
    );

    this._telegram = new Telegraf(telegramToken);

    this._telegram.use((ctx, next) => {
      console.log(`Telegram Chat ${ctx.chat?.id}: ${ctx.updateType} ${ctx.message?.text !== undefined ? ('-- ' + ctx.message?.text) : ''}`);
      return next?.();
    });

    //const getReply = (ctx: Context) => ({ text, menu }: IReplyParams) => ctx.reply(text)
    const getReply = (ctx: Context) => ({ text, menu }: IReplyParams) => ctx.reply(text, menu &&
      Extra.markup(Markup.inlineKeyboard(
        menu.map(r => r.map(
          c => c.type === 'BUTTON'
            ? Markup.callbackButton(c.caption, c.command) as any
            : Markup.urlButton(c.caption, c.url)
        ))
      ))
    );

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
            reply: getReply(ctx)
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
            reply: getReply(ctx)
          });
        }
      }
    );

    this._telegram.on('callback_query',
      ctx => {
        if (!ctx.chat) {
          console.error('Invalid chat context');
        }
        else if (ctx.callbackQuery?.data === undefined) {
          console.error('Invalid chat callback query');
        } else {
          this.onUpdate({
            platform: 'TELEGRAM',
            chatId: ctx.chat.id.toString(),
            type: 'ACTION',
            body: ctx.callbackQuery.data,
            reply: getReply(ctx)
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

  getServiceId(platform: Platform, chatId: string) {
    return chatId + (platform === 'TELEGRAM' ? 't' : 'v');
  }

  finalize() {
    this._telegramAccountLink.flush();
    this._viberAccountLink.flush();
  }

  createService(platform: Platform, chatId: string) {
    const service = interpret(this._machine)
      .onTransition( (state, { type, update }) => {
        console.log(`State: ${state.toStrings().join('->')}, Event: ${type}`);
        console.log(`State value: ${JSON.stringify(state.value)}`);
        console.log(`State context: ${JSON.stringify(state.context)}`);
        if (Object.keys(state.children).length) {
          console.log(`State children: ${Object.values(state.children)[0].toJSON()}`);
        }

        // при изменении состояния сохраним его в базе, чтобы
        // потом вернуться к состоянию после перезагрузки машины
        if (update) {
          const accountLinkDB = update.platform === 'TELEGRAM' ? this._telegramAccountLink : this._viberAccountLink;
          const accountLink = accountLinkDB.read(update.chatId);
          const { companyId, employeeId, platform, ...rest } = state.context;

          if (!accountLink) {
            if (companyId && employeeId) {
              accountLinkDB.write(update.chatId, {
                customerId: companyId,
                employeeId,
                state: state.value,
                context: rest
              });
            }
          } else {
            accountLinkDB.write(update.chatId, {
              ...accountLink,
              state: state.value,
              context: rest
            });
          }
        }
      } )
      .start();
    this._service[this.getServiceId(platform, chatId)] = service;
    return service;
  }

  /**
   * Сюда поступают все события из чатов пользователей: ввод текста,
   * выбор пункта в меню, вызов команды и т.п.
   * @param update IUpdate
   */
  onUpdate(update: IUpdate) {
    const { platform, chatId, type, body, reply } = update;
    const accountLinkDB = platform === 'TELEGRAM' ? this._telegramAccountLink : this._viberAccountLink;

    if (type === 'ACTION' && body === 'logout') {
      accountLinkDB.delete(chatId);
      delete this._service[this.getServiceId(platform, chatId)];
      reply?.({ text: getLocString('goodBye') });
      return;
    }

    const service = this._service[this.getServiceId(platform, chatId)];

    if (body === '/start' || !service) {
      this.createService(platform, chatId).send({ type: accountLinkDB.has(chatId) ? 'MAIN_MENU' : 'START', update });
    } else {
      switch (type) {
        case 'MESSAGE':
          service.send({ type: 'ENTER_TEXT', text: body, update });
          break;

        case 'ACTION': {
          if (body.slice(0, 1) === '{') {
            service.send({ ...JSON.parse(body), update });
          } else {
            service.send({ type: 'MENU_COMMAND', command: body, update });
          }
          break;
        }
      }
    }
  }
};