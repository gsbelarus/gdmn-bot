import { FileDB, IData } from "./util/fileDB";
import { IAccountLink, Platform, IUpdate, ICustomer, IEmployee, IAccDed, IPayslipItem, AccDedType, IDate, PayslipType, IDet, IPayslipData, IPayslip } from "./types";
import Telegraf from "telegraf";
import { Context, Markup, Extra } from "telegraf";
import { Interpreter, Machine, StateMachine, interpret, assign, MachineOptions } from "xstate";
import { botMachineConfig, IBotMachineContext, BotMachineEvent, isEnterTextEvent, CalendarMachineEvent, ICalendarMachineContext, calendarMachineConfig } from "./machine";
import { getLocString, str2Language, Language, getLName, ILocString, stringResources, LName } from "./stringResources";
import path from 'path';
import { testNormalizeStr, testIdentStr } from "./util/utils";
import { Menu, keyboardMenu, keyboardCalendar, keyboardSettings, keyboardLanguage, keyboardCurrency } from "./menu";
import { Semaphore } from "./semaphore";
import { getCurrRate } from "./currency";
import { ExtraEditMessage } from "telegraf/typings/telegram-types";
import { payslipRoot, accDedRefFileName, employeeFileName } from "./constants";
import { Logger, ILogger } from "./log";

//TODO: поискать все файлы/пути и вынести в отдельные константы

//TODO: добавить типы для TS и заменить на import
const vb = require('viber-bot');
const ViberBot = vb.Bot
const BotEvents = vb.Events
const TextMessage = vb.Message.Text;
const KeyboardMessage = vb.Message.Keyboard;

type Template = (string | [string | ILocString, number | undefined] | undefined | ILocString | [number, number, number])[];

/**
 *
 * @param arr
 * @param type
 */
const sumPayslip = (arr?: IPayslipItem[], type?: AccDedType) =>
  arr?.reduce((prev, cur) => prev + (type ? (type === cur.type ? cur.s : 0) : cur.s), 0) ?? 0;

/** */
const fillInPayslipItem = (item: IPayslipItem[], typeId: string, name: LName, s: number, det: IDet | undefined, n: number, typeAccDed?: AccDedType) => {
  const i = item.find( d => d.id === typeId );
  if (i) {
    i.s += s;
  } else {
    item.push({ id: typeId, n, name, s, det, type: typeAccDed });
  }
};

/**
 * Получить дополнительную строку по начислению или удержанию.
 * @param valueDet
 * @param lng
 */
const getDetail = (valueDet: IDet, lng: Language) => {
  let det = '';

  det = valueDet.days ? `${valueDet.days}${getLocString(stringResources.days, lng)}` : '';
  if (valueDet.hours) {
    det = `${det}${det ?  ', ' : ''}${valueDet.hours}${getLocString(stringResources.hours, lng)}`;
  }
  if (valueDet.incMonth || valueDet.incYear) {
    det = `${det}${det ?  ', ' : ''}${valueDet.incMonth}.${valueDet.incYear}`;
  }
  return `(${det})`;
}

/**
 * Получить строку  по начилению или удержанию с детальными данными.
 * @param dataItem
 * @param lng
 */
const getItemTemplate = (dataItem: IPayslipItem[], lng: Language) => {
  const t: Template = [undefined];
  dataItem.sort((a, b) => a.n - b.n).forEach( i => {
    t.push([getLName(i.name, [lng]), i.s]);
    if (i.det) {
      t.push(getDetail(i.det, lng));
    }
  });
  return t;
}

export class Bot {
  private _telegramAccountLink: FileDB<IAccountLink>;
  private _viberAccountLink: FileDB<IAccountLink>;
  private _accountLanguage: { [id: string]: Language } = {};
  private _telegram: Telegraf<Context>;
  private _service: { [id: string]: Interpreter<IBotMachineContext, any, BotMachineEvent> } = {};
  private _telegramCalendarMachine: StateMachine<ICalendarMachineContext, any, CalendarMachineEvent>;
  private _telegramMachine: StateMachine<IBotMachineContext, any, BotMachineEvent>;
  private _employees: { [customerId: string]: FileDB<Omit<IEmployee, 'id'>> } = {};
  private _botStarted = new Date();
  private _callbacksReceived = 0;
  private _customerAccDeds: { [customerID: string]: FileDB<IAccDed> } = {};
  private _viber: any = undefined;
  private _viberCalendarMachine: StateMachine<ICalendarMachineContext, any, CalendarMachineEvent> | undefined = undefined;
  private _viberMachine: StateMachine<IBotMachineContext, any, BotMachineEvent> | undefined = undefined;
  private _logger: Logger;
  private _log: ILogger;

