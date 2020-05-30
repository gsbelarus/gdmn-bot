import { FileDB } from "./util/fileDB";
import { IAccountLink, Platform, IUpdate, ICustomer, IEmployee } from "./types";
import Telegraf from "telegraf";
import { Context, Markup, Extra } from "telegraf";
import { Interpreter, Machine, StateMachine, interpret, assign } from "xstate";
import { botMachineConfig, IBotMachineContext, BotMachineEvent, isEnterTextEvent, CalendarMachineEvent, ICalendarMachineContext, calendarMachineConfig, MenuCommandEvent } from "./machine";
import { getLocString, StringResource, str2Language, Language } from "./stringResources";
import path from 'path';
import { testNormalizeStr, testIdentStr } from "./util/utils";
import { Menu, keyboardMenu, keyboardCalendar, keyboardSettings, keyboardLanguage, keyboardCurrency } from "./menu";
import { Semaphore } from "./semaphore";

// TODO: У нас сейчас серверная часть, которая отвечает за загрузку данных не связана с ботом
//       надо предусмотреть обновление или просто сброс данных после загрузки на сервер
//       из Гедымина.

export class Bot {
  private _telegramAccountLink: FileDB<IAccountLink>;
  private _viberAccountLink: FileDB<IAccountLink>;
  private _accountLanguage: { [id: string]: Language } = {};
  private _customers: FileDB<Omit<ICustomer, 'id'>>;
  private _telegram: Telegraf<Context>;
  private _service: { [id: string]: Interpreter<IBotMachineContext, any, BotMachineEvent> } = {};
  private _calendarMachine: StateMachine<ICalendarMachineContext, any, CalendarMachineEvent>;
  private _machine: StateMachine<IBotMachineContext, any, BotMachineEvent>;
  private _employees: { [companyId: string]: FileDB<Omit<IEmployee, 'id'>> } = {};
  private _botStarted = new Date();
  private _callbacksReceived = 0;

