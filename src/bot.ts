import { FileDB } from "./util/fileDB";
import { IAccountLink, Platform, IUpdate, ICustomer, IEmployee, IPaySlipData as IPayslipData, IPaySlip as IPayslip, IAccDed, IPaySlipItem, AccDedType, IDate, PayslipType } from "./types";
import Telegraf from "telegraf";
import { Context, Markup, Extra } from "telegraf";
import { Interpreter, Machine, StateMachine, interpret, assign } from "xstate";
import { botMachineConfig, IBotMachineContext, BotMachineEvent, isEnterTextEvent, CalendarMachineEvent, ICalendarMachineContext, calendarMachineConfig } from "./machine";
import { getLocString, str2Language, Language, getLName, ILocString, stringResources } from "./stringResources";
import path from 'path';
import { testNormalizeStr, testIdentStr, date2str } from "./util/utils";
import { Menu, keyboardMenu, keyboardCalendar, keyboardSettings, keyboardLanguage, keyboardCurrency } from "./menu";
import { Semaphore } from "./semaphore";
import { getCurrRate } from "./currency";
import { ExtraEditMessage } from "telegraf/typings/telegram-types";
import { payslipRoot, accDedRefFileName, emploeeFileName as employeeFileName } from "./constants";

type Template = (string | [string, number | undefined] | undefined | ILocString | [number, number, number])[];