  constructor(telegramToken: string, telegramRoot: string, viberToken: string, viberRoot: string, logger: Logger) {
    this._logger = logger;
    this._log = this._logger.getLogger();

    const restorer = (data: IData<IAccountLink>): IData<IAccountLink> => Object.fromEntries(
      Object.entries(data).map(
        ([key, accountLink]) => [key, {
          ...accountLink,
          lastUpdated: accountLink.lastUpdated && new Date(accountLink.lastUpdated)
        }]
      )
    );

    this._telegramAccountLink = new FileDB<IAccountLink>(path.resolve(telegramRoot, 'accountlink.json'), this._log, {}, restorer);
    this._viberAccountLink = new FileDB<IAccountLink>(path.resolve(viberRoot, 'accountlink.json'), this._log, {}, restorer);

    /**************************************************************/
    /**************************************************************/
    /**                                                          **/
    /**  Telegram bot initialization                             **/
    /**                                                          **/
    /**************************************************************/
    /**************************************************************/

    type ReplyFunc = (s: ILocString | string | undefined | Promise<string>, menu?: Menu | undefined, ...args: any[]) => ({ chatId, semaphore }: Pick<IBotMachineContext, 'platform' | 'chatId' | 'semaphore'>) => Promise<void>;

    const replyTelegram: ReplyFunc = (s: ILocString | string | undefined | Promise<string>, menu?: Menu, ...args: any[]) => async ({ chatId, semaphore }: Pick<IBotMachineContext, 'platform' | 'chatId' | 'semaphore'>) => {
      if (!semaphore) {
        this._logger.error(chatId, undefined, 'No semaphore');
        return;
      }

      if (!chatId) {
        this._log.error('Invalid chatId');
        return;
      }

      const language = this._accountLanguage[this.getUniqId('TELEGRAM', chatId)] ?? 'ru';

      const keyboard = menu && Markup.inlineKeyboard(
        menu.map(r => r.map(
          c => c.type === 'BUTTON'
            ? Markup.callbackButton(getLocString(c.caption, language), c.command) as any
            : c.type === 'LINK'
            ? Markup.urlButton(getLocString(c.caption, language), c.url)
            : Markup.callbackButton(c.label, 'noop') as any
        ))
      );

      await semaphore.acquire();
      try {
        const t = await s;
        let text = typeof t === 'string' ? t : t && getLocString(t, language, ...args);
        const extra: ExtraEditMessage = keyboard ? Extra.markup(keyboard) : {};

        if (text && text.slice(0, 7) === '^FIXED\n') {
          text = '```ini\n' + text.slice(7) + '\n```';
          extra.parse_mode = 'MarkdownV2';
        }

        const accountLink = this._telegramAccountLink.read(chatId);

        if (!accountLink) {
          await this._telegram.telegram.sendMessage(chatId, text ?? '<<Empty message>>', extra);
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
            this._logger.error(chatId, undefined, e);
          }
        };

        if (lastMenuId) {
          if (text && keyboard) {
            await editMessageReplyMarkup(true);
            const message = await this._telegram.telegram.sendMessage(chatId, text, extra);
            this._telegramAccountLink.merge(chatId, { lastMenuId: message.message_id });
          }
          else if (text && !keyboard) {
            await editMessageReplyMarkup(true);
            await this._telegram.telegram.sendMessage(chatId, text, extra);
            this._telegramAccountLink.merge(chatId, {}, ['lastMenuId']);
          }
          else if (!text && keyboard) {
            await editMessageReplyMarkup();
          }
        } else {
          if (text && keyboard) {
            const message = await this._telegram.telegram.sendMessage(chatId, text, extra);
            this._telegramAccountLink.merge(chatId, { lastMenuId: message.message_id });
          }
          else if (text && !keyboard) {
            await this._telegram.telegram.sendMessage(chatId, text, extra);
          }
          else if (!text && keyboard) {
            const message = await this._telegram.telegram.sendMessage(chatId, '<<<Empty message>>>', extra);
            this._telegramAccountLink.merge(chatId, { lastMenuId: message.message_id });
          }
        }
      } catch (e) {
        this._logger.error(chatId, undefined, e);
      } finally {
        // console.log(`>> done ${semaphore.id}:${semaphore.permits} ` + logText);
        semaphore.release();
        // console.log(`>> release ${semaphore.id}:${semaphore.permits} ` + logText);
      }
    };

    const calendarMachineOptions = (reply: ReplyFunc): Partial<MachineOptions<ICalendarMachineContext, CalendarMachineEvent>> => ({
      actions: {
        showSelectedDate: ctx => reply(stringResources.showSelectedDate, undefined, ctx.selectedDate)(ctx),
        showCalendar: ({ platform, chatId, semaphore, selectedDate, dateKind }, { type }) => type === 'CHANGE_YEAR'
          ? reply(undefined, keyboardCalendar(selectedDate.year))({ platform, chatId, semaphore })
          : reply(dateKind === 'PERIOD_1_DB'
              ? stringResources.selectDB
              : dateKind === 'PERIOD_1_DE'
              ? stringResources.selectDE
              : dateKind === 'PERIOD_MONTH'
              ? stringResources.selectMonth
              : stringResources.selectDB2, keyboardCalendar(selectedDate.year)
            )({ platform, chatId, semaphore })
      }
    });

    this._telegramCalendarMachine = Machine<ICalendarMachineContext, CalendarMachineEvent>(calendarMachineConfig,
      calendarMachineOptions(replyTelegram));

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

    const getShowPayslipFunc = (payslipType: PayslipType, reply: ReplyFunc) => async (ctx: IBotMachineContext) => {
      const { accountLink, ...rest } = checkAccountLink(ctx);
      const { dateBegin, dateEnd, dateBegin2 } = ctx;
      const { customerId, employeeId, language, currency } = accountLink;
      reply(this.getPayslip(customerId, employeeId, payslipType, language ?? 'ru', currency ?? 'BYN', dateBegin, dateEnd, dateBegin2))(rest);
    };