  constructor(telegramToken: string, telegramRoot: string, viberRoot: string) {
    this._telegramAccountLink = new FileDB<IAccountLink>(path.resolve(telegramRoot, 'accountlink.json'));
    this._viberAccountLink = new FileDB<IAccountLink>(path.resolve(viberRoot, 'accountlink.json'));
    this._customers = new FileDB<Omit<ICustomer, 'id'>>(path.resolve(process.cwd(), 'data/customers.json'));

    const reply = (s: StringResource | undefined, menu?: Menu, ...args: any[]) => async ({ platform, chatId, semaphore }: Pick<IBotMachineContext, 'platform' | 'chatId' | 'semaphore'>) => {
      if (!semaphore) {
        console.log('No semaphore');
        return;
      }

      if (!chatId) {
        console.log('Invalid chatId');
        return;
      }

      if (platform === 'TELEGRAM') {
        const language = this._accountLanguage[this.getUniqId(platform, chatId)];

        const keyboard = menu && Markup.inlineKeyboard(
          menu.map(r => r.map(
            c => c.type === 'BUTTON'
              ? Markup.callbackButton(getLocString(c.caption, language), c.command) as any
              : c.type === 'LINK'
              ? Markup.urlButton(getLocString(c.caption, language), c.url)
              : Markup.callbackButton(c.label, 'noop') as any
          ))
        );

        const text = s && getLocString(s, language, ...args);

        await semaphore.acquire();
        try {
          const accountLink = this._telegramAccountLink.read(chatId);

          if (!accountLink) {
            await this._telegram.telegram.sendMessage(chatId, text ?? '<<Empty message>>', Extra.markup(keyboard));
            return;
          }

          const { lastMenuId } = accountLink;

          const editMessageReplyMarkup = async (remove = false) => {
            try {
              if (remove || !keyboard) {
                await this._telegram.telegram.editMessageReplyMarkup(chatId, lastMenuId);
              } else {
                await this._telegram.telegram.editMessageReplyMarkup(chatId, lastMenuId, undefined, keyboard && JSON.stringify(keyboard));
              }
            } catch (e) {
              //
            }
          };

          if (lastMenuId) {
            if (text && keyboard) {
              await editMessageReplyMarkup(true);
              const message = await this._telegram.telegram.sendMessage(chatId, text, Extra.markup(keyboard));
              this._telegramAccountLink.merge(chatId, { lastMenuId: message.message_id });
            }
            else if (text && !keyboard) {
              await editMessageReplyMarkup(true);
              await this._telegram.telegram.sendMessage(chatId, text);
              this._telegramAccountLink.merge(chatId, {}, ['lastMenuId']);
            }
            else if (!text && keyboard) {
              await editMessageReplyMarkup();
            }
          } else {
            if (text && keyboard) {
              const message = await this._telegram.telegram.sendMessage(chatId, text, Extra.markup(keyboard));
              this._telegramAccountLink.merge(chatId, { lastMenuId: message.message_id });
            }
            else if (text && !keyboard) {
              await this._telegram.telegram.sendMessage(chatId, text);
            }
            else if (!text && keyboard) {
              const message = await this._telegram.telegram.sendMessage(chatId, '<<<Empty message>>>', Extra.markup(keyboard));
              this._telegramAccountLink.merge(chatId, { lastMenuId: message.message_id });
            }
          }
        } catch (e) {
          console.log(e);
          semaphore.release();
        } finally {
          semaphore.release();
        }
      }
    };

    this._calendarMachine = Machine<ICalendarMachineContext, CalendarMachineEvent>(calendarMachineConfig,
      {
        actions: {
          showSelectedDate: reply('showSelectedDate'),
          showCalendar: ({ platform, chatId, semaphore, selectedDate, dateKind }, { type }) => type === 'CHANGE_YEAR'
            ? reply(undefined, keyboardCalendar(selectedDate.year))({ platform, chatId, semaphore })
            : reply(dateKind === 'PERIOD_1_DB'
              ? 'selectDB'
              : dateKind === 'PERIOD_1_DE'
              ? 'selectDE'
              : 'selectDB2', keyboardCalendar(selectedDate.year))({ platform, chatId, semaphore }
            )
        }
      }
    );

    const checkAccountLink = (ctx: IBotMachineContext) => {
      const { platform, chatId, semaphore } = ctx;

      if (!platform) {
        throw new Error('No platform set');
      }

      if (!chatId) {
        throw new Error('No chatId');
      }

      const accountLinkDB = platform === 'TELEGRAM' ? this._telegramAccountLink : this._viberAccountLink;
      const accountLink = accountLinkDB.read(chatId);

      if (!accountLink) {
        throw new Error('No account link');
      }

      return { platform, chatId, semaphore, accountLink };
    };

    this._machine = Machine<IBotMachineContext, BotMachineEvent>(botMachineConfig(this._calendarMachine),
      {
        actions: {
          //TODO: зачем передавать ключ, когда можно передать структуру?
          askCompanyName: reply('askCompanyName'),
          unknownCompanyName: reply('unknownCompanyName'),
          assignCompanyId: assign<IBotMachineContext, BotMachineEvent>({ customerId: this._findCompany }),
          assignEmployeeId: assign<IBotMachineContext, BotMachineEvent>({ employeeId: this._findEmployee }),
          askPersonalNumber: reply('askPersonalNumber'),
          showMainMenu: reply('mainMenuCaption', keyboardMenu),
          showPayslip: reply('payslip'),
          showPayslipForPeriod: reply('payslipForPeriod'),
          showComparePayslip: reply('comparePayslip'),
          showSettings: ctx => {
            const { accountLink, ...rest } = checkAccountLink(ctx);
            //TODO: языка и валюты может не быть. надо заменять на дефолтные
            reply('showSettings', keyboardSettings, accountLink.language, accountLink.currencyId)(rest);
          },
          sayGoodbye: reply('sayGoodbye'),
          logout: ({ platform, chatId }) => {
            if (platform && chatId) {
              const accountLinkDB = platform === 'TELEGRAM' ? this._telegramAccountLink : this._viberAccountLink;
              accountLinkDB.delete(chatId);
              delete this._service[this.getUniqId(platform, chatId)];
            }
          },
          showSelectLanguageMenu: reply(undefined, keyboardLanguage),
          selectLanguage: (ctx, event) => {
            if (event.type === 'MENU_COMMAND') {
              const { accountLink, chatId, platform } = checkAccountLink(ctx);
              if (accountLink) {
                const accountLinkDB = platform === 'TELEGRAM' ? this._telegramAccountLink : this._viberAccountLink;
                accountLinkDB.write(chatId, {
                  ...accountLink,
                  language: str2Language(event.command.split('/')[1])
                });
              }
            }
          },
          showSelectCurrencyMenu: reply(undefined, keyboardCurrency),
          selectCurrency: (ctx, event) => {
            if (event.type === 'MENU_COMMAND') {
              const { accountLink, chatId, platform } = checkAccountLink(ctx);
              if (accountLink) {
                const accountLinkDB = platform === 'TELEGRAM' ? this._telegramAccountLink : this._viberAccountLink;
                accountLinkDB.write(chatId, {
                  ...accountLink,
                  currencyId: event.command.split('/')[1]
                });
              }
            }
          }
        },
        guards: {
          findCompany: (ctx, event) => !!this._findCompany(ctx, event),
          findEmployee: (ctx, event) => !!this._findEmployee(ctx, event),
        }
      }
    );

    this._telegram = new Telegraf(telegramToken);

    this._telegram.use((ctx, next) => {
      this._callbacksReceived++;
      console.log(`Telegram Chat ${ctx.chat?.id}: ${ctx.updateType} ${ctx.message?.text !== undefined ? ('-- ' + ctx.message?.text) : ''}`);
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
            language: str2Language(ctx.from?.language_code)
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
            language: str2Language(ctx.from?.language_code)
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
            language: str2Language(ctx.from?.language_code)
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

  private _findEmployee = ({ customerId: companyId }: IBotMachineContext, event: BotMachineEvent) => {
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

  /**
   * Прибавляет к идентификатору чата идентификатор платформы.
   * На всякий случай, чтобы не пересеклись идентификаторы из разных мессенджеров.
   * @param platform
   * @param chatId
   */
  getUniqId(platform: Platform, chatId: string) {
    return chatId + (platform === 'TELEGRAM' ? 't' : 'v');
  }

  finalize() {
    this._telegramAccountLink.flush();
    this._viberAccountLink.flush();
  }

  createService(inPlatform: Platform, inChatId: string) {
    const uniqId = this.getUniqId(inPlatform, inChatId);
    const accountLinkDB = inPlatform === 'TELEGRAM' ? this._telegramAccountLink : this._viberAccountLink;
    const service = interpret(this._machine)
      .onTransition( (state, { type }) => {
        console.log(`State: ${state.toStrings().join('->')}, Event: ${type}`);
        console.log(`State value: ${JSON.stringify(state.value)}`);
        console.log(`State context: ${JSON.stringify(state.context)}`);
        if (Object.keys(state.children).length) {
          console.log(`State children: ${JSON.stringify(Object.values(state.children)[0].state.value)}`);
        }

        // при изменении состояния сохраним его в базе, чтобы
        // потом вернуться к состоянию после перезагрузки машины
        const language = this._accountLanguage[uniqId];
        const accountLink = accountLinkDB.read(inChatId);
        const { customerId, employeeId, platform, chatId, semaphore, ...rest } = state.context;

        if (!accountLink) {
          if (customerId && employeeId) {
            accountLinkDB.write(inChatId, {
              customerId,
              employeeId,
              language,
              state: state.value instanceof Object ? { ...state.value } : state.value,
              context: rest
            });
          }
        } else {
          accountLinkDB.write(inChatId, {
            ...accountLink,
            language,
            state: state.value instanceof Object ? { ...state.value } : state.value,
            context: rest
          });
        }
      })
      .start();
    this._service[uniqId] = service;
    return service;
  }

  /**
   * Сюда поступают все события из чатов пользователей: ввод текста,
   * выбор пункта в меню, вызов команды и т.п.
   * @param update IUpdate
   */
  onUpdate(update: IUpdate) {
    const { platform, chatId, type, body, language } = update;
    const accountLinkDB = platform === 'TELEGRAM' ? this._telegramAccountLink : this._viberAccountLink;
    const uniqId = this.getUniqId(platform, chatId);
    const service = this._service[uniqId];

    if (this._accountLanguage[uniqId] !== language) {
      this._accountLanguage[uniqId] = language;
    }

    if (body === '/start' || !service) {
      const accountLink = accountLinkDB.read(chatId);
      if (accountLink) {
        const { customerId, employeeId, } = accountLink;
        this.createService(platform, chatId).send({
          type: 'MAIN_MENU',
          platform,
          chatId,
          customerId,
          employeeId,
          semaphore: new Semaphore()
        });
      } else {
        this.createService(platform, chatId).send({
          type: 'START',
          platform,
          chatId,
          semaphore: new Semaphore()
        });
      }
    } else {
      switch (type) {
        case 'MESSAGE':
          if (body === 'diagnostics') {
            this.finalize();
            const data = [
              `Server started: ${this._botStarted}`,
              `Node version: ${process.versions.node}`,
              'Memory usage:',
              JSON.stringify(process.memoryUsage(), undefined, 2),
              `Services are running: ${Object.values(this._service).length}`,
              `Callbacks received: ${this._callbacksReceived}`
            ];
            if (platform === 'TELEGRAM') {
              this._telegram.telegram.sendMessage(chatId, '```\n' + data.join('\n') + '```', { parse_mode: 'MarkdownV2' });
            }
            return;
          }

          service.send({ type: 'ENTER_TEXT', text: body });
          break;

        case 'ACTION': {
          if (body.slice(0, 1) === '{') {
            service.send({ ...JSON.parse(body), update });
          } else {
            service.send({ type: 'MENU_COMMAND', command: body });
          }
          break;
        }
      }
    }
  }
};