//TODO: перенести в utils?
const sum = (arr?: IPaySlipItem[], type?: AccDedType) =>
  arr?.reduce((prev, cur) => prev + (type ? (type === cur.type ? cur.s : 0) : cur.s), 0) ?? 0;

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
  private _employees: { [customerId: string]: FileDB<Omit<IEmployee, 'id'>> } = {};
  private _botStarted = new Date();
  private _callbacksReceived = 0;
  private _customerAccDeds: { [customerID: string]: FileDB<IAccDed> } = {};

  constructor(telegramToken: string, telegramRoot: string, viberToken: string, viberRoot: string) {
    this._telegramAccountLink = new FileDB<IAccountLink>(path.resolve(telegramRoot, 'accountlink.json'));
    this._viberAccountLink = new FileDB<IAccountLink>(path.resolve(viberRoot, 'accountlink.json'));
    this._customers = new FileDB<Omit<ICustomer, 'id'>>(path.resolve(process.cwd(), 'data/customers.json'));

    const reply = (s: ILocString | undefined, menu?: Menu, ...args: any[]) => async ({ platform, chatId, semaphore }: Pick<IBotMachineContext, 'platform' | 'chatId' | 'semaphore'>) => {
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
        const extra: ExtraEditMessage = keyboard ? Extra.markup(keyboard) : {};

        if (text && text.slice(0, 3) === '```') {
          extra.parse_mode = 'MarkdownV2';
        }

        await semaphore.acquire();
        try {
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
              //
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

    const getShowPayslipFunc = (payslipType: PayslipType) => async (ctx: IBotMachineContext) => {
      const { accountLink, semaphore, ...rest } = checkAccountLink(ctx);
      const { dateBegin, dateEnd, dateBegin2 } = ctx;
      const { customerId, employeeId, language, currency } = accountLink;
      await semaphore?.acquire();
      try {
        //TODO: заменять на дефолтные язык и валюту
        // валюта! преобразовать в ід
        const s = await this.getPayslip(customerId, employeeId, payslipType, language ?? 'ru', currency ?? 'BYN', dateBegin, dateEnd, dateBegin2);
        reply({ en: null, ru: s, be: null })({ ...rest, semaphore: new Semaphore() });
      } finally {
        semaphore?.release();
      }
    };

    this._machine = Machine<IBotMachineContext, BotMachineEvent>(botMachineConfig(this._calendarMachine),
      {
        actions: {
          askCompanyName: reply(stringResources.askCompanyName),
          unknownCompanyName: reply(stringResources.unknownCompanyName),
          assignCompanyId: assign<IBotMachineContext, BotMachineEvent>({ customerId: this._findCompany }),
          assignEmployeeId: assign<IBotMachineContext, BotMachineEvent>({ employeeId: this._findEmployee }),
          askPersonalNumber: reply(stringResources.askPersonalNumber),
          showMainMenu: reply(stringResources.mainMenuCaption, keyboardMenu),
          showPayslip: getShowPayslipFunc('CONCISE'),
          showDetailedPayslip: getShowPayslipFunc('DETAIL'),
          showPayslipForPeriod: getShowPayslipFunc('DETAIL'),
          showComparePayslip: getShowPayslipFunc('COMPARE'),
          showSettings: ctx => {
            const { accountLink, ...rest } = checkAccountLink(ctx);
            //TODO: языка и валюты может не быть. надо заменять на дефолтные
            reply(stringResources.showSettings, keyboardSettings, accountLink.language ?? 'ru', accountLink.currency ?? 'BYN')(rest);
          },
          sayGoodbye: reply(stringResources.sayGoodbye),
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
                  currency: event.command.split('/')[1]
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

  private _getEmployees(customerId: string) {
    let employees = this._employees[customerId];

    if (!employees) {
      const db = new FileDB<Omit<IEmployee, 'id'>>(path.resolve(process.cwd(), `data/payslip/${customerId}/employee.json`));
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
      const customers = this._customers.getMutable(false);
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
    const payslip = new FileDB<IPayslip>(path.resolve(process.cwd(), `${payslipRoot}/${customerId}/${employeeId}.json`))
      .read(employeeId);

    if (!payslip) {
      return undefined;
    }

    let accDed = this._customerAccDeds[customerId];

    if (!accDed) {
      accDed = new FileDB<IAccDed>(path.resolve(process.cwd(), `${payslipRoot}/${customerId}/${accDedRefFileName}`), {});
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
    //let maxDate: Date = paySlip.dept[0].d;

    //TODO: а может массив оказаться пустым? это где-то проверяется
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

    let salary = payslip.salary[0].s;
    maxDate = str2Date(payslip.salary[0].d);

    for (const posS of payslip.salary) {
      const posSD = str2Date(posS.d);
      if (isGr(posSD, maxDate) && isLs(posSD, de)) {
        salary = posS.s;
        maxDate = posSD;
      }
    }

    let hourrate: number | undefined = undefined;

    if (payslip.hourrate) {
      hourrate = payslip.hourrate[0].s;
      maxDate = str2Date(payslip.hourrate[0].d);

      for (const posHR of payslip.hourrate) {
        const posHRD = str2Date(posHR.d);
        if (isGr(posHRD, maxDate) && isLs(posHRD, de)) {
          hourrate = posHR.s;
          maxDate = posHRD;
        }
      }
    };

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
            //TODO: языки!
            data.saldo = { name: { ru: { name: 'Остаток' }}, s };
            continue;
          }

          console.error(`Отсутствует в справочнике тип начисления или удержания ${typeId}`);
          continue;
        }

        const { name, type } = accDedObj[typeId];

        switch (type) {
          case 'INCOME_TAX':
          case 'PENSION_TAX':
          case 'TRADE_UNION_TAX':
            data.tax?.push({ name, s, type, det });
            break;

          case 'ADVANCE':
            data.advance?.push({ name, s, det });
            break;

          case 'DEDUCTION':
            data.deduction?.push({ name, s, det });
            break;

          case 'ACCRUAL':
            data.accrual?.push({ name, s, det });
            break;

          case 'TAX_DEDUCTION':
            data.tax_deduction?.push({ name, s, det });
            break;

          case 'PRIVILAGE':
            data.privilage?.push({ name, s,  det });
            break;
        }
      }
    };

    return (data.saldo || data.accrual?.length || data.deduction?.length) ? data : undefined;
  };

  private _calcPayslipByRate(data: IPayslipData, rate: number) {
    const { saldo, tax, advance, deduction, accrual, tax_deduction, privilage, salary, ...rest } = data;
    return {
      ...rest,
      saldo: saldo && { ...saldo, s: saldo.s / rate },
      tax: tax && tax.map( i => ({ ...i, s: i.s / rate }) ),
      advance: advance && advance.map( i => ({ ...i, s: i.s / rate }) ),
      deduction: deduction && deduction.map( i => ({ ...i, s: i.s / rate }) ),
      accrual: accrual && accrual.map( i => ({ ...i, s: i.s / rate }) ),
      tax_deduction: tax_deduction && tax_deduction.map( i => ({ ...i, s: i.s / rate }) ),
      privilage: privilage && privilage.map( i => ({ ...i, s: i.s / rate }) ),
      salary: salary && salary / rate
    }
  }

  private _formatShortPayslip(data: IPayslipData, lng: Language, employeeName: string, periodName: string, currencyName: string): Template {
    const accruals = sum(data.accrual);
    const taxes = sum(data.tax);
    const deds = sum(data.deduction);
    const advances = sum(data.advance);
    const incomeTax = sum(data.tax, 'INCOME_TAX');
    const pensionTax = sum(data.tax, 'PENSION_TAX');
    const tradeUnionTax = sum(data.tax, 'TRADE_UNION_TAX');

    return [
      stringResources.payslipTitle,
      employeeName,
      periodName,
      currencyName,
      'Подразделение:',
      getLName(data.department, [lng]),
      'Должность:',
      getLName(data.position, [lng]),
      ['Оклад:', data.salary],
      ['ЧТС:', data.hourrate],
      '=',
      ['Начислено:', accruals],
      '=',
      ['Зарплата чистыми:', accruals - taxes],
      ['  Удержания:', deds],
      ['  Аванс:', advances],
      ['  К выдаче:', data.saldo?.s],
      '=',
      ['Налоги:', taxes],
      ['  Подоходный:', incomeTax],
      ['  Пенсионный:', pensionTax],
      ['  Профсоюзный:', tradeUnionTax]
    ];
  }

  private _formatComparativePayslip(data: IPayslipData, data2: IPayslipData, lng: Language, employeeName: string, periodName: string, currencyName: string): Template {
    const accruals = sum(data.accrual);
    const taxes = sum(data.tax);
    const deds = sum(data.deduction);

    const accruals2 = sum(data2.accrual);
    const taxes2 = sum(data2.tax);
    const deds2 = sum(data2.deduction);

    return [
      stringResources.comparativePayslipTitle,
      employeeName,
      periodName,
      currencyName,
      'Оклад:',
      [data.salary ?? 0, data2.salary ?? 0, (data2.salary ?? 0) - (data.salary ?? 0)],
      'ЧТС:',
      [data.hourrate ?? 0, data2.hourrate ?? 0, (data2.hourrate ?? 0) - (data.hourrate ?? 0)],
      '=',
      'Начислено:',
      [accruals, accruals2, accruals2 - accruals],
      '=',
      'Зарплата чистыми:',
      [accruals - taxes, accruals2 - taxes2, accruals2 - taxes2 - (accruals - taxes)],
      '=',
      'Удержания:',
      [deds, deds2, deds2 - deds],
      '=',
      'Налоги:',
      [taxes, taxes2, taxes2 - taxes],
    ];
  }

  private _formatDetailedPayslip(data: IPayslipData, lng: Language, employeeName: string, periodName: string, currencyName: string): Template {
    const accruals = sum(data.accrual);
    const taxes = sum(data.tax);
    const deds = sum(data.deduction);
    const advances = sum(data.advance);
    const taxDeds = sum(data.tax_deduction);
    const privilages = sum(data.privilage);

    const strAccruals: Template = data.accrual?.map( i => [getLName(i.name, [lng]), i.s]) ?? [undefined];
    const strDeductions: Template = data.deduction?.map( i => [getLName(i.name, [lng]), i.s]) ?? [undefined];
    const strAdvances: Template = data.advance?.map( i => [getLName(i.name, [lng]), i.s]) ?? [undefined];
    const strTaxes: Template = data.tax?.map( i => [getLName(i.name, [lng]), i.s]) ?? [undefined];
    const strTaxDeds: Template = data.tax_deduction?.map( i => [getLName(i.name, [lng]), i.s]) ?? [undefined];
    const strPrivilages: Template = data.privilage?.map( i => [getLName(i.name, [lng]), i.s]) ?? [undefined];

    return [
      stringResources.payslipTitle,
      employeeName,
      periodName,
      currencyName,
      'Подразделение:',
      getLName(data.department, [lng]),
      'Должность:',
      getLName(data.position, [lng]),
      ['Оклад:', data.salary],
      ['ЧТС:', data.hourrate],
      '=',
      ['Начисления:', accruals],
      accruals ? '=' : '',
      ...strAccruals,
      accruals ? '=' : '',
      ['Удержания:', deds],
      deds ? '=' : '',
      ...strDeductions,
      deds ? '=' : '',
      ['Аванс:', advances],
      advances ? '=' : '',
      ...strAdvances,
      advances ? '=' : '',
      ['Налоги:', taxes],
      taxes ? '=' : '',
      ...strTaxes,
      taxes ? '=' : '',
      ['Вычеты:', taxDeds],
      taxDeds ? '=' : '',
      ...strTaxDeds,
      taxDeds ? '=' : '',
      ['Льготы:', privilages],
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
      const lLabel = 27;
      const lValue = 9;
      const lCol = 12;
      return template.filter( t => t && (!Array.isArray(t) || t[1] !== undefined) )
        .map(t => Array.isArray(t) && t.length === 3
          ? `${format(t[0]).padStart(lCol)}${format(t[1]).padStart(lCol)}${format(t[2]).padStart(lCol)}`
          : Array.isArray(t) && t.length === 2
          ? `${translate(t[0]).slice(0, lLabel).padEnd(lLabel)}${format(t[1]!).padStart(lValue)}`
          : t === '='
          ? '='.padEnd(lLabel + lValue, '=')
          : translate(t!))
        .join('\n');
    };

    let dataI = this._getPayslipData(customerId, employeeId, db, de);

    if (!dataI) {
      return getLocString(stringResources.noData, lng);
    }

    const currencyRate = currency === 'BYN' ? undefined : await getCurrRate(db, currency);

    if (currency && currency !== 'BYN' && !currencyRate) {
      return getLocString(stringResources.cantLoadRate, lng, currency);
    }

    if (currencyRate) {
      dataI = this._calcPayslipByRate(dataI, currencyRate.rate);
    }

    const employee = this._getEmployee(customerId, employeeId);
    const employeeName = employee
      ? `${employee.lastName} ${employee.firstName.slice(0, 1)}. ${employee.patrName ? employee.patrName.slice(0, 1) + '.' : ''}`
      : 'Bond, James Bond';

    let s: Template;

    if (type !== 'COMPARE') {
      const periodName = 'Период: ' + (de.year !== db.year || de.month !== db.month
        ? `${db.month + 1}.${db.year}-${de.month + 1}.${de.year}`
        : `${new Date(db.year, db.month).toLocaleDateString(lng, { month: 'long', year: 'numeric' })}`
      );

      //TODO: локализация!
      const currencyName = 'Валюта: ' + (
        currencyRate
          ? `${currency}, курс ${currencyRate.rate.toFixed(2)} на ${date2str(currencyRate.date, 'DD.MM.YY')}`
          : 'Белорусский рубль'
      );

      s = type === 'CONCISE'
        ? this._formatShortPayslip(dataI, lng, employeeName, periodName, currencyName)
        : this._formatDetailedPayslip(dataI, lng, employeeName, periodName, currencyName);
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
      }

      const currencyRate2 = currency === 'BYN' ? undefined : await getCurrRate(db2, currency);

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

      const periodName = 'Период: ' + (de.year !== db.year || de.month !== db.month
        ? `${db.month + 1}.${db.year}-${de.month + 1}.${de.year}`
        : `${new Date(db.year, db.month).toLocaleDateString(lng, { month: 'long', year: 'numeric' })}`
      ) + ' к ' + (de2.year !== db2.year || de2.month !== db2.month
        ? `${db2.month + 1}.${db2.year}-${de2.month + 1}.${de2.year}`
        : `${new Date(db2.year, db2.month).toLocaleDateString(lng, { month: 'long', year: 'numeric' })}`
      );

      //TODO: локализация!
      const currencyName = 'Валюта: ' + (
        currencyRate && currencyRate2
          ? `${currency}\nкурс ${currencyRate.rate.toFixed(2)} на ${date2str(currencyRate.date, 'DD.MM.YY')}\n${currencyRate2.rate.toFixed(2)} на ${date2str(currencyRate2.date, 'DD.MM.YY')}`
          : 'Белорусский рубль'
      );

      s = this._formatComparativePayslip(dataI, dataII, lng, employeeName, periodName, currencyName);
    }

    return '```ini\n' + payslipView(s) + '```';
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

  uploadAccDeds(customerId: string, objData: Object) {
    let customerAccDed = this._customerAccDeds[customerId];

    if (!customerAccDed) {
      customerAccDed = new FileDB<IAccDed>(path.resolve(process.cwd(), `${payslipRoot}/${customerId}/${accDedRefFileName}`));
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
      employee = new FileDB<Omit<IEmployee, 'id'>>(path.resolve(process.cwd(), `${payslipRoot}/${customerId}/${employeeFileName}`), {});
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
    const payslip = new FileDB<IPayslip>(path.resolve(process.cwd(), `${payslipRoot}/${customerId}/${employeeId}.json`));

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
        salary: [...prevPayslipData.salary]
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

      // объединяем оклады
      for (const p of objData.salary) {
        const i = newPayslipData.salary.findIndex( a => a.d === p.d );
        if (i === -1) {
          newPayslipData.salary.push(p);
        } else {
          newPayslipData.salary[i] = p;
        }
      }

      payslip.write(employeeId, newPayslipData);
    }

    payslip.flush();

    //TODO: оповестить всех клиентов о новых расчетных листках
  }
};