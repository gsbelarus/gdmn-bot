import { FileDB, IData } from "./util/fileDB";
import { IAccountLink, Platform, IUpdate, ICustomer, IEmployee, IAccDed, IPayslipItem, AccDedType, IDate, PayslipType, IDet, IPayslipData, IPayslip, IAnnouncement, ITimeSheet, IScheduleData, ITimeSheetJSON, ICanteenMenus } from "./types";
import Telegraf from "telegraf";
import { Context, Markup, Extra } from "telegraf";
import { Interpreter, Machine, StateMachine, interpret, assign, MachineOptions, State } from "xstate";
import { botMachineConfig, IBotMachineContext, BotMachineEvent, isEnterTextEvent, CalendarMachineEvent, ICalendarMachineContext, calendarMachineConfig } from "./machine";
import { getLocString, str2Language, Language, getLName, ILocString, stringResources, LName, getLName2 } from "./stringResources";
import { testNormalizeStr, testIdentStr, str2Date, isGr, isLs, isGrOrEq, date2str, isEq, validURL, pause, format2, format, normalizeStr, companyToIgnore, isIDateGrOrEq } from "./util/utils";
import { Menu, keyboardMenu, keyboardCalendar, keyboardSettings, keyboardLanguage, keyboardCurrency, keyboardWage, keyboardOther, keyboardCurrencyRates,
keyboardEnterAnnouncement, keyboardSendAnnouncement, mapUserRights, TestUserRightFunc, keyboardLogout, keyboardCanteenMenu, ICanteenMenuKeybord,
keyboardSendAnnouncementConfirmation, IUserRightDescr } from "./menu";
import { Semaphore } from "./semaphore";
import { getCurrRate, getCurrRateForDate } from "./currency";
import { ExtraEditMessage } from "telegraf/typings/telegram-types";
import { Logger, ILogger } from "./log";
import { getAccountLinkFN, getEmployeeFN, getCustomersFN, getPayslipFN, getAccDedFN, getAnnouncementsFN, getTimeSheetFN, getScheduleFN, getUserRightsFN, getCanteenMenuFN } from "./files";
import { hashELF64 } from "./hashELF64";
import { v4 as uuidv4 } from 'uuid';
import { hourTypes } from "./constants";
import { UserRights } from "./security";

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
  //Ищем начисление\удержание по ид и детальной информации
    const i = item.find( d => d.id === typeId && JSON.stringify(d.det) === JSON.stringify(det));
  if (i) {
    i.s += s;
  } else {
    item.push({ id: typeId, n, name, s, det, type: typeAccDed });
  }
};

export const getPinByPassportId = (personalNumber: string, payslipDate: Date) => hashELF64(
  `${(payslipDate.getMonth() + 1).toString().padStart(2, '0')}${payslipDate.getFullYear().toString().slice(-2)}${personalNumber.slice(0, 7)}`
).toString().slice(-4);

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
  return `[${det}]`;
}

/**
 * Получить строку  по начилению или удержанию с детальными данными.
 * @param dataItem
 * @param lng
 */
const getItemTemplate = (dataItem: IPayslipItem[], lng: Language): Template => dataItem
  .sort( (a, b) => a.n - b.n )
  .map( i => [`${getLName(i.name, [lng])}${i.det ? ' ' + getDetail(i.det, lng) : ''}: `.replace('(', '[').replace(')', ']'), i.s]
  );

//TODO: пробел (см выше) вставляется чтобы избежать грустного смайлика в вайбере
// но, он может вылезти в любой другой строке
// скорее всего надо переделать на анализ текста перед выводом в чат

const scheduleRestorer = (data: IData<Omit<IScheduleData, 'id'>>): IData<Omit<IScheduleData, 'id'>> =>
  Object.fromEntries(
    Object.entries(data)
      .map(
        ([key, schedule]) => [key, {
        ...schedule,
        data: schedule.data.map( i => ({...i, d: new Date(i.d)}) )}]
    )
  );

  const timeSheetRestorer = (data: IData<ITimeSheet>): IData<ITimeSheet> =>
    Object.fromEntries(
      Object.entries(data)
        .map(
          ([key, timesheet]) => [key, {
          ...timesheet,
          data: timesheet.data.map( i => ({...i, d: new Date(i.d)}) )}]
      )
    );

type ReplyFunc = (s: ILocString | string | Promise<string>, menu?: Menu | 'KEEP' | 'REMOVE', ...args: any[]) => ({ chatId, semaphore }: Pick<IBotMachineContext, 'chatId' | 'semaphore'>) => Promise<void>;

const inMainMenu = (state?: State<IBotMachineContext, BotMachineEvent, any, any>) => state?.value instanceof Object && state.value['mainMenu'] === 'showMenu';

export class Bot {
  private _telegramAccountLink: FileDB<IAccountLink>;
  private _viberAccountLink: FileDB<IAccountLink>;
  private _accountLanguage: { [id: string]: Language } = {};
  private _telegram: Telegraf<Context>;
  private _service: { [id: string]: Interpreter<IBotMachineContext, any, BotMachineEvent> } = {};
  private _telegramCalendarMachine: StateMachine<ICalendarMachineContext, any, CalendarMachineEvent>;
  private _telegramMachine: StateMachine<IBotMachineContext, any, BotMachineEvent>;
  private _employees: { [customerId: string]: FileDB<Omit<IEmployee, 'id'>> } = {};
  private _announcements: FileDB<Omit<IAnnouncement, 'id'>>;
  /**
   * Все права доступа храним в одном файле, где ключ -- идентификатор
   * предприятия. Права хранятся ввиде массива правил, задающих разрешения
   * или запреты на уровне отдельных пользователей и/или групп пользователей.
   *
   * Специальный ключ '*' задает глобальные права, для всех предприятий.
   */
  private _userRights: FileDB<UserRights>;
  private _customers: FileDB<Omit<ICustomer, 'id'>>;
  private _botStarted = new Date();
  private _callbacksReceived = 0;
  /**
   * справочники начислений/удержаний для каждого клиента.
   * ключем объекта выступает РУИД записи из базы Гедымина.
   */
  private _customerAccDeds: { [customerID: string]: FileDB<IAccDed> } = {};
  private _viber: any = undefined;
  private _viberCalendarMachine: StateMachine<ICalendarMachineContext, any, CalendarMachineEvent> | undefined = undefined;
  private _viberMachine: StateMachine<IBotMachineContext, any, BotMachineEvent> | undefined = undefined;
  private _logger: Logger;
  private _log: ILogger;
  private _replyTelegram: ReplyFunc;
  private _replyViber?: ReplyFunc;
  private _updateSemaphore: { [id: string]: Semaphore } = {};
  private _viberSemaphore: Semaphore = new Semaphore('viber');
  private _telegramSemaphore: Semaphore = new Semaphore('telegram');
  private _announcementSemaphore: Semaphore = new Semaphore('announcement');