    const machineOptions = (reply: ReplyFunc): Partial<MachineOptions<IBotMachineContext, BotMachineEvent>> => ({
      actions: {
        askCompanyName: reply(stringResources.askCompanyName),
        unknownCompanyName: reply(stringResources.unknownCompanyName),
        unknownEmployee: reply(stringResources.unknownEmployee),
        askPIN: reply(stringResources.askPIN),
        invalidPIN: reply(stringResources.invalidPIN),
        assignCompanyId: assign<IBotMachineContext, BotMachineEvent>({ customerId: this._findCompany }),
        assignEmployeeId: assign<IBotMachineContext, BotMachineEvent>({ employeeId: this._findEmployee }),
        askPersonalNumber: reply(stringResources.askPersonalNumber),
        showMainMenu: (ctx, event) => {
          if (event.type !== 'MAIN_MENU' || event.forceMainMenu) {
            reply(stringResources.mainMenuCaption, keyboardMenu)(ctx);
          }
        },
        showPayslip: getShowPayslipFunc('CONCISE', reply),
        showDetailedPayslip: getShowPayslipFunc('DETAIL', reply),
        showPayslipForPeriod: getShowPayslipFunc('DETAIL', reply),
        showComparePayslip: getShowPayslipFunc('COMPARE', reply),
        showSettings: ctx => {
          const { accountLink, ...rest } = checkAccountLink(ctx);
          const { customerId, employeeId } = ctx;
          const employee = customerId && employeeId && this._getEmployee(customerId, employeeId);
          const employeeName = employee
           ? `${employee.lastName} ${employee.firstName.slice(0, 1)}. ${employee.patrName ? employee.patrName.slice(0, 1) + '.' : ''}`
           : 'Bond, James Bond';
          reply(stringResources.showSettings, keyboardSettings, employeeName, accountLink.language ?? 'ru', accountLink.currency ?? 'BYN')(rest);
        },
        sayGoodbye: reply(stringResources.goodbye),
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
              const language = str2Language(event.command.split('/')[1]);
              accountLinkDB.write(chatId, {
                ...accountLink,
                language
              });
              this._accountLanguage[this.getUniqId(platform, chatId)] = language;
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
                currency: event.command.split('/')[1]
              });
            }
          }
        }
      },
      guards: {
        findCompany: (ctx, event) => !!this._findCompany(ctx, event),
        findEmployee: (ctx, event) => !!this._findEmployee(ctx, event),
        checkPIN: (_ctx, event) => event.type === 'ENTER_TEXT' && event.text === '17',
      }
    });

    this._telegramMachine = Machine<IBotMachineContext, BotMachineEvent>(botMachineConfig(this._telegramCalendarMachine),
      machineOptions(replyTelegram));

    this._telegram = new Telegraf(telegramToken);

    this._telegram.use((ctx, next) => {
      this._logger.info(ctx.chat?.id.toString(), ctx.from?.id.toString(), `Telegram Chat ${ctx.chat?.id}: ${ctx.updateType} ${ctx.message?.text !== undefined ? ('-- ' + ctx.message?.text) : ''}`);
      return next?.();
    });

    this._telegram.start(
      ctx => {
        if (!ctx.chat) {
          this._log.error('Invalid chat context');
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
          this._log.error('Invalid chat context');
        }
        else if (ctx.message?.text === undefined) {
          this._logger.error(ctx.chat.id.toString(), ctx.from?.id.toString(), 'Invalid chat message');
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
          this._log.error('Invalid chat context');
        }
        else if (ctx.callbackQuery?.data === undefined) {
          this._logger.error(ctx.chat.id.toString(), ctx.from?.id.toString(), 'Invalid chat callback query');
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

    /**************************************************************/
    /**************************************************************/
    /**                                                          **/
    /**  Viber bot initialization                                **/
    /**                                                          **/
    /**************************************************************/
    /**************************************************************/

    if (viberToken) {
      const replyViber = (s: ILocString | string | undefined | Promise<string>, menu?: Menu, ...args: any[]) => async ({ chatId, semaphore }: Pick<IBotMachineContext, 'platform' | 'chatId' | 'semaphore'>) => {
        if (!semaphore) {
          this._logger.error(chatId, undefined, 'No semaphore');
          return;
        }

        if (!chatId) {
          this._log.error('Invalid chatId');
          return;
        }

        const language = this._accountLanguage[this.getUniqId('VIBER', chatId)] ?? 'ru';
        const keyboard = menu && this._menu2ViberMenu(menu, language);

        await semaphore.acquire();

        try {
          const t = await s;
          let text = typeof t === 'string' ? t : t && getLocString(t, language, ...args);

          //TODO: сделать отдельные функции
          if (text && text.slice(0, 7) === '^FIXED\n') {
            text = text.slice(7);
          }

          if (keyboard) {
            const res = await this._viber.sendMessage({ id: chatId }, [new TextMessage(text), new KeyboardMessage(keyboard)]);
            if (!Array.isArray(res)) {
              this._logger.warn(chatId, undefined, JSON.stringify(res));
            }
          } else {
            await this._viber.sendMessage({ id: chatId }, [new TextMessage(text)]);
          }
        } catch (e) {
          this._logger.error(chatId, undefined, e);
        } finally {
          semaphore.release();
        }
      };

      this._viberCalendarMachine = Machine<ICalendarMachineContext, CalendarMachineEvent>(calendarMachineConfig,
        calendarMachineOptions(replyViber));

      this._viberMachine = Machine<IBotMachineContext, BotMachineEvent>(botMachineConfig(this._viberCalendarMachine),
        machineOptions(replyViber));

      this._viber = new ViberBot({
        authToken: viberToken,
        name: 'Моя зарплата',
        avatar: ''
      });

      // this._viber.on(BotEvents.SUBSCRIBED, async (response: any) => {
      //   if (!response?.userProfile) {
      //     console.error('Invalid chat context');
      //   } else {
      //     this.start(response.userProfile.id.toString());
      //   }
      // });

      this._viber.onError( (...args: any[]) => this._log.error(...args) );

      this._viber.on(BotEvents.SUBSCRIBED, (response: any) => {
        const chatId = response.userProfile.id;

        this._logger.info(chatId, undefined, `SUBSCRIBED ${chatId}`);

        if (!chatId) {
          this._log.error('Invalid viber response');
        } else {
          this.onUpdate({
            platform: 'VIBER',
            chatId,
            type: 'COMMAND',
            body: '/start',
            language: str2Language(response.userProfile.language)
          });
        }
      });

      // команда меню
      this._viber.onTextMessage(/(\.[A-Za-z0-9_]+)|(\{.+\})/, (message: any, response: any) => {
        const chatId = response.userProfile.id;

        if (!chatId) {
          this._log.error('Invalid viber response');
        } else {
          this.onUpdate({
            platform: 'VIBER',
            chatId,
            type: 'ACTION',
            body: message.text,
            language: str2Language(response.userProfile.language)
          });
        }
      });

      this._viber.onTextMessage(/.+/, (message: any, response: any) => {
        const chatId = response.userProfile.id;

        if (!chatId) {
          this._log.error('Invalid viber response');
        } else {
          this.onUpdate({
            platform: 'VIBER',
            chatId,
            type: 'MESSAGE',
            body: message.text,
            language: str2Language(response.userProfile.language)
          });
        }
      });

      this._viber.on(BotEvents.UNSUBSCRIBED, async (response: any) => {
        //TODO: проверить когда вызывается это событие
        const chatId = response.userProfile.id;
        this._viberAccountLink.delete(chatId);
        delete this._service[this.getUniqId('VIBER', chatId)];
        this._log.info(`User unsubscribed, ${response}`);
      });

      /*
      this._viber.on(BotEvents.CONVERSATION_STARTED, async (response: any, isSubscribed: boolean) => {
        if (!response?.userProfile) {
          console.error('Invalid chat context');
        } else {
          this.start(response.userProfile.id.toString(),
          `Здравствуйте${response?.userProfile.name ? ', ' + response.userProfile.name : ''}!\nДля подписки введите любое сообщение.`);
        }
      });
      */
    }
  }

  get viber() {
    return this._viber;
  }

  private _menu2ViberMenu(menu: Menu, lng: Language) {
    const Buttons: any[] = [];

    for (const row of menu) {
      const buttonWidth = row.length > 6 ? 1 : Math.floor(6 / row.length);
      for (const col of row) {
        if (col.type === 'BUTTON' || col.type === 'STATIC') {
          Buttons.push({
            Columns: buttonWidth,
            Rows: 1,
            ActionType: 'reply',
            ActionBody: col.type === 'BUTTON' ? col.command : 'noop',
            Text: `<font color=\"#ffffff\">${col.type === 'BUTTON' ? getLocString(col.caption, lng) : col.label}</font>`,
            BgColor: '#7360f2',
            Silent: true,

          });
        } else {
          Buttons.push({
            Columns: buttonWidth,
            Rows: 1,
            ActionType: 'open-url',
            ActionBody: col.url,
            Text: `<font color=\"#ffffff\">${getLocString(col.caption, lng)}</font>`,
            BgColor: '#7360f2',
            Silent: true
          });
        }
      }
    }

    return {
      Type: 'keyboard',
      Buttons,
      DefaultHeight: false
    };
  }

  private _getEmployees(customerId: string) {
    let employees = this._employees[customerId];

    if (!employees) {
      const db = new FileDB<Omit<IEmployee, 'id'>>(path.resolve(process.cwd(), `data/payslip/${customerId}/employee.json`), this._log);
      if (!db.isEmpty()) {
        this._employees[customerId] = db;
        return db;
      }
    }

    return employees;
  }

  private _getEmployee(customerId: string, employeeId: string) {
    const employees = this._getEmployees(customerId);
    return employees && employees.read(employeeId);
  }

  private _findCompany = (_: any, event: BotMachineEvent) => {
    if (isEnterTextEvent(event)) {
      const customersDB = new FileDB<Omit<ICustomer, 'id'>>(path.resolve(process.cwd(), 'data/customers.json'), this._log);
      const customers = customersDB.getMutable(false);
      for (const [companyId, { aliases }] of Object.entries(customers)) {
        if (aliases.find( alias => testNormalizeStr(alias, event.text) )) {
          return companyId;
        }
      }
    }
    return undefined;
  }

  private _findEmployee = ({ customerId }: IBotMachineContext, event: BotMachineEvent) => {
    if (isEnterTextEvent(event) && customerId) {
      const employees = this._getEmployees(customerId);

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

  private _getPayslipData(customerId: string, employeeId: string, mb: IDate, me?: IDate): IPayslipData | undefined {
    const payslip = new FileDB<IPayslip>(path.resolve(process.cwd(), `${payslipRoot}/${customerId}/${employeeId}.json`), this._log)
      .read(employeeId);

    if (!payslip) {
      return undefined;
    }

    let accDed = this._customerAccDeds[customerId];

    if (!accDed) {
      accDed = new FileDB<IAccDed>(path.resolve(process.cwd(), `${payslipRoot}/${customerId}/${accDedRefFileName}`), this._log);
      this._customerAccDeds[customerId] = accDed;
    };

    const accDedObj = accDed.getMutable(false);

    const str2Date = (date: Date | string) => {
      if (typeof date === 'string') {
        const [y, m, d] = date.split('.').map( s => Number(s) );
        return new Date(y, m - 1, d);
      } else {
        return date;
      }
    };

    const isGr = (d1: Date, d2: Date) => {
      return d1.getTime() > d2.getTime();
    }

    const isLs = (d1: Date, d2: Date) => {
      return d1.getTime() < d2.getTime();
    }

    const isGrOrEq = (d1: Date, d2: Date) => {
      return d1.getTime() >= d2.getTime();
    }

    const db = new Date(mb.year, mb.month);
    const de = me ? new Date(me.year, me.month + 1) : new Date(mb.year, mb.month + 1);

    // Подразделение получаем из массива подразделений dept,
    // как первый элемент с максимальной датой, но меньший даты окончания расч. листка
    // Аналогично с должностью из массива pos

    if (!payslip.dept.length || !payslip.pos.length || !payslip.payForm.length || !payslip.salary.length) {
      const msg = `Missing departments, positions, payforms or salary arrays in user data. cust: ${customerId}, empl: ${employeeId}`;
      this._log.error(msg);
      throw new Error(msg)
    }

    let department = payslip.dept[0].name;
    let maxDate = str2Date(payslip.dept[0].d);

    for (const dept of payslip.dept) {
      const deptD = str2Date(dept.d);
      if (isGr(deptD, maxDate) && isLs(deptD, de)) {
        department = dept.name;
        maxDate = deptD;
      }
    }

    let position = payslip.pos[0].name;
    maxDate = str2Date(payslip.pos[0].d);

    for (const pos of payslip.pos) {
      const posD = str2Date(pos.d);
      if (isGr(posD, maxDate) && isLs(posD, de)) {
        position = pos.name;
        maxDate = posD;
      }
    }

    let isSalary = payslip.payForm[0].slr;
    maxDate = str2Date(payslip.payForm[0].d);

    for (const payForm of payslip.payForm) {
      const payFormD = str2Date(payForm.d);
      if (isGr(payFormD, maxDate) && isLs(payFormD, de)) {
        isSalary = payForm.slr;
        maxDate = payFormD;
      }
    }

    let salary: number | undefined = undefined;
    let hourrate: number | undefined = undefined;

    if (isSalary) {
      salary = payslip.salary[0].s;
      maxDate = str2Date(payslip.salary[0].d);

      for (const posS of payslip.salary) {
        const posSD = str2Date(posS.d);
        if (isGr(posSD, maxDate) && isLs(posSD, de)) {
          salary = posS.s;
          maxDate = posSD;
        }
      }
    } else {
      if (payslip.hourrate?.length) {
        hourrate = payslip.hourrate[0].s;
        maxDate = str2Date(payslip.hourrate[0].d);

        for (const posHR of payslip.hourrate) {
          const posHRD = str2Date(posHR.d);
          if (isGr(posHRD, maxDate) && isLs(posHRD, de)) {
            hourrate = posHR.s;
            maxDate = posHRD;
          }
        }
      }
    }

    const data = {
      department,
      position,
      salary,
      hourrate,
      tax: [],
      advance: [],
      deduction: [],
      accrual: [],
      tax_deduction: [],
      privilage: []
    } as IPayslipData;

    //Цикл по всем записям начислений-удержаний
    for (const value of Object.values(payslip.data)) {
      const valueDB = str2Date(value.db);
      const valueDE = str2Date(value.de);
      if (isGrOrEq(valueDB, db) && isLs(valueDE, de)) {
        const { det, s, typeId } = value;

        if (!accDedObj[typeId]) {
          if (typeId === 'saldo') {
            data.saldo = {
              id: 'saldo',
              n: -1,
              name: {
                ru: { name: 'Остаток' },
                be: { name: 'Рэшта' },
                en: { name: 'Balance' }
              },
              s
            };
            continue;
          }

          this._log.error(`Отсутствует в справочнике тип начисления или удержания ${typeId}`);
          continue;
        }

        const { name, type } = accDedObj[typeId];
        const n = accDedObj[typeId].n ?? 10000;

        switch (type) {
          case 'INCOME_TAX':
          case 'PENSION_TAX':
          case 'TRADE_UNION_TAX':
            fillInPayslipItem(data.tax, typeId, name, s, det, n, type);
            break;

          case 'ADVANCE':
            fillInPayslipItem(data.advance, typeId, name, s, det, n);
            break;

          case 'DEDUCTION':
            fillInPayslipItem(data.deduction, typeId, name, s, det, n);
            break;

          case 'ACCRUAL':
            fillInPayslipItem(data.accrual, typeId, name, s, det, n);
            break;

          case 'TAX_DEDUCTION':
            fillInPayslipItem(data.tax_deduction, typeId, name, s, det, n);
            break;

          case 'PRIVILAGE':
            fillInPayslipItem(data.privilage, typeId, name, s, det, n);
            break;
        }
      }
    };

    return (data.saldo || data.accrual?.length || data.deduction?.length) ? data : undefined;
  };

  private _calcPayslipByRate(data: IPayslipData, rate: number) {
    const { saldo, tax, advance, deduction, accrual, tax_deduction, privilage, salary, hourrate, ...rest } = data;
    return {
      ...rest,
      saldo: saldo && { ...saldo, s: saldo.s / rate },
      tax: tax && tax.map( i => ({ ...i, s: i.s / rate }) ),
      advance: advance && advance.map( i => ({ ...i, s: i.s / rate }) ),
      deduction: deduction && deduction.map( i => ({ ...i, s: i.s / rate }) ),
      accrual: accrual && accrual.map( i => ({ ...i, s: i.s / rate }) ),
      tax_deduction: tax_deduction && tax_deduction.map( i => ({ ...i, s: i.s / rate }) ),
      privilage: privilage && privilage.map( i => ({ ...i, s: i.s / rate }) ),
      salary: salary && salary / rate,
      hourrate: hourrate && hourrate / rate
    }
  }

  private _formatShortPayslip(data: IPayslipData, lng: Language, periodName: string, currencyName: string): Template {
    const accruals = sumPayslip(data.accrual);
    const taxes = sumPayslip(data.tax);
    const deds = sumPayslip(data.deduction);
    const advances = sumPayslip(data.advance);
    const incomeTax = sumPayslip(data.tax, 'INCOME_TAX');
    const pensionTax = sumPayslip(data.tax, 'PENSION_TAX');
    const tradeUnionTax = sumPayslip(data.tax, 'TRADE_UNION_TAX');

    return [
      stringResources.payslipTitle,
      //employeeName,
      periodName,
      currencyName,
      stringResources.payslipDepartment,
      getLName(data.department, [lng]),
      stringResources.payslipPosition,
      getLName(data.position, [lng]),
      data.hourrate ? [stringResources.payslipHpr, data.hourrate] : [stringResources.payslipSalary, data.salary],
      '=',
      [stringResources.payslipAccrued, accruals],
      '=',
      [stringResources.payslipNetsalary, accruals - taxes],
      [stringResources.payslipDeductions, deds],
      [stringResources.payslipAdvance, advances],
      [stringResources.payslipPayroll, data.saldo?.s],
      '=',
      [stringResources.payslipTaxes, taxes],
      [stringResources.payslipIncometax, incomeTax],
      [stringResources.payslipPensionTax, pensionTax],
      [stringResources.payslipTradeUnionTax, tradeUnionTax]
    ];
  }

  private _formatComparativePayslip(data: IPayslipData, data2: IPayslipData, periodName: string, currencyName: string): Template {
    const accruals = sumPayslip(data.accrual);
    const taxes = sumPayslip(data.tax);
    const deds = sumPayslip(data.deduction);

    const accruals2 = sumPayslip(data2.accrual);
    const taxes2 = sumPayslip(data2.tax);
    const deds2 = sumPayslip(data2.deduction);

    return [
      stringResources.comparativePayslipTitle,
      //employeeName,
      periodName,
      currencyName,
      data.hourrate ? stringResources.payslipHpr : stringResources.payslipSalary,
      data.hourrate ? [data.hourrate ?? 0, data2.hourrate ?? 0, (data2.hourrate ?? 0) - (data.hourrate ?? 0)] : [data.salary ?? 0, data2.salary ?? 0, (data2.salary ?? 0) - (data.salary ?? 0)],
      '=',
      stringResources.payslipAccrued,
      [accruals, accruals2, accruals2 - accruals],
      '=',
      stringResources.payslipNetsalary,
      [accruals - taxes, accruals2 - taxes2, accruals2 - taxes2 - (accruals - taxes)],
      '=',
      stringResources.payslipDeductionsWOSpace,
      [deds, deds2, deds2 - deds],
      '=',
      stringResources.payslipTaxes,
      [taxes, taxes2, taxes2 - taxes],
    ];
  }

  private _formatDetailedPayslip(data: IPayslipData, lng: Language, periodName: string, currencyName: string): Template {
    const accruals = sumPayslip(data.accrual);
    const taxes = sumPayslip(data.tax);
    const deds = sumPayslip(data.deduction);
    const advances = sumPayslip(data.advance);
    const taxDeds = sumPayslip(data.tax_deduction);
    const privilages = sumPayslip(data.privilage);

    const strAccruals = getItemTemplate(data.accrual, lng);
    const strDeductions = getItemTemplate(data.deduction, lng);
    const strAdvances: Template = getItemTemplate(data.advance, lng);
    const strTaxes: Template = getItemTemplate(data.tax, lng);
    const strTaxDeds: Template = getItemTemplate(data.tax_deduction, lng);
    const strPrivilages: Template = getItemTemplate(data.privilage, lng);

    return [
      stringResources.payslipTitle,
      //employeeName,
      periodName,
      currencyName,
      stringResources.payslipDepartment,
      getLName(data.department, [lng]),
      stringResources.payslipPosition,
      getLName(data.position, [lng]),
      data.hourrate ? [stringResources.payslipHpr, data.hourrate] : [stringResources.payslipSalary, data.salary],
      '=',
      [stringResources.payslipAccrued, accruals],
      accruals ? '=' : '',
      ...strAccruals,
      accruals ? '=' : '',
      [stringResources.payslipDeductionsWOSpace, deds],
      deds ? '=' : '',
      ...strDeductions,
      deds ? '=' : '',
      [stringResources.payslipAdvanceWOSpace, advances],
      advances ? '=' : '',
      ...strAdvances,
      advances ? '=' : '',
      [stringResources.payslipTaxes, taxes],
      taxes ? '=' : '',
      ...strTaxes,
      taxes ? '=' : '',
      [stringResources.payslipTaxDeduction, taxDeds],
      taxDeds ? '=' : '',
      ...strTaxDeds,
      taxDeds ? '=' : '',
      [stringResources.payslipPrivileges, privilages],
      privilages ? '=' : '',
      ...strPrivilages,
      privilages ? '=' : ''
    ];
  }

  async getPayslip(customerId: string, employeeId: string, type: PayslipType, lng: Language, currency: string, db: IDate, de: IDate, db2?: IDate): Promise<string> {

    const translate = (s: string | ILocString) => typeof s === 'object'
      ? getLocString(s, lng)
      : s;

    const format = new Intl.NumberFormat('ru-RU', { style: 'decimal', useGrouping: true, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format;

    const payslipView = (template: Template) => {
      /**
       * Ширина колонки с названием показателя в расчетном листке.
       */
      const lLabel = 23;
      /**
       * Ширина колонки с числовым значением в расчетном листке.
       * Должна быть достаточной, чтобы уместить разделительный пробел.
       */
      const lValue = 9;
      /**
       * Ширина колонки в сравнительном листке.
       */
      const lCol = 10;
      /**
       * Полная ширина с учетом разделительного пробела
       */
      const fullWidth = lLabel + lValue;

      const splitLong = (s: string, withSum = true) => {
        // у нас может получиться длинная строка, которая не влазит на экран
        // будем переносить ее, "откусывая сначала"

        if (s.length <= fullWidth) {
          return s;
        }

        const res: string[][] = [];

        // разобьем на слова, учтем возможность наличия двойных пробелов
        // слова длиннее lLabel разобьем на части
        let tokens = s
          .split(' ')
          .map( c => c.trim() )
          .filter( c => c )
          .flatMap( c => {
            if (c.length <= lLabel) {
              return c;
            } else {
              const arr: string[] = [];
              let l = c;
              while (l.length > lLabel) {
                arr.push(l.slice(0, lLabel));
                l = l.slice(lLabel);
              }
              return arr;
            }
          });

        while (tokens.length) {
          let i = 0;
          let l = 0;

          // только одну сумму не будем оставлять на одной строке
          while (i < tokens.length) {
            if (l + tokens[i].length <= lLabel) {
              l += tokens[i].length;
              i++;
            } else {
              break;
            }
          }

          res.push(tokens.slice(0, i));
          tokens = tokens.slice(i);
        }

        if (withSum) {
          const last = res.length - 1;

          // оставлять просто одну сумму в последней строке нельзя
          if (res[last].length === 1 && res.length > 1) {
            res[last] = [res[last - 1][res[last - 1].length - 1], ...res[last]];
            res[last - 1].length = res[last - 1].length - 1;
          }

          return res.map( (l, idx) => {
            if (idx === last) {
              const line = [...l];
              const sum = line[l.length - 1];
              line.length = line.length - 1;
              return `${line.join(' ').padEnd(lLabel)}${sum.padStart(lValue)}`
            } else {
              return l.join(' ');
            }
          }).join('\n');
        } else {
          return res.map( l => l.join(' ') ).join('\n');
        }
      }

      return template.filter( t => t && (!Array.isArray(t) || t[1] !== undefined) )
        .map(t => Array.isArray(t) && t.length === 3
          ? `${format(t[0]).padStart(lCol)}${format(t[1]).padStart(lCol)}${format(t[2]).padStart(lCol)}`
          : Array.isArray(t) && t.length === 2
          ? splitLong(`${translate(t[0]).padEnd(lLabel)}${format(t[1]!).padStart(lValue)}`)
          : t === '='
          ? '='.padEnd(fullWidth, '=')
          : translate(t!))
        .join('\n');
    };

    let dataI = this._getPayslipData(customerId, employeeId, db, de);

    if (!dataI) {
      return getLocString(stringResources.noData, lng);
    }

    const currencyRate = currency === 'BYN' ? undefined : await getCurrRate(db, currency, this._log);

    if (currency && currency !== 'BYN' && !currencyRate) {
      return getLocString(stringResources.cantLoadRate, lng, currency);
    }

    if (currencyRate) {
      dataI = this._calcPayslipByRate(dataI, currencyRate.rate);
    }

    let s: Template;

    if (type !== 'COMPARE') {
      const periodName = getLocString(stringResources.payslipPeriod, lng) + (de.year !== db.year || de.month !== db.month
        ? `${db.month + 1}.${db.year}-${de.month + 1}.${de.year}`
        : `${new Date(db.year, db.month).toLocaleDateString(lng, { month: 'long', year: 'numeric' })}`
      );

      const currencyAndRate = getLocString(stringResources.payslipCurrency, lng, currency, currencyRate);

      s = type === 'CONCISE'
        ? this._formatShortPayslip(dataI, lng, periodName, currencyAndRate)
        : this._formatDetailedPayslip(dataI, lng, periodName, currencyAndRate);
    } else {
      if (!db2) {
        throw new Error('db2 is not specified');
      }

      const periodLength = (de.year - db.year) * 12 + (de.month - db.month);
      const periodStart = db2.year * 12 + db2.month;
      const periodEnd = periodStart + periodLength;
      const de2 = {
        year: Math.floor(periodEnd / 12),
        month: periodEnd % 12
      };

      const currencyRate2 = currency === 'BYN' ? undefined : await getCurrRate(db2, currency, this._log);

      if (currency && currency !== 'BYN' && !currencyRate2) {
        return getLocString(stringResources.cantLoadRate, lng, currency);
      }

      let dataII = this._getPayslipData(customerId, employeeId, db2, de2);

      if (!dataII) {
        return getLocString(stringResources.noData, lng);
      }

      if (currencyRate2) {
        dataII = this._calcPayslipByRate(dataII, currencyRate2.rate);
      }

      const periodName = getLocString(stringResources.comparativePayslipPeriod, lng, db, de, db2, de2);

      const currencyAndRate = getLocString(stringResources.comparativePayslipCurrency, lng, currency, currencyRate, currencyRate2);

      s = this._formatComparativePayslip(dataI, dataII, periodName, currencyAndRate);
    }

    return '^FIXED\n' + payslipView(s);
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

    let service;

    if (inPlatform === 'TELEGRAM') {
      service = interpret(this._telegramMachine);
    } else {
      if (!this._viberMachine) {
        throw new Error('Viber machine is not defined!');
      }
      service = interpret(this._viberMachine);
    }

    service = service.onTransition( (state) => {
        const accountLinkDB = inPlatform === 'TELEGRAM' ? this._telegramAccountLink : this._viberAccountLink;

        /*
        this._logger.debug(inChatId, undefined, `State: ${state.toStrings().join('->')}, Event: ${type}`);
        this._logger.debug(inChatId, undefined, `State value: ${JSON.stringify(state.value)}`);
        this._logger.debug(inChatId, undefined, `State context: ${JSON.stringify(state.context)}`);
        if (Object.keys(state.children).length) {
          this._logger.debug(inChatId, undefined, `State children: ${JSON.stringify(Object.values(state.children)[0].state.value)}`);
        }
        */

        if (state.done) {
          return;
        }

        // при изменении состояния сохраним его в базе, чтобы
        // потом вернуться к состоянию после перезагрузки машины
        const language = this._accountLanguage[uniqId];
        const accountLink = accountLinkDB.read(inChatId);
        const { customerId, employeeId, verified, platform, chatId, semaphore, ...rest } = state.context;

        if (!accountLink) {
          if (customerId && employeeId && verified) {
            accountLinkDB.write(inChatId, {
              customerId,
              employeeId,
              language,
              state: state.value instanceof Object ? { ...state.value } : state.value,
              context: rest,
              lastUpdated: new Date()
            });
          }
        } else {
          accountLinkDB.write(inChatId, {
            ...accountLink,
            state: state.value instanceof Object ? { ...state.value } : state.value,
            context: rest,
            lastUpdated: new Date()
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
    this._callbacksReceived++;

    const { platform, chatId, type, body, language } = update;

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
      } else {
        this._viber.sendMessage({ id: chatId }, [new TextMessage(data.join('\n'))]);
      }
      return;
    }

    const accountLinkDB = platform === 'TELEGRAM' ? this._telegramAccountLink : this._viberAccountLink;
    const accountLink = accountLinkDB.read(chatId);
    const uniqId = this.getUniqId(platform, chatId);
    let service = this._service[uniqId];

    if (!this._accountLanguage[uniqId]) {
      if (accountLink?.language) {
        this._accountLanguage[uniqId] = accountLink.language;
      } else {
        this._accountLanguage[uniqId] = language;
      }
    }

    const createNewService = (forceMainMenu = true) => {
      const res = this.createService(platform, chatId);

      if (accountLink) {
        const { customerId, employeeId, } = accountLink;
        res.send({
          type: 'MAIN_MENU',
          platform,
          chatId,
          customerId,
          employeeId,
          forceMainMenu,
          semaphore: new Semaphore()
        });
      } else {
        res.send({
          type: 'START',
          platform,
          chatId,
          semaphore: new Semaphore()
        });
      }

      return res;
    }

    if (body === '/start' || service?.state.done) {
      createNewService(true);
      return;
    }

    if (!service) {
      service = createNewService(false);
    }

    let e: BotMachineEvent | undefined;

    switch (type) {
      case 'MESSAGE':
        e = { type: 'ENTER_TEXT', text: body };
        break;

      case 'ACTION': {
        if (body.slice(0, 1) === '{') {
          e = { ...JSON.parse(body), update };
        } else {
          e = { type: 'MENU_COMMAND', command: body };
        }
        break;
      }

      default:
        e = undefined;
    }

    if (e) {
      service.send(e);

      let childrenStateChanged = false;

      for (const [_key, ch] of service.children) {
        if (ch.state.changed) {
          childrenStateChanged = true;
          break;
        }
      }

      if (!service.state.changed && !childrenStateChanged) {
        // мы каким-то образом попали в ситуацию, когда текущее состояние не
        // может принять вводимую информацию. например, пользователь
        // очистил чат или произошел сбой на стороне мессенджера и
        // то, что видит пользователь отличается от внутреннего состояния
        // машины

        if (platform === 'TELEGRAM') {
          this._telegram.telegram.sendMessage(chatId, getLocString(stringResources.weAreLost, language));
        } else {
          this._viber.sendMessage({ id: chatId }, [new TextMessage(getLocString(stringResources.weAreLost, language))]);
        }

        createNewService(true);
      }
    }
  }

  uploadAccDeds(customerId: string, objData: Object) {
    let customerAccDed = this._customerAccDeds[customerId];

    if (!customerAccDed) {
      customerAccDed = new FileDB<IAccDed>(path.resolve(process.cwd(), `${payslipRoot}/${customerId}/${accDedRefFileName}`), this._log);
      this._customerAccDeds[customerId] = customerAccDed;
    }

    customerAccDed.clear();

    for (const [key, value] of Object.entries(objData)) {
      customerAccDed.write(key, value as any);
    }

    customerAccDed.flush();
  }

  uploadEmployees(customerId: string, objData: Object) {
    let employee = this._employees[customerId];

    if (!employee) {
      employee = new FileDB<Omit<IEmployee, 'id'>>(path.resolve(process.cwd(), `${payslipRoot}/${customerId}/${employeeFileName}`), this._log);
      this._employees[customerId] = employee;
    }

    employee.clear();

    for (const [key, value] of Object.entries(objData)) {
      employee.write(key, value as any);
    }

    employee.flush();
  }

  upload_payslips(customerId: string, objData: IPayslip, rewrite: boolean) {
    const employeeId = objData.emplId;
    const payslip = new FileDB<IPayslip>(path.resolve(process.cwd(), `${payslipRoot}/${customerId}/${employeeId}.json`), this._log);

    if (rewrite) {
      payslip.clear();
    }

    const prevPayslipData = payslip.read(employeeId);

    // если на диске не было файла или там было пусто, то
    // просто запишем данные, которые пришли из интернета
    if (!prevPayslipData) {
      payslip.write(employeeId, objData);
    } else {
      // данные есть. надо объединить прибывшие данные с тем
      // что уже есть на диске
      const newPayslipData = {
        ...prevPayslipData,
        data: [...prevPayslipData.data],
        dept: [...prevPayslipData.dept],
        pos: [...prevPayslipData.pos],
        salary: [...prevPayslipData.salary],
        payForm: [...prevPayslipData.payForm],
        hourrate: prevPayslipData.hourrate ? [...prevPayslipData.hourrate] : []
      };

      // объединяем начисления
      for (const d of objData.data) {
        const i = newPayslipData.data.findIndex( a => a.typeId === d.typeId && a.db === d.db && a.de === d.de );
        if (i === -1) {
          newPayslipData.data.push(d);
        } else {
          newPayslipData.data[i] = d;
        }
      }

      // объединяем подразделения
      for (const d of objData.dept) {
        const i = newPayslipData.dept.findIndex( a => a.id === d.id && a.d === d.d );
        if (i === -1) {
          newPayslipData.dept.push(d);
        } else {
          newPayslipData.dept[i] = d;
        }
      }

      // объединяем должности
      for (const p of objData.pos) {
        const i = newPayslipData.pos.findIndex( a => a.id === p.id && a.d === p.d );
        if (i === -1) {
          newPayslipData.pos.push(p);
        } else {
          newPayslipData.pos[i] = p;
        }
      }

      // объединяем формы оплат
      for (const p of objData.payForm) {
        const i = newPayslipData.payForm.findIndex( a => a.d === p.d );
        if (i === -1) {
          newPayslipData.payForm.push(p);
        } else {
          newPayslipData.payForm[i] = p;
        }
      }

      // объединяем оклады
      for (const p of objData.salary) {
        const i = newPayslipData.salary.findIndex( a => a.d === p.d );
        if (i === -1) {
          newPayslipData.salary.push(p);
        } else {
          newPayslipData.salary[i] = p;
        }
      }

      if (objData.hourrate) {
        // объединяем чтс
        for (const p of objData.hourrate) {
          const i = newPayslipData.hourrate.findIndex( a => a.d === p.d );
          if (i === -1) {
            newPayslipData.hourrate.push(p);
          } else {
            newPayslipData.hourrate[i] = p;
          }
        }
      }

      payslip.write(employeeId, newPayslipData);
    }

    payslip.flush();

    //TODO: оповестить всех клиентов о новых расчетных листках
    // надо организовать цикл по всем аккаунт линк и если текущий диалог
    // находится в состоянии главного меню, вывести там через машину
    // состояний кратский расчетный листок
  }
};