  constructor(telegramToken: string, viberToken: string, logger: Logger) {
    this._logger = logger;
    this._log = this._logger.getLogger();

    this._customers = new FileDB<Omit<ICustomer, 'id'>>({ fn: getCustomersFN(), logger: this._log, watch: true });
    this._userRights = new FileDB<UserRights>({ fn: getUserRightsFN(), logger: this._log, watch: true });

    const annRestorer = (data: IData<Omit<IAnnouncement, 'id'>>): IData<Omit<IAnnouncement, 'id'>> => Object.fromEntries(
      Object.entries(data).map(
        ([key, announcement]) => [key, {
          ...announcement,
          date: new Date(announcement.date)
        }]
      )
    );

    this._announcements = new FileDB<Omit<IAnnouncement, 'id'>>({ fn: getAnnouncementsFN(), logger: this._log, restore: annRestorer });

    const ALRestorer = (data: IData<IAccountLink>): IData<IAccountLink> => Object.fromEntries(
      Object.entries(data).map(
        ([key, accountLink]) => [key, {
          ...accountLink,
          lastUpdated: accountLink.lastUpdated && new Date(accountLink.lastUpdated),
          payslipSentOn: accountLink.payslipSentOn && new Date(accountLink.payslipSentOn)
        }]
      )
    );

    this._telegramAccountLink = new FileDB<IAccountLink>({ fn: getAccountLinkFN('TELEGRAM'), logger: this._log, restore: ALRestorer });
    this._viberAccountLink = new FileDB<IAccountLink>({ fn: getAccountLinkFN('VIBER'), logger: this._log, restore: ALRestorer });

    /**************************************************************/
    /**************************************************************/
    /**                                                          **/
    /**  Telegram bot initialization                             **/
    /**                                                          **/
    /**************************************************************/
    /**************************************************************/

    this._replyTelegram = (s: ILocString | string | undefined | Promise<string>, menu: Menu | 'KEEP' | 'REMOVE' = 'REMOVE', ...args: any[]) => async ({ chatId, semaphore }: Pick<IBotMachineContext, 'chatId' | 'semaphore'>) => {
      if (!semaphore) {
        this._logger.error(chatId, undefined, 'No semaphore');
        return;
      }

      if (!chatId) {
        this._log.error('Invalid chatId');
        return;
      }

      await semaphore.acquire();
      try {
        const t = await s;
        const language = this._accountLanguage[this.getUniqId('TELEGRAM', chatId)] ?? 'ru';
        const accountLink = this._telegramAccountLink.read(chatId);

        let keyboard: ReturnType<typeof Markup.inlineKeyboard> | undefined;

        if (Array.isArray(menu)) {
          let fn: TestUserRightFunc | undefined;

          //FIXME: пока мы не зарегистрируемся права не будут проверяться?
          if (accountLink?.customerId && accountLink.employeeId) {
            fn = (ur: IUserRightDescr) => this._hasPermission(ur, accountLink.customerId, accountLink.employeeId);
          } else {
            fn = undefined;
          }

          keyboard = Markup.inlineKeyboard(mapUserRights(menu, fn)
            .map(r => r.map(
              c => c.type === 'BUTTON'
                ? Markup.callbackButton(getLocString(c.caption, language), c.command) as any
                : c.type === 'LINK'
                ? Markup.urlButton(getLocString(c.caption, language), c.url)
                : Markup.callbackButton(c.label, 'noop') as any
            ))
          );
        } else {
          keyboard = undefined;
        }

        let text = typeof t === 'string' ? t : t && getLocString(t, language, ...args);
        const extra: ExtraEditMessage = keyboard ? Extra.markup(keyboard) : {};

        if (text && text.slice(0, 7) === '^FIXED\n') {
          text = '```ini\n' + text.slice(7) + '\n```';
          extra.parse_mode = 'MarkdownV2';
        }

        if (!accountLink) {
          await this._telegramSemaphore.acquire();
          try {
            await this._telegram.telegram.sendMessage(chatId, text ?? '<<Empty message>>', extra);
          } finally {
            this._telegramSemaphore.release();
          }
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

        await this._telegramSemaphore.acquire();
        try {
          if (lastMenuId) {
            if (text && keyboard) {
              await editMessageReplyMarkup(true);
              const message = await this._telegram.telegram.sendMessage(chatId, text, extra);
              this._telegramAccountLink.merge(chatId, { lastMenuId: message.message_id });
            }
            else if (text && !keyboard) {
              if (menu === 'REMOVE') {
                await editMessageReplyMarkup(true);
                this._telegramAccountLink.merge(chatId, {}, ['lastMenuId']);
              }
              await this._telegram.telegram.sendMessage(chatId, text, extra);
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
        } finally {
          this._telegramSemaphore.release();
        }
      } catch (e: any) {
        // TODO: где-то здесь отловится ошибка, если чат был пользователем удален
        // а мы пытаемся слать в него сообщения. надо определить ее код и удалять
        // запись из акаунт линк.
        // аналогично обрабатываться в функции reply для вайбера
        this._logger.error(chatId, undefined, e);
        //Если чат был заблокирован, то удалим запись из аккаунта
        if (e.code === 403) {
          this._telegramAccountLink.delete(chatId);
          delete this._service[this.getUniqId('TELEGRAM', chatId)];
          this._logger.info(chatId, undefined, `Chat was deleted`);
        }
      } finally {
        semaphore.release();
      }
    };

    const calendarMachineOptions = (reply: ReplyFunc): Partial<MachineOptions<ICalendarMachineContext, CalendarMachineEvent>> => ({
      actions: {
        showSelectedDate: ctx => reply(stringResources.showSelectedDate, 'REMOVE', ctx.selectedDate)(ctx),
        showCalendar: ({ chatId, semaphore, selectedDate, dateKind }, { type }) => type === 'CHANGE_YEAR'
          ? reply(stringResources.selectYear, keyboardCalendar(selectedDate.year), selectedDate.year)({ chatId, semaphore })
          : reply(dateKind === 'PERIOD_1_DB'
              ? stringResources.selectDB
              : dateKind === 'PERIOD_1_DE'
              ? stringResources.selectDE
              : dateKind === 'PERIOD_MONTH'
              ? stringResources.selectMonth
              : stringResources.selectDB2, keyboardCalendar(selectedDate.year)
            )({ chatId, semaphore })
      }
    });

    this._telegramCalendarMachine = Machine<ICalendarMachineContext, CalendarMachineEvent>(calendarMachineConfig,
      calendarMachineOptions(this._replyTelegram));

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
      const { accountLink, platform, ...rest } = checkAccountLink(ctx);
      const { dateBegin, dateEnd, dateBegin2 } = ctx;
      const { customerId, employeeId, language, currency } = accountLink;
      reply(this.getPayslip(customerId, employeeId, payslipType, language ?? 'ru', currency ?? 'BYN', platform, dateBegin, dateEnd, dateBegin2))(rest);
    };

    const getShowLatestPayslipFunc = (reply: ReplyFunc) => async (ctx: IBotMachineContext) => {
      const { accountLink, platform, ...rest } = checkAccountLink(ctx);
      const { customerId, employeeId, language, currency } = accountLink;
      const lastPaySlipDate = this._getLastPayslipDate(customerId, employeeId);
      if (lastPaySlipDate) {
        const lastPaySlipDateStr: IDate = {year: lastPaySlipDate.getFullYear(), month: lastPaySlipDate.getMonth()};
        reply(this.getPayslip(customerId, employeeId, 'CONCISE', language ?? 'ru', currency ?? 'BYN', platform, lastPaySlipDateStr, lastPaySlipDateStr))(rest);
      }
    };

    /**
     * Получаем список меню (подразделение -- тип меню) для выбора
     * @param reply
     */

    const getShowCanteenMenuFunc = (reply: ReplyFunc) => async (ctx: IBotMachineContext) => {
      const { accountLink, platform, ...rest } = checkAccountLink(ctx);
      const { customerId, language } = accountLink;
      const lng = language ?? 'ru';
      const date = new Date();
      try {
        const menu = this._getCanteenMenu(customerId, date2str(date, 'YYYY.MM.DD'));

        if (menu) {
          const canteenMenus: ICanteenMenuKeybord[] = menu.map(m => ({ id: m.id, menu: m.name }));
          await reply(stringResources.canteenMenu, keyboardCanteenMenu(canteenMenus))(rest);
        }

      } catch(e) {
        await this._logger.error(ctx.chatId, undefined, e);
        await reply(`${getLocString(stringResources.noData, lng)}`)(rest);
      }
    };

    /**
     * Получаем состав меню для вывода на экран в валюте
     * @param reply
     */
    const getShowCanteenMenuTextFunc = (reply: ReplyFunc) => async (ctx: IBotMachineContext) => {
      const { accountLink, platform, semaphore, chatId, ...rest } = checkAccountLink(ctx);
      const { customerId, language, currency } = accountLink;
      const lng = language ?? 'ru';
      const date = new Date();
      const { canteenMenuId } = ctx;
      const menu = this._getCanteenMenu(customerId, date2str(date, 'YYYY.MM.DD'))?.find( m => m.id === canteenMenuId );

      await semaphore?.acquire();
      try {
        if (menu) {
          const rate = ((currency && currency !== 'BYN') ? await getCurrRateForDate(date, currency, this._log) : 1) ?? 1;
          const menuTitle = getLocString(stringResources.menuTitle, lng, date);
          const menuName = getLocString(menu.name, lng);
          const formatList = [
            `${menuTitle}${menuName}${rate !== 1 ? '\n' + getLocString(stringResources.canteenMenuCurrency, lng, currency, date, rate) : ''}`,
            ...menu.data
              .sort( (a, b) => a.n - b.n )
              .map( m => [
                getLocString(m.group, lng),
                m.groupdata
                  .sort( (a, b) => getLocString(a.good, lng).localeCompare(getLocString(b.good, lng)) )
                  .map( gr => `  ${format2(gr.cost / rate)} ${getLocString(gr.good, lng).substring(0, 40)}${gr.det ? ', ' + gr.det : ''}`),
                ''
              ])
          ].flat(5);

          const maxLength = platform === 'VIBER' ? 1000 : 4000; // TODO: сделать константы для VIBER и TELEGRAM
          let msg = '';

          const replyMsg = async () => {
            await reply('^FIXED\n' + msg.substring(0, maxLength))({ chatId, semaphore: new Semaphore(`Temp for chatId: ${chatId}`) })
            await pause(200);
          };

          for (let i = 0; i < formatList.length; i++) {
            let newMsg = msg + formatList[i] + '\n';

            // второе условие, чтобы обработать ситуацию, когда попадется одна строка длиннее лимита месенджера
            if (newMsg.length > maxLength && msg) {
              await replyMsg();
              msg = formatList[i] + '\n';
            } else {
              msg = newMsg;
            }
          }

          if (msg) {
            await replyMsg();
          }
        } else {
          await reply(stringResources.noCanteenDataToday)({ chatId, semaphore: new Semaphore(`Temp for chatId: ${chatId}`) });
        }
      } catch(e) {
        await this._logger.error(ctx.chatId, undefined, e);
      } finally {
        semaphore?.release();
      }
    };

    const getShowBirthdaysFunc = (reply: ReplyFunc) => async (ctx: IBotMachineContext) => {
      const { accountLink, ...rest } = checkAccountLink(ctx);
      const { customerId, language } = accountLink;
      const employees = this._getEmployees(customerId).getMutable(false);

      //Получим последние данные по сотруднику и вычислим подразделение
      const getDepartment = (employeeId: string) => {
        const lastPayslipDE = this._getLastPayslipDate(customerId, employeeId);
        if (lastPayslipDE) {
          const data = this._getPayslipData(customerId, employeeId, { year: lastPayslipDE.getFullYear(), month: lastPayslipDE.getMonth() });
          if (data) {
            return `\n${getLName(data.department, [language ?? 'ru'])}`;
          }
        }
        return '';
      };

      const today = new Date();
      const todayD = today.getDate();
      const todayM = today.getMonth();

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowD = tomorrow.getDate();
      const tomorrowM = tomorrow.getMonth();

      const birthdayToday = Object.entries(employees).filter(
        ([_, { birthday }]) => {
          const d = birthday && str2Date(birthday);
          return d && d.getDate() === todayD && d.getMonth() === todayM;
        }
      );

      const birthdayTomorrow = Object.entries(employees).filter(
        ([_, { birthday }]) => {
          const d = birthday && str2Date(birthday);
          return d && d.getDate() === tomorrowD && d.getMonth() === tomorrowM;
        }
      );

      try {
        const formatList = (l: typeof birthdayToday) => l
          .sort(
            (a, b) => a[1].lastName.localeCompare(b[1].lastName)
          )
          .map(
            ([id, { firstName, lastName, patrName}]) => `${lastName} ${firstName} ${patrName ?? ''}${getDepartment(id)}`
          )
          .join('\n\n');

        const lng = language ?? 'ru';
        let text = '';

        if (birthdayToday.length) {
          text = `🎂 ${getLocString(stringResources.todayBirthday, lng)} ${date2str(today, 'DD.MM.YYYY')}:\n\n${formatList(birthdayToday)}\n\n`;
        }

        if (birthdayTomorrow.length) {
          text += `🎁 ${getLocString(stringResources.tomorrowBirthday, lng)} ${date2str(tomorrow, 'DD.MM.YYYY')}:\n\n${formatList(birthdayTomorrow)}`;
        }

        await reply(text || getLocString(stringResources.noBirthdays, lng))(rest);
      } catch(e) {
        await this._logger.error(ctx.chatId, undefined, e);
        await reply('Unable to get data on employees birthdays...')(rest);
      }
    };

    /**
     * Вывести сообщение по нажатию на меню Курсы валют
     * @param reply
     */
    const getShowCurrencyRatesForMonthFunc = (reply: ReplyFunc) => async (ctx: IBotMachineContext) => {
      const { currencyDate, currencyId, semaphore, chatId } = ctx;

      if (!currencyId) {
        return;
      }

      const { accountLink } = checkAccountLink(ctx);

      await semaphore?.acquire();
      try {
        const { language } = accountLink;
        const rates: string[] = [];
        const daysInMonth = new Date(currencyDate.year, currencyDate.month + 1, 0).getDate();

        for (let i = 1; i <= daysInMonth; i++) {
          const date = new Date(currencyDate.year, currencyDate.month, i);
          const rate = await getCurrRateForDate(date, currencyId, this._log);
          if (rate) {
            rates.push(`${date2str(date, 'DD.MM.YYYY')} -- ${rate}`);
          }
        }

        const lng = language ?? 'ru';
        const text = rates.join('\n');

        await reply(text
          ? `${getLocString(stringResources.ratesForMonth, lng, currencyId, currencyDate)}\n${text}`
          : getLocString(stringResources.cantLoadRate, lng, currencyId)
          )({ chatId, semaphore: new Semaphore(`Temp for chatId: ${chatId}`) });
      } finally {
        semaphore?.release();
      }
    };

    /**
     * Вывести сообщение по нажатию на меню Табель
     * @param reply
     */
    const getShowTableFunc = (reply: ReplyFunc) => async (ctx: IBotMachineContext) => {
      const { accountLink, platform, ...rest } = checkAccountLink(ctx);
      const { tableDate } = ctx;
      const { customerId, employeeId, language } = accountLink;
      const lng = language ?? 'ru';

      try {
        const timeSheet = new FileDB<ITimeSheet>({ fn: getTimeSheetFN(customerId, employeeId), logger: this._log, restore: timeSheetRestorer })
          .read(employeeId);

        if (!timeSheet) {
          await reply(getLocString(stringResources.noData, lng))(rest);
        } else {
          const table = timeSheet.data.filter(
            ({ d }) => d.getFullYear() === tableDate.year && d.getMonth() === tableDate.month
          );

          const formatList = table
            .sort(
              (a, b) => a.d.getTime() - b.d.getTime()
            )
            .map(
              ({ d, h, t}) =>
                `${d.getDate().toString().padStart(2, '0')}, ${d.toLocaleString(lng, {weekday: 'short'})},${t ? ' ' + getLocString(hourTypes[t], lng) : ''}${h ? ' ' + h : ''}${d.getDay() ? '': '\n   ***'}`
            )
            .join('\n');

          const text = '^FIXED\n' + (formatList ? `${getLocString(stringResources.tableTitle, lng, tableDate)}${formatList}` : getLocString(stringResources.noData, lng));

          await reply(text)(rest);
        }
      } catch(e) {
        await this._logger.error(ctx.chatId, undefined, e);
        await reply(`${getLocString(stringResources.noData, lng)} Period: ${tableDate.month}.${tableDate.month}.`)(rest);
      }
    };

    /**
     * Вывести сообщение по нажатию на меню График
     * @param reply
     */
    const getShowScheduleFunc = (reply: ReplyFunc) => async (ctx: IBotMachineContext) => {
      const { accountLink, platform, ...rest } = checkAccountLink(ctx);
      const { scheduleDate } = ctx;
      const { customerId, employeeId, language } = accountLink;
      const lng = language ?? 'ru';

      try {
        const schedule = this._getSchedule(customerId, employeeId, new Date(scheduleDate.year, scheduleDate.month + 1, 0));

        if (!schedule) {
          await reply(getLocString(stringResources.noData, lng))(rest);
        } else {
          const sheduleData = schedule.data.filter(
            ({ d }) => d.getFullYear() === scheduleDate.year && d.getMonth() === scheduleDate.month
          );

          const formatList = sheduleData
            .sort(
              (a, b) => a.d.getTime() - b.d.getTime()
            )
            .map(
              ({ d, h, t}) =>
                `${d.getDate().toString().padStart(2, '0')}, ${d.toLocaleString(lng, {weekday: 'short'})},${t ? ' ' + getLocString(hourTypes[t], lng) : ''}${h ? ' ' + h : ''}${d.getDay() === 0 ? '\n   ***' : ''}`
            )
            .join('\n');

          const text = '^FIXED\n' + (formatList ? `${getLocString(stringResources.scheduleTitle, lng, scheduleDate)}${getLName(schedule.name, [lng])}\n${formatList}` : getLocString(stringResources.noData, lng));

          await reply(text)(rest);
        }
      } catch(e) {
        await this._logger.error(ctx.chatId, undefined, e);
        await reply(`${getLocString(stringResources.noData, lng)} Period: ${scheduleDate.month}.${scheduleDate.month}.`)(rest);
      }
    };

    const machineOptions = (reply: ReplyFunc): Partial<MachineOptions<IBotMachineContext, BotMachineEvent>> => ({
      actions: {
        askCompanyName: reply(stringResources.askCompanyName),
        unknownCompanyName: (ctx) => {
          reply(stringResources.unknownCompanyName, undefined,
            Object.entries(this._customers.getMutable(false))
              .filter(([id, customer]) => !companyToIgnore.includes(id))
              .map(([id, customer]) => {
                const s = normalizeStr(customer.name) ?? '';
                return(s.substr(0,1).toLocaleUpperCase() + s.substr(1))
              })
            .sort((a, b) => a > b ? 1 : -1).join('\n'))(ctx);
        },
        unknownEmployee: reply(stringResources.unknownEmployee),
        askPIN: ctx => {
          const { customerId, employeeId } = ctx;
          if (customerId && employeeId) {
            reply(stringResources.askPIN, undefined, this._getLastPayslipDate(customerId, employeeId))(ctx);
          } else {
            throw new Error('customerId or employeeId are not assigned');
          }
        },
        invalidPIN: ctx => {
          const { customerId, employeeId } = ctx;
          if (customerId && employeeId) {
            reply(stringResources.invalidPIN, undefined, this._getLastPayslipDate(customerId, employeeId))(ctx);
          } else {
            throw new Error('customerId or employeeId are not assigned');
          }
        },
        assignCompanyId: assign<IBotMachineContext, BotMachineEvent>({ customerId: this._findCompany }),
        assignEmployeeId: assign<IBotMachineContext, BotMachineEvent>({ employeeId: this._findEmployee }),
        askPersonalNumber: reply(stringResources.askPersonalNumber),
        showMainMenu: (ctx, event) => {
          if (event.type !== 'MAIN_MENU' || event.forceMainMenu) {
            reply(stringResources.mainMenuCaption, keyboardMenu)(ctx);
          }
        },
        showWage: reply(stringResources.mainMenuCaption, keyboardWage),
        showOther: reply(stringResources.mainMenuCaption, keyboardOther),
        enterAnnouncementInvitation: reply(stringResources.enterAnnouncementInvitation, keyboardEnterAnnouncement),
        sendAnnouncementMenu: reply(stringResources.sendAnnouncementMenuCaption, keyboardSendAnnouncement),
        sendConfirmation: reply(stringResources.sendAnnouncementConfirmation, keyboardSendAnnouncementConfirmation),
        showDiagnostics: (ctx, event) => {
          if (event.type === 'MAIN_MENU' && event.diagnostics) {
             reply(event.diagnostics)(ctx);
          }
        },
        sendAnnouncement: async ctx => {
          const { customerId, employeeId, announcement, chatId, semaphore, platform, announcementType } = ctx;

          if (customerId && employeeId && announcement && chatId && platform && announcementType) {
            if (announcementType === 'DEPARTMENT' && !this._hasPermission({ userRightId: 'ANN_DEPT', forReading: false, defRight: true }, customerId, employeeId)) {
              this._logger.error(chatId, undefined, 'Access denied for sending announcement to department.')
              return;
            }

            if (announcementType === 'ENTERPRISE' && !this._hasPermission({ userRightId: 'ANN_ENT', forReading: false, defRight: false }, customerId, employeeId)) {
              this._logger.error(chatId, undefined, 'Access denied for sending announcement to enterprise.')
              return;
            }

            if (announcementType === 'GLOBAL' && !this._hasPermission({ userRightId: 'ANN_GLOBAL', forReading: false, defRight: false }, customerId, employeeId)) {
              this._logger.error(chatId, undefined, 'Access denied for sending global announcement.')
              return;
            }

            await semaphore?.acquire();
            try {
              const department = this._getDepartment(customerId, employeeId);
              const language = this._accountLanguage[this.getUniqId(platform, chatId)] ?? 'ru';
              const employee = customerId && employeeId && this._getEmployee(customerId, employeeId);
              const employeeName = employee
                ? `${employee.lastName} ${employee.firstName.slice(0, 1)}. ${employee.patrName ? employee.patrName.slice(0, 1) + '.' : ''}`
                : 'Bond, James Bond';
              const creditedAnnouncement = announcementType === 'GLOBAL' ? announcement : `${announcement}\n\n${getLocString(stringResources.sentBy, language)} ${employeeName}`;

              this._announcements.write(uuidv4(), {
                date: new Date(),
                fromCustomerId: customerId,
                fromEmployeeId: employeeId,
                toCustomerId: announcementType === 'GLOBAL' ? undefined : customerId,
                toDepartmentId: announcementType === 'DEPARTMENT' ? department?.id : undefined,
                body: creditedAnnouncement
              });

              await this._logger.info(chatId, undefined, `Start sending announcement. type=${announcementType}.`);
              await reply(stringResources.startSendingAnnouncements)({ chatId, semaphore: new Semaphore('start sending announcement') });

              let cnt = 0;
              let timeouted = 0;

              const sendToAccounts = async (replyFunc: ReplyFunc, accountLink: IData<IAccountLink>, getUniqId: (cId: string) => string) => {
                for (const [linkChatId, link] of Object.entries(accountLink)) {
                  if (linkChatId === chatId) {
                    continue;
                  }

                  if (announcementType === 'DEPARTMENT' && (link.customerId !== customerId || this._getDepartment(customerId, link.employeeId)?.id !== department?.id)) {
                    continue;
                  }

                  if (announcementType === 'ENTERPRISE' && link.customerId !== customerId) {
                    continue;
                  }

                  /**
                    * Мы пытаемся избежать ситуации, когда пользователь был в процессе диалога
                    * и тут мы ему вылезли под руку со своим сообщением.
                    *
                    * 1) Если активной машины нет для этого чата, то можем слать. Все равно состояние
                    *    пользователя скинется в главное меню при очередном подключении.
                    * 2) Если машина есть, но состояние "главное меню", то тоже шлем сразу.
                    * 3) Если состояние не главное меню и активность последняя была больше часа назад,
                    *    то шлем.
                    * 4) Если активность была менее часа назад, то выждем 5 минут и тогда опять запустим проверку.
                    * 5) При этом, если акаунт линк почему-то все время обновляется, мы не хотели бы допустить
                    *    бесконечных попыток отправить сообщение. Ограничем количество пятью.
                    */

                  const fn = async (countDown: number) => {
                    const service = this._service[getUniqId(linkChatId)];
                    const anHourAgo = Date.now() - 60 * 60 * 1000;

                    if (
                      !countDown
                      ||
                      !service
                      ||
                      inMainMenu(service?.state)
                      ||
                      (link.lastUpdated?.getTime() ?? 0) < anHourAgo
                    ) {
                      await this._announcementSemaphore.acquire();
                      try {
                        await replyFunc(creditedAnnouncement, 'KEEP')({ chatId: linkChatId, semaphore: new Semaphore('temp for announcement') });
                        await pause(50);
                        cnt++;
                      }
                      finally {
                        this._announcementSemaphore.release();
                      }
                    } else {
                      timeouted++;
                      setTimeout( () => { timeouted--; fn(countDown - 1); }, 5 * 60 * 1000 );
                    }
                  };

                  await fn(5);
                }
              };

              await sendToAccounts(this._replyTelegram, this._telegramAccountLink.getMutable(false), (cId: string) => this.getUniqId('TELEGRAM', cId));

              if (this._replyViber) {
                await sendToAccounts(this._replyViber, this._viberAccountLink.getMutable(false), (cId: string) => this.getUniqId('VIBER', cId));
              }

              await reply(stringResources.endSendingAnnouncements, undefined, cnt)({ chatId, semaphore: new Semaphore('end sending announcement') });
              await this._logger.info(chatId, undefined, `End sending announcement. type=${announcementType}. sent=${cnt}. timeouted=${timeouted}`);
            }
            finally {
              semaphore?.release();
            }
          }
        },
        showBirthdays: getShowBirthdaysFunc(reply),
        showCanteenMenuText: getShowCanteenMenuTextFunc(reply),
        showCanteenMenu: getShowCanteenMenuFunc(reply),
        showNoMenuData: ctx => {
          const { ...rest } = checkAccountLink(ctx);
          const { customerId } = ctx;
          //Если файлы по меню столовой есть, но еще не загружено на сегодня
          if (customerId && this._getCanteenLastDate(customerId)) {
            reply(stringResources.noCanteenDataToday)(rest);
          } else {
            //Если нет файлов меню
            reply(stringResources.noCanteenData)(rest);
          }
        },
        showPayslip: getShowPayslipFunc('CONCISE', reply),
        showLatestPayslip: getShowLatestPayslipFunc(reply),
        showDetailedPayslip: getShowPayslipFunc('DETAIL', reply),
        showPayslipForPeriod: getShowPayslipFunc('DETAIL', reply),
        showComparePayslip: getShowPayslipFunc('COMPARE', reply),
        showTable: getShowTableFunc(reply),
        showSchedule: getShowScheduleFunc(reply),
        showSettings: ctx => {
          const { accountLink, ...rest } = checkAccountLink(ctx);
          const { customerId, employeeId } = ctx;
          const employee = customerId && employeeId && this._getEmployee(customerId, employeeId);
          const employeeName = employee
            ? `${employee.lastName} ${employee.firstName.slice(0, 1)}. ${employee.patrName ? employee.patrName.slice(0, 1) + '.' : ''}`
            : 'Bond, James Bond';
          const departmentName = (customerId && employeeId && getLName2(this._getDepartment(customerId, employeeId)?.name)) ?? 'MI6';
          reply(stringResources.showSettings, keyboardSettings, employeeName, departmentName, accountLink.language ?? 'ru', accountLink.currency ?? 'BYN')(rest);
        },
        logout: async (ctx) => {
          const { platform, chatId } = ctx;
          if (platform && chatId) {
            await reply(stringResources.goodbye)(ctx);
            const accountLinkDB = platform === 'TELEGRAM' ? this._telegramAccountLink : this._viberAccountLink;
            accountLinkDB.delete(chatId);
            delete this._service[this.getUniqId(platform, chatId)];
          }
        },
        showLogoutMessage: reply(stringResources.logoutMessage, keyboardLogout),
        showSelectLanguageMenu: reply(stringResources.selectLanguage, keyboardLanguage),
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
        showSelectCurrencyMenu: reply(stringResources.selectCurrency, keyboardCurrency),
        showSelectCurrencyRatesMenu: reply(stringResources.selectCurrency, keyboardCurrencyRates),
        showCurrencyRatesForMonth: getShowCurrencyRatesForMonthFunc(reply),
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
        checkPIN: ({ customerId, employeeId }, event) => {
          if (isEnterTextEvent(event) && customerId && employeeId) {
            const employee = this._getEmployee(customerId, employeeId);
            const lastPayslipDate = this._getLastPayslipDate(customerId, employeeId);
            if (employee && lastPayslipDate) {
              return event.text === getPinByPassportId(employee.passportId, lastPayslipDate);
            }
          }
          return false;
        },
        isProtected: ({ customerId }) => customerId
          ? !!(this._customers.read(customerId)?.protected)
          : false,
        isThereMenuData: ({ customerId }) =>  customerId
          ? !!this._getCanteenMenu(customerId, date2str(new Date(), 'YYYY.MM.DD'))
          : false
      }
    });

    this._telegramMachine = Machine<IBotMachineContext, BotMachineEvent>(botMachineConfig(this._telegramCalendarMachine),
      machineOptions(this._replyTelegram));

    this._telegram = new Telegraf(telegramToken);

    this._telegram.start(
      (ctx) => {
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
      (ctx) => {
        if (!ctx.chat) {
          this._log.error('Invalid chat context');
        }
        else if (ctx.message?.text === undefined) {
          this._logger.error(ctx.chat.id.toString(), ctx.from?.id.toString(), 'Message text is undefined');
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
      (ctx) => {
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
      this._replyViber = (s: ILocString | string | undefined | Promise<string>, menu: Menu | 'KEEP' | 'REMOVE' = 'REMOVE', ...args: any[]) => async ({ chatId, semaphore }: Pick<IBotMachineContext, 'platform' | 'chatId' | 'semaphore'>) => {
        if (!semaphore) {
          this._logger.error(chatId, undefined, 'No semaphore');
          return;
        }

        if (!chatId) {
          this._log.error('Invalid chatId');
          return;
        }

        await semaphore.acquire();
        try {
          //TODO: кусок кода ниже повторяется в телеграме
          const t = await s;
          const language = this._accountLanguage[this.getUniqId('VIBER', chatId)] ?? 'ru';
          const accountLink = this._viberAccountLink.read(chatId);

          let keyboard: any;

          if (Array.isArray(menu)) {
            let fn: TestUserRightFunc | undefined;

            if (accountLink?.customerId && accountLink.employeeId) {
              fn = (ur: IUserRightDescr) => this._hasPermission(ur, accountLink.customerId, accountLink.employeeId);
            } else {
              fn = undefined;
            }

            keyboard = this._menu2ViberMenu(mapUserRights(menu, fn), language);
          } else {
            keyboard = undefined;
          }

          let text = typeof t === 'string' ? t : t && getLocString(t, language, ...args);

          if (text && text.slice(0, 7) === '^FIXED\n') {
            text = text.slice(7);
          }

          await this._viberSemaphore.acquire();
          try {
            if (keyboard) {
              const res = await this._viber.sendMessage({ id: chatId }, [new TextMessage(text), new KeyboardMessage(keyboard)]);
              if (!Array.isArray(res)) {
                this._logger.warn(chatId, undefined, JSON.stringify(res));
              }
            } else {
              await this._viber.sendMessage({ id: chatId }, [new TextMessage(text)]);
            }
          } finally {
            this._viberSemaphore.release();
          }
        } catch (e) {
          this._logger.error(chatId, undefined, e);
        } finally {
          semaphore.release();
        }
      };

      this._viberCalendarMachine = Machine<ICalendarMachineContext, CalendarMachineEvent>(calendarMachineConfig,
        calendarMachineOptions(this._replyViber));

      this._viberMachine = Machine<IBotMachineContext, BotMachineEvent>(botMachineConfig(this._viberCalendarMachine),
        machineOptions(this._replyViber));

      this._viber = new ViberBot({
        authToken: viberToken,
        name: 'Моя зарплата',
        avatar: ''
      });

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

      this._viber.on(BotEvents.UNSUBSCRIBED, (chatId: any) => {
        if (chatId) {
          this._viberAccountLink.delete(chatId);
          delete this._service[this.getUniqId('VIBER', chatId)];
          this._logger.info(chatId, undefined, 'User unsubscribed.');
        }
      });
    }
  }

  get viber() {
    return this._viber;
  }

  private _hasPermission(ur: IUserRightDescr, customerId: string, employeeId: string) {

    const check = (rules?: UserRights) => {
      if (rules) {
        const filtered = rules.filter( r => r.rights.includes(ur.userRightId) );

        for (const r of filtered) {
          if (r.users?.includes(employeeId)) {
            if (ur.forReading) {
              if (r.read !== undefined) {
                return r.read;
              }
            } else {
              if (r.write !== undefined) {
                return r.write;
              }
            }
          }
        }

        for (const r of filtered) {
          if (r.eneryone) {
            if (ur.forReading) {
              if (r.read !== undefined) {
                return r.read;
              }
            } else {
              if (r.write !== undefined) {
                return r.write;
              }
            }
          }
        }
      }

      return undefined;
    };

    const custPermission = check(this._userRights.read(customerId));

    if (custPermission !== undefined) {
      return custPermission;
    }

    const globalPermission = check(this._userRights.read('*'));

    if (globalPermission !== undefined) {
      return globalPermission;
    }

    return ur.defRight;
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
            Silent: true
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
      const db = new FileDB<Omit<IEmployee, 'id'>>({ fn: getEmployeeFN(customerId), logger: this._log });
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

  private _getCanteenMenu(customerId: string, date: string) {
    date = customerId === 'test' ? '2020.07.28' : date;
    return new FileDB<ICanteenMenus>({ fn: getCanteenMenuFN(customerId), logger: this._log })
      .read(date);
  }

  private _getDepartment(customerId: string, employeeId: string) {
    const payslip = new FileDB<IPayslip>({ fn: getPayslipFN(customerId, employeeId), logger: this._log })
      .read(employeeId);

    if (payslip?.dept.length) {
      const history = payslip.dept;
      let department = history[0];

      for (const curr of history) {
        if (isGr(str2Date(curr.d), str2Date(department.d))) {
          department = curr;
        }
      }

      return department;
    }

    return undefined;
  }

  /**
   * Получить график рабочего времени по сотруднику за месяц
   * @param customerId
   * @param employeeId
   * @param de
   */
  private _getSchedule(customerId: string, employeeId: string, de: Date) {
    const schedules = new FileDB<Omit<IScheduleData, 'id'>>({ fn: getScheduleFN(customerId), logger: this._log, restore: scheduleRestorer });
    const payslip = new FileDB<IPayslip>({ fn: getPayslipFN(customerId, employeeId), logger: this._log })
      .read(employeeId);

    if (!payslip) {
      return undefined;
    }

    // График получаем из массива графиков schedule,
    // как первый элемент с максимальной датой, но меньший даты окончания запрашиваемоего периода

    if (!payslip.schedule.length) {
      const msg = `Missing schedules arrays in user data. cust: ${customerId}, empl: ${employeeId}`;
      this._log.error(msg);
      return undefined;
    }

    let scheduleId = payslip.schedule[0].id;
    let maxDate = str2Date(payslip.schedule[0].d);

    for (const schedule of payslip.schedule) {
      const scheduleD = str2Date(schedule.d);
      if (isGr(scheduleD, maxDate) && isLs(scheduleD, de)) {
        scheduleId = schedule.id;
        maxDate = scheduleD;
      }
    }

    return schedules && schedules.read(scheduleId);
  }

  private _findCompany = (_: any, event: BotMachineEvent) => {
    if (isEnterTextEvent(event)) {
      for (const [companyId, { aliases }] of Object.entries(this._customers.getMutable(false))) {
        if (aliases.find( alias => testNormalizeStr(alias, event.text) )) {
          return companyId;
        }
      }

      this._log.warn(`Unknown enterprise: ${event.text}`);
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

  /**
   * Возвращает дату окончания периода последнего расчетного листка.
   * @param customerId
   * @param employeeId
   */
  private _getLastPayslipDate = (customerId: string, employeeId: string) => {
    const employee = customerId && employeeId && this._getEmployee(customerId, employeeId);

    if (employee) {
      const payslip = new FileDB<IPayslip>({ fn: getPayslipFN(customerId, employeeId), logger: this._log })
        .read(employeeId);

      if (payslip?.data[0]?.de) {
        let maxPayslipDate = str2Date(payslip.data[0].de);

        for (const { de } of payslip.data) {
          const paySlipD = str2Date(de);
          if (isGr(paySlipD, maxPayslipDate)) {
            maxPayslipDate = paySlipD;
          }
        }

        return maxPayslipDate;
      }
    }
    return undefined;
  }

  private _getPayslipLastDate = (customerId: string) => {
    const employeeId: string = Object.entries(this._getEmployees(customerId).getMutable(false))[0][0];
    const date = this._getLastPayslipDate(customerId, employeeId);
    return date && date2str(date, 'DD.MM.YYYY');
  }

  private _getCanteenLastDate = (customerId: string) => {
    const menu = new FileDB<ICanteenMenus>({ fn: getCanteenMenuFN(customerId), logger: this._log }).getMutable(false);
    const canteen = Object.entries(menu)[0];
    return canteen && date2str(str2Date(canteen[0]), 'DD.MM.YYYY');
  }

  private _getPayslipData(customerId: string, employeeId: string, mb: IDate, me?: IDate): IPayslipData | undefined {
    const payslip = new FileDB<IPayslip>({ fn: getPayslipFN(customerId, employeeId), logger: this._log })
      .read(employeeId);

    if (!payslip) {
      return undefined;
    }

    let accDed = this._customerAccDeds[customerId];

    if (!accDed) {
      accDed = new FileDB<IAccDed>({ fn: getAccDedFN(customerId), logger: this._log });
      this._customerAccDeds[customerId] = accDed;
    };

    const accDedObj = accDed.getMutable(false);

    const db = new Date(mb.year, mb.month);
    const de = me ? new Date(me.year, me.month + 1) : new Date(mb.year, mb.month + 1);

    // Подразделение получаем из массива подразделений dept,
    // как первый элемент с максимальной датой, но меньший даты окончания расч. листка
    // Аналогично с должностью из массива pos

    if (!payslip.dept.length || !payslip.pos.length || !payslip.payForm.length || !payslip.salary.length) {
      const msg = `Missing departments, positions, payforms or salary arrays in user data. cust: ${customerId}, empl: ${employeeId}`;
      this._log.error(msg);
      throw new Error(msg);
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
      privilage: [],
      saldo: []
    } as IPayslipData;

    //Цикл по всем записям начислений-удержаний
    for (const value of Object.values(payslip.data)) {
      const valueDB = str2Date(value.db);
      const valueDE = str2Date(value.de);
      if (isGrOrEq(valueDB, db) && isLs(valueDE, de)) {
        const { det, s, typeId } = value;

        if (!accDedObj[typeId]) {
          if (typeId === 'saldo') {

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
          case 'SALDO':
            fillInPayslipItem(data.saldo, typeId, name, s, det, n);
            break;
        }
      }
    };

    return (data.saldo?.length || data.accrual?.length || data.deduction?.length) ? data : undefined;
  };

  private _calcPayslipByRate(data: IPayslipData, rate: number) {
    const { saldo, tax, advance, deduction, accrual, tax_deduction, privilage, salary, hourrate, ...rest } = data;
    return {
      ...rest,
      saldo: saldo && saldo.map( i => ({ ...i, s: i.s / rate }) ),
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
    const saldo = sumPayslip(data.saldo);

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
      [saldo > 0 ? stringResources.payslipPayroll : stringResources.payslipPayrollDebt, Math.abs(saldo)],
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
    const saldo = sumPayslip(data.saldo);
    const saldo2 = sumPayslip(data2.saldo);

    return [
      stringResources.comparativePayslipTitle,
      //employeeName,
      periodName,
      currencyName,
      data.hourrate ? stringResources.payslipHpr : stringResources.payslipSalary,
      data.hourrate ? [data.hourrate ?? 0, data2.hourrate ?? 0, (data2.hourrate ?? 0) - (data.hourrate ?? 0)] : [data.salary ?? 0, data2.salary ?? 0, ((data2.salary ?? 0) - (data.salary ?? 0))],
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
      (saldo2 - saldo) > 0 ? stringResources.payslipPayrollDetail : stringResources.payslipPayrollDebtDetail,
      [saldo, saldo2, Math.abs(saldo2 - saldo)],
      '=',
      stringResources.payslipTaxes,
      [taxes, taxes2, taxes2 - taxes]
    ];
  }

  private _formatDetailedPayslip(data: IPayslipData, lng: Language, periodName: string, currencyName: string): Template {
    const accruals = sumPayslip(data.accrual);
    const taxes = sumPayslip(data.tax);
    const deds = sumPayslip(data.deduction);
    const advances = sumPayslip(data.advance);
    const taxDeds = sumPayslip(data.tax_deduction);
    const privilages = sumPayslip(data.privilage);
    const saldo = sumPayslip(data.saldo);

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
      saldo ? '=' : '',
      [saldo > 0 ? stringResources.payslipPayrollDetail : stringResources.payslipPayrollDebtDetail, Math.abs(saldo)],
      saldo ? '=' : '',
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

  async getPayslip(customerId: string, employeeId: string, type: PayslipType, lng: Language, currency: string, platform: Platform, db: IDate, _de: IDate, db2?: IDate): Promise<string> {

    const de = isIDateGrOrEq(_de, db) ? _de : db;

    const translate = (s: string | ILocString) => typeof s === 'object'
      ? getLocString(s, lng)
      : s;

    const payslipView = (template: Template) => {
      /**
       * Ширина колонки с названием показателя в расчетном листке.
       */
      const lLabel = 22;
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
          let last = res.length - 1;

          // оставлять просто одну сумму в последней строке нельзя
          if (res[last].length === 1 && res.length > 1) {
            // если в предпоследней строке более одного слова, то последнее
            // перенесем в последнюю строку
            if (res[last - 1].length > 1) {
              res[last] = [res[last - 1][res[last - 1].length - 1], ...res[last]];
              res[last - 1].length = res[last - 1].length - 1;
            } else {
              res[last - 1] = [...res[last - 1], ...res[last]];
              res.length = res.length - 1;
              last--;
            }
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

      return template.filter( (t, xid) => t && !(t === '=' && template[xid + 1] === '=') && (!Array.isArray(t) || t[1] !== undefined) )
        .map(t => Array.isArray(t) && t.length === 3
          ? type === 'COMPARE' ?  `${format(t[0]).padStart(lCol)}${format(t[1]).padStart(lCol)}${format(t[2]).padStart(lCol)}` : `${format2(t[0]).padStart(lCol)}${format2(t[1]).padStart(lCol)}${format2(t[2]).padStart(lCol)}`
          : Array.isArray(t) && t.length === 2
          ? splitLong(`${translate(t[0]).padEnd(lLabel)}${type === 'COMPARE' ? format(t[1]!).padStart(lValue) : format2(t[1]!).padStart(lValue)}`)
          : t === '='
          ? '='.padEnd(fullWidth, '=')
          : translate(t!))
        .join('\n');
    };


    const payslipViewViber = (template: Template) => {
      /**
       * Ширина колонки с названием показателя в расчетном листке.
       */
      const lLabel = 27;
      // /**
      //  * Ширина колонки с числовым значением в расчетном листке.
      //  * Должна быть достаточной, чтобы уместить разделительный пробел.
      //  */
      // const lValue = 9;
      /**
       * Ширина колонки в сравнительном листке.
       */
      const lCol = 10;
      /**
       * Полная ширина с учетом разделительного пробела
       */
      const fullWidth = lLabel;

      const splitLong = (s: string) => {
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

        return res.map( l => l.join(' ') ).join('\n');
      }

      return template.filter( (t, xid) => t && !(t === '=' && template[xid + 1] === '=') && (!Array.isArray(t) || t[1] !== undefined) )
        .map(t => Array.isArray(t) && t.length === 3
          ? type === 'COMPARE' ? `${format(t[0]).padStart(lCol)}${format(t[1]).padStart(lCol)}${format(t[2]).padStart(lCol)}` : `${format2(t[0]).padStart(lCol)}${format2(t[1]).padStart(lCol)}${format2(t[2]).padStart(lCol)}`
          : Array.isArray(t) && t.length === 2
          ? splitLong(`${translate(t[0])} ${type === 'COMPARE' ? format(t[1]!) : format2(t[1]!)}`)
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

    return '^FIXED\n' + (platform === 'TELEGRAM' ? payslipView(s) : payslipViewViber(s));
  }

  async launchTelegram(callbackHost?: string, hookPath?: string, port?: number, tlsOptions?: { key: Buffer, cert: Buffer, ca: string }) {
    if (callbackHost && hookPath && port && tlsOptions) {
      console.log(`Starting telegram bot at ${callbackHost}:${port}${hookPath}...`);
      await this._telegram.telegram.setWebhook(`${callbackHost}:${port}${hookPath}`, undefined, 100);
      await this._telegram.startWebhook(hookPath, tlsOptions, port);
      console.log('Telegram bot has been started...');
    } else {
      await this._telegram.launch();
    }
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
    this._announcements.flush();
    this._userRights.flush();
    this._customers.flush();
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

    service = service.onTransition( (state, event) => {
        const accountLinkDB = inPlatform === 'TELEGRAM' ? this._telegramAccountLink : this._viberAccountLink;

        //TODO: temporarily
        this._logger.debug(inChatId, undefined, `${state.toStrings().join('->')}, ${JSON.stringify(event)}`);

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
  async onUpdate(update: IUpdate) {
    this._callbacksReceived++;

    const { platform, chatId, type, body, language } = update;
    const uniqId = this.getUniqId(platform, chatId);

    let updateSemaphore = this._updateSemaphore[uniqId];

    if (!updateSemaphore) {
      updateSemaphore = new Semaphore(`onUpdate for ${uniqId}`);
      this._updateSemaphore[uniqId] = updateSemaphore;
    }

    await updateSemaphore.acquire();
    try {
      //TODO: temporarily
      await this._logger.info(chatId, undefined, `${type} -- ${body}`);

      const accountLinkDB = platform === 'TELEGRAM' ? this._telegramAccountLink : this._viberAccountLink;
      const accountLink = accountLinkDB.read(chatId);
      let service = this._service[uniqId];

      if (accountLink && body === 'diagnostics') {
        this.finalize();

        let serviceStat: { [signature: string]: number } = {};

        for (const s of Object.values(this._service)) {
          const signature = JSON.stringify(s.state.value);
          if (!serviceStat[signature]) {
            serviceStat[signature] = 1;
          } else {
            serviceStat[signature]++;
          }
        }

        const formattedServiceStat = Object.entries(serviceStat)
          .sort( ([,a], [,b]) => b - a )
          .map( ([signature, cnt]) => `  ${signature.split('"').join('').replace('{', '').replace('}', '').replace(':', '-')}: ${cnt}` )
          .join('\n');

        /**
         * viber, viber inactive, telegram, telegram inactive, employees
         */
        const stat: { [customerId: string]: [number, number, number, number, number] } = {};

        /**
         * Собираем статистику "все/активные последние 31 дней" в разрезе клиентов.
         */
        const thirtyDaysAgo = new Date().getTime() - 31 * 24 * 60 * 60 * 1000;

        for (const l of Object.values(this._viberAccountLink.getMutable(false))) {
          if (!stat[l.customerId]) {
            stat[l.customerId] = [0, 0, 0, 0, 0];
          }
          stat[l.customerId][0]++;
          if (l.lastUpdated && l.lastUpdated.getTime() < thirtyDaysAgo) {
            stat[l.customerId][1]++;
          }
        }

        for (const l of Object.values(this._telegramAccountLink.getMutable(false))) {
          if (!stat[l.customerId]) {
            stat[l.customerId] = [0, 0, 0, 0, 0];
          }
          stat[l.customerId][2]++;
          if (l.lastUpdated && l.lastUpdated.getTime() < thirtyDaysAgo) {
            stat[l.customerId][3]++;
          }
        }

        for (const customerId of Object.keys(stat)) {
          const emplDB = this._getEmployees(customerId);
          
          if (!emplDB) {
            console.error(`There is no employee db file for customer ${customerId}`);
            delete stat[customerId];
          } else {
            stat[customerId][4] = Object.keys(this._getEmployees(customerId).getMutable(false)).length;
          }
        }

        const [totalV, totalIV, totalT, totalIT, totalE] = Object.values(stat).reduce( (p, s) => [p[0] + s[0], p[1] + s[1], p[2] + s[2], p[3] + s[3], p[4] + s[4]], [0, 0, 0, 0, 0] );
        const dateOptions = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' };

        /**
         * Форматируем статистику в текст. Одна строка -- один клиент.
         */
        const formatStats = () => Object.entries(stat)
          .sort( ([, [AV, , AT]], [, [BV, , BT]]) => (BV + BT) - (AV + AT) )
          .map(
            ([custId, [custV, custIV, custT, custIT, custE]], idx) => {
              const c = this._getCanteenLastDate(custId);
              const p = this._getPayslipLastDate(custId);
              return (`${(idx + 1).toString().padEnd(4, '.')}${custId}: ${custV + custT}/${custE}/${((custV + custT) * 100 / custE).toFixed(0)}%/${custV}${custIV ? '(' + custIV + ')' : ''}/${custT}${custIT ? '(' + custIT + ')' : ''}\n${c ? `  canteen: ${c}\n` : ''}${p ? `  payslip: ${this._getPayslipLastDate(custId)}` : ''}`)
            })
          .join('\n');

        const data = [
          '^FIXED',
          `Server started: ${new Intl.DateTimeFormat("be", dateOptions as any).format(this._botStarted)}`,
          `Node version: ${process.versions.node}`,
          `RSS memory: ${new Intl.NumberFormat().format(process.memoryUsage().rss)} bytes`,
          `This chat id: ${chatId}`,
          `Customer id: ${accountLink?.customerId}`,
          `Employee id: ${accountLink?.employeeId}`,
          `Callbacks processed: ${this._callbacksReceived}`,
          `Machines are running: ${Object.values(this._service).length}`,
          `${formattedServiceStat}`,
          `Users/Empl/%/V/T (inact): ${totalV + totalT}/${totalE}/${((totalV + totalT) * 100 / totalE).toFixed(0)}%/${totalV}${totalIV ? '(' + totalIV + ')' : ''}/${totalT}${totalIT ? '(' + totalIT + ')' : ''}`,
          `${formatStats()}`
        ];

        const { customerId, employeeId, } = accountLink;
        this.createService(platform, chatId).send({
          type: 'MAIN_MENU',
          platform,
          chatId,
          customerId,
          employeeId,
          forceMainMenu: true,
          diagnostics: data.join('\n'),
          semaphore: new Semaphore(`chatId: ${chatId}`)
        });

        return;
      }

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
            semaphore: new Semaphore(`chatId: ${chatId}`)
          });
        } else {
          res.send({
            type: 'START',
            platform,
            chatId,
            semaphore: new Semaphore(`chatId: ${chatId}`)
          });
        }

        return res;
      }

      /**
       * При переходе из состояния в состояние могут сработать
       * actions, которые внутри могут вызвать длительные асинхронные
       * операции. Мы подождем пока такие операции не завершатся.
       */
      if (service) {
        const { semaphore } = service.state.context;
        if (semaphore && !semaphore.permits) {
          await semaphore?.acquire();
          semaphore?.release();
        }
      }

      if (body === '/start' || service?.state.done) {
        await this._logger.debug(chatId, undefined, '/start or done');
        createNewService(true);
        return;
      }

      if (!service) {
        await this._logger.debug(chatId, undefined, 'no service');
        service = createNewService(false);

        if (!accountLink) {
          return;
        }
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
          // в вайбере переход по ссылке приводит к посылке в чат самой ссылки
          if (platform !== 'VIBER' || !validURL(body)) {
            // мы каким-то образом попали в ситуацию, когда текущее состояние не
            // может принять вводимую информацию. например, пользователь
            // очистил чат или произошел сбой на стороне мессенджера и
            // то, что видит пользователь отличается от внутреннего состояния
            // машины

            const { semaphore } = service.state.context;

            await semaphore?.acquire();
            try {
              if (platform === 'TELEGRAM') {
                await this._telegramSemaphore.acquire();
                try {
                  await this._telegram.telegram.sendMessage(chatId, getLocString(stringResources.weAreLost, language));
                } finally {
                  this._telegramSemaphore.release();
                }
              } else {
                await this._viberSemaphore.acquire();
                try {
                  await this._viber.sendMessage({ id: chatId }, [new TextMessage(getLocString(stringResources.weAreLost, language))]);
                } finally {
                  this._viberSemaphore.release();
                }
              }
            } finally {
              semaphore?.release();
            }

            await this._logger.debug(chatId, undefined, 'we are lost');
            createNewService(true);
          }
        }
      }
    }
    finally {
      updateSemaphore.release();
    }
  }

  uploadAccDeds(customerId: string, objData: Object) {
    let customerAccDed = this._customerAccDeds[customerId];

    if (!customerAccDed) {
      customerAccDed = new FileDB<IAccDed>({ fn: getAccDedFN(customerId), logger: this._log });
      this._customerAccDeds[customerId] = customerAccDed;
    }

    customerAccDed.clear();

    for (const [key, value] of Object.entries(objData)) {
      customerAccDed.write(key, value as any);
    }

    customerAccDed.flush();

    this._log.info(`AccDed reference for customer: ${customerId} has been uploaded.`);
  }

  uploadEmployees(customerId: string, objData: Object) {
    let employee = this._employees[customerId];

    if (!employee) {
      employee = new FileDB<Omit<IEmployee, 'id'>>({ fn: getEmployeeFN(customerId), logger: this._log });
      this._employees[customerId] = employee;
    }

    employee.clear();

    for (const [key, value] of Object.entries(objData)) {
      employee.write(key, value as any);
    }

    employee.flush();

    this._log.info(`Customer: ${customerId}. ${Object.keys(objData).length} employees have been uploaded.`);
  }

  upload_timeSheets(customerId: string, objData: ITimeSheetJSON, rewrite: boolean) {
    const employeeId = objData.emplId;
    const timeSheet = new FileDB<ITimeSheet>({ fn: getTimeSheetFN(customerId, employeeId), logger: this._log });

    if (rewrite) {
      timeSheet.clear();
    }

    const prevTimeSheetData = timeSheet.read(employeeId);

    // если на диске не было файла или там было пусто, то
    // просто запишем данные, которые пришли из интернета
    if (!prevTimeSheetData) {
      timeSheet.write(employeeId, {...objData, data: objData.data.map( (i: any) => ({...i, d: new Date(i.d)}) )} );
    } else {
      // данные есть. надо объединить прибывшие данные с тем
      // что уже есть на диске
      const newTimeSheetData =  {
        ...prevTimeSheetData,
        data: prevTimeSheetData.data.map(ts => ({...ts, d: new Date(ts.d)}))
      };

      // объединяем табеля
      for (const ts of objData.data) {
        const date = new Date(ts.d);
        const i = newTimeSheetData.data.findIndex( a => isEq(a.d, date) );
        if (i === -1) {
          newTimeSheetData.data.push({...ts, d: date});
        } else {
          newTimeSheetData.data[i] = {...ts, d: date};
        }
      }

      timeSheet.write(employeeId, newTimeSheetData);
    }
    timeSheet.flush();

  }

  upload_schedules(customerId: string, objData: IScheduleData, rewrite: boolean) {
    const schedule = new FileDB<Omit<IScheduleData, 'id'>>({ fn: getScheduleFN(customerId), logger: this._log });
    schedule.clear();

    for (const [key, value] of Object.entries(objData)) {
      schedule.write(key, {...value, data: value.data.map( (i: any) => ({...i, d: new Date(i.d)}) )} as any);
    }

    schedule.flush();

    this._log.info(`Customer: ${customerId}. ${Object.keys(objData).length} schedules have been uploaded.`);
  }

  upload_canteenMenu(customerId: string, objData: ICanteenMenus, date: string) {
    const menu = new FileDB<ICanteenMenus>({ fn: getCanteenMenuFN(customerId), logger: this._log });
    menu.clear();
    menu.write(date, objData);
    menu.flush();

    this._log.info(`Customer: ${customerId}. ${Object.keys(objData).length} menu have been uploaded.`);
  }

  _callWithTempSemaphore(f: ({ chatId, semaphore }: Pick<IBotMachineContext, 'chatId' | 'semaphore'>) => Promise<void>, chatId: string) {
    return f({ chatId, semaphore: new Semaphore('temp semaphore') });
  }

  async informUserOnNewPayslip(customerId: string, employeeId: string) {
    let cnt = 0;
    let timeouted = 0;

    const sendToAccount = async (replyFunc: ReplyFunc, accountLink: IData<IAccountLink>, getUniqId: (cId: string) => string) => {
      const al = Object.entries(accountLink).find( ([_, l]) => l.customerId === customerId && l.employeeId === employeeId );

      if (al) {
        const [linkChatId, link] = al;

        /**
          * Мы пытаемся избежать ситуации, когда пользователь был в процессе диалога
          * и тут мы ему вылезли под руку со своим сообщением.
          *
          * 1) Если активной машины нет для этого чата, то можем слать. Все равно состояние
          *    пользователя скинется в главное меню при очередном подключении.
          * 2) Если машина есть, но состояние "главное меню", то тоже шлем сразу.
          * 3) Если состояние не главное меню и активность последняя была больше часа назад,
          *    то шлем.
          * 4) Если активность была менее часа назад, то выждем 5 минут и тогда опять запустим проверку.
          * 5) При этом, если акаунт линк почему-то все время обновляется, мы не хотели бы допустить
          *    бесконечных попыток отправить сообщение. Ограничем количество пятью.
          */

        const fn = async (countDown: number) => {
          const service = this._service[getUniqId(linkChatId)];
          const anHourAgo = Date.now() - 60 * 60 * 1000;

          if (
            !countDown
            ||
            !service
            ||
            inMainMenu(service?.state)
            ||
            (link.lastUpdated?.getTime() ?? 0) < anHourAgo
          ) {
            await this._announcementSemaphore.acquire();
            try {
              await this._callWithTempSemaphore(replyFunc(stringResources.newPayslipArrived, 'KEEP'), linkChatId);
              await pause(50);
              cnt++;
            }
            finally {
              this._announcementSemaphore.release();
            }
          } else {
            timeouted++;
            setTimeout( () => { timeouted--; fn(countDown - 1); }, 5 * 60 * 1000 );
          }
        };

        await fn(5);
      }
    };

    await sendToAccount(this._replyTelegram, this._telegramAccountLink.getMutable(false), (cId: string) => this.getUniqId('TELEGRAM', cId));

    if (this._replyViber) {
      await sendToAccount(this._replyViber, this._viberAccountLink.getMutable(false), (cId: string) => this.getUniqId('VIBER', cId));
    }
  }

  /**
   * Загрузка данных по расчетным листкам.
   * @param customerId
   * @param receivedData
   * @param rewrite
   */
  upload_payslips(customerId: string, receivedData: IPayslip, rewrite: boolean) {
    /**
     * Сейчас из сторонней программы всегда передается полная история по всем полям
     * objData за все периоды, за исключением собственно начислений/удержаний,
     * которые передаются обычно по-месячно, но могут передаваться и за больший период,
     * но всегда кратный одному месяцу.
     *
     * Таким образом, при загрузке данных мы:
     * 1) всегда полностью заменяем dept, schedule, payForm и т.п. тем, что поступило из внешней системы
     * 2) определяем за какие месяцы поступили данные по начислениям/удержаниям
     * 3) удаляем старые данные за эти месяцы полностью
     * 4) добавляем новые данные
     */
    const employeeId = receivedData.emplId;
    const payslipDB = new FileDB<IPayslip>({ fn: getPayslipFN(customerId, employeeId), logger: this._log });

    if (rewrite) {
      payslipDB.clear();
    }

    let needInformUser: boolean;
    const prevPayslipData = payslipDB.read(employeeId);

    if (!prevPayslipData) {
      payslipDB.write(employeeId, receivedData);
      needInformUser = true;
    } else {
      const receivedMonths: IDate[] = [];

      for (const { db } of receivedData.data) {
        const date = str2Date(db);  // TODO: это вызов не нужен, как только мы решим вопрос с преобразованием текста в JSON
        const year = date.getFullYear();
        const month = date.getMonth();
        if (!receivedMonths.find( rm => rm.year === year && rm.month === month )) {
          receivedMonths.push({ year, month });
        }
      }

      const notInReceivedMonths = (d: Date) => {
        const date = str2Date(d); // TODO: см выше
        const year = date.getFullYear();
        const month = date.getMonth();
        return !receivedMonths.find( rm => rm.year === year && rm.month === month );
      };

      const newPayslipData = {
        ...receivedData,
        data: [...prevPayslipData.data.filter( ({ db }) => notInReceivedMonths(db) ), ...receivedData.data]
      };

      payslipDB.write(employeeId, newPayslipData);

      /**
      * Информируем пользователя только если поступили/обновились новейшие данные за текущий или предыдущий месяц.
      */
      const currMonthYear = new Date().getFullYear();
      const currMonth = new Date().getMonth();
      const prevMonthYear = currMonth > 0 ? currMonthYear : (currMonthYear - 1);
      const prevMonth = currMonth > 0 ? (currMonth - 1) : 11;
      needInformUser = !!receivedMonths.find( rm =>
        (rm.year === currMonthYear && rm.month === currMonth)
        ||
        (rm.year === prevMonthYear && rm.month === prevMonth)
      );
    }

    payslipDB.flush();

    this._log.info(`Payslips for employee: ${employeeId}, customer: ${customerId} have been uploaded.`);

    // TODO: в вайбере после вывода текста о новом листке
    // пропадает меню. тоже самое будет и с броадкастом сообщений
    // надо найти решение
    //if (needInformUser) {
      //this.informUserOnNewPayslip(customerId, employeeId);
    //}
  }

  public async sendLatestPayslip(customerId: string, employeeId: string) {
    await this.sendLatestPayslipToMessenger(customerId, employeeId, this._telegramAccountLink, this._replyTelegram, 'TELEGRAM');
    if (this._replyViber) {
      await this.sendLatestPayslipToMessenger(customerId, employeeId, this._viberAccountLink, this._replyViber, 'VIBER')
    }
  }

  public async sendLatestPayslipToMessenger(customerId: string, employeeId: string, accountLinkDB: FileDB<IAccountLink>, reply: ReplyFunc, platform: Platform)  {
    // сначала поищем в списке чатов
    const accountLink = Object.entries(accountLinkDB.getMutable(false))
      .find( ([_, acc]) => acc.customerId === customerId && acc.employeeId === employeeId );

    if (!accountLink) {
      return;
    }

    const chatId = accountLink[0];
    const { payslipSentOn, state, currency, language } = accountLink[1];
    const lastPayslipDE = this._getLastPayslipDate(customerId, employeeId);

    if (!lastPayslipDE || (payslipSentOn && isGrOrEq(payslipSentOn, lastPayslipDE))) {
      return;
    };

    const service = this._service[this.getUniqId(platform, chatId)];
    if (service) {
      // у нас сервер уже связан с чатом в мессенджере
      // сотрудника.
      if (inMainMenu(service.state)) {
        service.send({ type: 'MENU_COMMAND', command: '.latestPayslip' });
      }
    } else {
      // сервер не связан. например, мы его перегрузили
      // будем посылать в чат сообщение с помощью sendMessage
      if (state instanceof Object && state['mainMenu'] === 'showMenu') {
        // мы как-будто вызываем функцию изнутри машины
        // надо ей подсунуть нужные ей параметры, имитируя
        // контекст машины
        // 1) получить текст расчетного листка
        // 2) если в акаунт линк есть прежнее меню -- удалить его
        // 3) вывести текст расчетного листка и главное меню под ним

        const d: IDate = {year: lastPayslipDE.getFullYear(), month: lastPayslipDE.getMonth()};
        const text = await this.getPayslip(customerId, employeeId, 'CONCISE', language ?? 'ru', currency ?? 'BYN', platform, d, d);
        //FIXME: лимит -- не более 30 сообщений в разные чаты в секунду!
        await reply(text, keyboardMenu)({ chatId, semaphore: new Semaphore(`Temp for auto send payslip. employeeId: ${employeeId}`) });
      }
    }

    accountLinkDB.write(chatId, {
      ...accountLink[1],
      payslipSentOn: lastPayslipDE,
      lastUpdated: new Date()
    })
  }
};