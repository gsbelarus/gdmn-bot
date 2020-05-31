import { FileDB } from "./util/fileDB";
import { IAccountLink, Platform, IUpdate, ICustomer, IEmployee, IPaySlipData, IPaySlip, IAccDed, TypePaySlip, IPaySlipItem, AccDedType } from "./types";
import Telegraf from "telegraf";
import { Context, Markup, Extra } from "telegraf";
import { Interpreter, Machine, StateMachine, interpret, assign } from "xstate";
import { botMachineConfig, IBotMachineContext, BotMachineEvent, isEnterTextEvent, CalendarMachineEvent, ICalendarMachineContext, calendarMachineConfig, MenuCommandEvent } from "./machine";
import { getLocString, StringResource, str2Language, Language, getLName } from "./stringResources";
import path from 'path';
import { testNormalizeStr, testIdentStr, date2str } from "./util/utils";
import { Menu, keyboardMenu, keyboardCalendar, keyboardSettings, keyboardLanguage, keyboardCurrency } from "./menu";
import { Semaphore } from "./semaphore";
import { payslipRoot, accDedRefFileName } from "./data";
import { getCurrRate, getCurrencyAbbreviationById } from "./currency";

type Template = ([string | string[][] | undefined, number?, boolean?])[];

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
  private _employees: { [companyId: string]: FileDB<Omit<IEmployee, 'id'>> } = {};
  private _botStarted = new Date();
  private _callbacksReceived = 0;
  private _customerAccDeds: { [customerID: string]: FileDB<IAccDed> } = {};

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

  private _findEmployee = ({ customerId }: IBotMachineContext, event: BotMachineEvent) => {
    if (isEnterTextEvent(event) && customerId) {
      let employees = this._employees[customerId];

      if (!employees) {
        const db = new FileDB<Omit<IEmployee, 'id'>>(path.resolve(process.cwd(), `data/payslip/${customerId}/employee.json`));
        if (!db.isEmpty()) {
          employees = db;
          this._employees[customerId] = db;
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

  private _getPaySlipData(customerId: string, employeeId: string, db: Date, de: Date): IPaySlipData | undefined {
    const payslip = new FileDB<IPaySlip>(path.resolve(process.cwd(), `${payslipRoot}/${customerId}/${employeeId}.json`))
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

    const isGr = (d1: Date, d2: Date) => {
      return d1.getTime() > d2.getTime();
    }

    const isGrOrEq = (d1: Date, d2: Date) => {
      return d1.getTime() > d2.getTime();
    }

    const isLsOrEq = (d1: Date, d2: Date) => {
      return d1.getTime() <= d2.getTime();
    }

    // Подразделение получаем из массива подразделений dept,
    // как первый элемент с максимальной датой, но меньший даты окончания расч. листка
    // Аналогично с должностью из массива pos
    //let maxDate: Date = paySlip.dept[0].d;

    //TODO: а может массив оказаться пустым? это где-то проверяется
    let department = payslip.dept[0].name;
    let maxDate = payslip.dept[0].d;

    for (const dept of payslip.dept) {
      if (isGr(dept.d, maxDate) && isLsOrEq(dept.d, de)) {
        department = dept.name;
        maxDate = dept.d;
      }
    }

    let position = payslip.pos[0].name;
    maxDate = payslip.pos[0].d;

    for (const pos of payslip.pos) {
      if (isGr(pos.d, maxDate) && isLsOrEq(pos.d, de)) {
        position = pos.name;
        maxDate = pos.d;
      }
    }

    let salary = payslip.salary[0].s;
    maxDate = payslip.salary[0].d;

    for (const posS of payslip.salary) {
      if (isGr(posS.d, maxDate) && isLsOrEq(posS.d, de)) {
        salary = posS.s;
        maxDate = posS.d;
      }
    }

    let hourrate: number | undefined = undefined;

    if (payslip.hourrate) {
      hourrate = payslip.hourrate[0].s;
      maxDate = payslip.hourrate[0].d;

      for (const posHR of payslip.hourrate) {
        if (isGr(posHR.d, maxDate) && isLsOrEq(posHR.d, de)) {
          hourrate = posHR.s;
          maxDate = posHR.d;
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
    } as IPaySlipData;

    //Цикл по всем записям начислений-удержаний
    for (const value of Object.values(payslip.data)) {
      if (isGrOrEq(value.db, db) && isLsOrEq(value.de, de)) {
        //TODO: а если в справочнике не окажется значения с таким типом?
        const { det, s, typeId } = value;
        const { name, type } = accDedObj[typeId];

        switch (type) {
          case 'SALDO':
            data.saldo = { name, s };
            break;

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

  private _getPaySlipByRate(data: IPaySlipData, rate: number) {
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

  //getShortPaySlip(data: IPaySlipData, customerId: string, employeeId: string, db: Date, de: Date, lng: Language, currencyId?: string): Template {
  private _getShortPaySlip(data: IPaySlipData, db: Date, de: Date, employeeName: string, periodName: string, lng: Language, currencyName: string): Template {
    const accruals = sum(data.accrual);
    const taxes = sum(data.tax);
    const deds = sum(data.deduction);
    const advances = sum(data.advance);
    const incomeTax = sum(data.tax, 'INCOME_TAX');
    const pensionTax = sum(data.tax, 'PENSION_TAX');
    const tradeUnionTax = sum(data.tax, 'TRADE_UNION_TAX');

    return [
      ['Расчетный листок'],
      [employeeName],
      [`Период: ${periodName}`],
      [`Валюта: ${currencyName}`],
      [`Курс на ${date2str(db)}:`, data.rate],
      ['='],
      ['Начислено:', accruals, true],
      ['='],
      ['Зарплата чистыми:', accruals - taxes],
      ['  Удержания:', deds, true],
      ['  Аванс:', advances, true],
      ['  К выдаче:', data.saldo?.s, true],
      ['='],
      ['Налоги:', taxes],
      ['  Подоходный:', incomeTax, true],
      ['  Пенсионный:', pensionTax, true],
      ['  Профсоюзный:', tradeUnionTax, true],
      ['='],
      [`Информация на ${date2str(de)}:`],
      ['Подразделение:'],
      [getLName(data.department, [lng])],
      ['Должность:'],
      [getLName(data.position, [lng])],
      ['Оклад:', data.salary, true],
      ['ЧТС:', data.hourrate, true]
    ];
  }

  /*
  //getDetailPaySlip(data: IPaySlipData, customerId: string, employeeId: string, db: Date, de: Date, lng: Lang, currencyId?: string): Template {
  getDetailPaySlip(data: IPaySlipData, db: Date, de: Date, employeeName: string, periodName: string, lng: Language, currencyName: string): Template {
    const accruals = sum(data.accrual);
    const taxes = sum(data.tax);
    const deds = sum(data.deduction);
    const advances = sum(data.advance);
    const taxDeds = sum(data.tax_deduction);
    const privilages = sum(data.privilage);

    const strAccruals = data.accrual?.map( i => ([getLName(i.name, [lng]) + ' ' + i.s]));
    const strDeductions = data.deduction?.map( i => ([getLName(i.name, [lng]) + ' ' + i.s]));
    const strAdvances = data.advance?.map( i => ([getLName(i.name, [lng]) + ' ' + i.s]));
    const strTaxes = data.tax?.map( i => ([getLName(i.name, [lng]) + ' ' + i.s]));
    const strTaxDeds = data.tax_deduction?.map( i => ([getLName(i.name, [lng]) + ' ' + i.s]));
    const strPrivilages = data.privilage?.map( i => ([getLName(i.name, [lng]) + ' ' + i.s]));

    return [
      ['Расчетный листок'],
      [employeeName],
      [`Период: ${periodName}`],
      [`Валюта: ${currencyName}`],
      [`Курс на ${date2str(db)}:`, data.rate],
      ['='],
      ['Начисления:', accruals, true],
      [accruals ? '=' : ''],
      [strAccruals],
      [accruals ? '=' : ''],
      ['Удержания:', deds, true],
      [deds ? '=' : ''],
      [strDeductions],
      [deds ? '=' : ''],
      ['Аванс:', advances, true],
      [advances ? '=' : ''],
      [strAdvances],
      [advances ? '=' : ''],
      ['Налоги:', taxes, true],
      [taxes ? '=' : ''],
      [strTaxes],
      [taxes ? '=' : ''],
      ['Вычеты:', taxDeds, true],
      [taxDeds ? '=' : ''],
      [strTaxDeds],
      [taxDeds ? '=' : ''],
      ['Льготы:', privilages, true],
      [privilages ? '=' : ''],
      [strPrivilages],
      [privilages ? '=' : ''],
      [`Информация на ${date2str(de)}:`],
      ['Подразделение:'],
      [getLName(data.department, [lng])],
      ['Должность:'],
      [getLName(data.position, [lng])],
      ['Оклад:', data.salary, true],
      ['ЧТС:', data.hourrate, true]
    ];
  }

  getComparePaySlip(dataI: IPaySlipData, dataII: IPaySlipData, customerId: string, employeeId: string, dbI: Date, deI: Date, dbII: Date, deII: Date, lng: Lang, currencyId?: string):Template {
    const empls = this.getEmployeesByCustomer(customerId);
    const emplName = `${empls[employeeId].lastName} ${empls[employeeId].firstName.slice(0, 1)}. ${empls[employeeId].patrName.slice(0, 1)}.`;
    const currencyAbbreviation = getCurrencyAbbreviationById(currencyId);

    const accrualsI = dataI.accrual?.reduce((prev, cur) => prev + cur.s, 0) || 0;
    const taxesI = dataI.tax?.reduce((prev, cur) => prev + cur.s, 0) || 0;
    const dedsI = dataI.deduction?.reduce((prev, cur) => prev + cur.s, 0) || 0;
    const advancesI = dataI.advance?.reduce((prev, cur) => prev + cur.s, 0) || 0;

    const incomeTaxI = dataI.tax?.reduce((prev, cur) => prev + (cur.type === 'INCOME_TAX' ? cur.s : 0), 0) || 0;
    const pensionTaxI = dataI.tax?.reduce((prev, cur) => prev + (cur.type === 'PENSION_TAX' ? cur.s : 0), 0) || 0;
    const tradeUnionTaxI = dataI.tax?.reduce((prev, cur) => prev + (cur.type === 'TRADE_UNION_TAX' ? cur.s : 0), 0) || 0;

    const accrualsII = dataII.accrual?.reduce((prev, cur) => prev + cur.s, 0) || 0;
    const taxesII = dataII.tax?.reduce((prev, cur) => prev + cur.s, 0) || 0;
    const dedsII = dataII.deduction?.reduce((prev, cur) => prev + cur.s, 0) || 0;
    const advancesII = dataII.advance?.reduce((prev, cur) => prev + cur.s, 0) || 0;

    const incomeTaxII = dataII.tax?.reduce((prev, cur) => prev + (cur.type === 'INCOME_TAX' ? cur.s : 0), 0) || 0;
    const pensionTaxII = dataII.tax?.reduce((prev, cur) => prev + (cur.type === 'PENSION_TAX' ? cur.s : 0), 0) || 0;
    const tradeUnionTaxII = dataII.tax?.reduce((prev, cur) => prev + (cur.type === 'TRADE_UNION_TAX' ? cur.s : 0), 0) || 0;

    return  [
              ['Сравнение расчетных листков'],
              [emplName],
              [`Валюта: ${currencyAbbreviation}`],
              [` I: ${date2str(dbI)}-${date2str(deI)}`],
              [`II: ${date2str(dbII)}-${date2str(deII)}`],
              [`Курс на ${date2str(dbI)}:`, dataI.rate],
              [`Курс на ${date2str(dbII)}:`, dataII.rate],
              ['='],
              ['Начислено  I:', accrualsI, true],
              ['Начислено II:', accrualsII, true],
              ['Разница:', accrualsII - accrualsI],
              ['='],
              ['Чистыми  I:', accrualsI - taxesI],
              ['Чистыми II:', accrualsII - taxesII],
              ['Разница:', accrualsII - taxesII - (accrualsI - taxesI)],
              ['  К выдаче  I:', dataI.saldo?.s, true],
              ['  К выдаче II:', dataII.saldo?.s, true],
              ['  Разница:', dataII.saldo?.s || 0 - (dataI.saldo?.s || 0)],
              [(accrualsII - taxesII) || (accrualsI - taxesI) ? '=' : ''],
              ['  Удержания  I:', dedsI, true],
              ['  Удержания II:', dedsII, true],
              ['  Разница:', dedsII - dedsI],
              ['  Аванс  I:', advancesI, true],
              ['  Аванс II:', advancesII, true],
              ['  Разница:', advancesII - advancesI],
              [dedsI || dedsII ? '=' : ''],
              ['Налоги  I:', taxesI, true],
              ['Налоги II:', taxesII, true],
              ['Разница:', taxesII - taxesI],
              ['  Подоходный  I:', incomeTaxI, true],
              ['  Подоходный II:', incomeTaxII, true],
              ['  Разница:', incomeTaxII - incomeTaxI],
              ['  Пенсионный  I:', pensionTaxI, true],
              ['  Пенсионный II:', pensionTaxI, true],
              ['  Разница:', pensionTaxII - pensionTaxI],
              ['  Профсоюзный  I:', tradeUnionTaxI, true],
              ['  Профсоюзный II:', tradeUnionTaxII, true],
              ['  Разница:', tradeUnionTaxII - tradeUnionTaxI],
              [taxesI || taxesII ? '=' : ''],
              [`Информация на ${date2str(deI)}:`],
              ['Подразделение:'],
             // [this.getPaySlipString('', getLName(dataI.department, [lng, 'ru']))],
              ['Должность:'],
            //   [this.getPaySlipString('', getLName(dataI.position, [lng, 'ru']))],
              ['='],
              [`Информация на ${date2str(deII)}:`],
              ['Подразделение:'],
             // [this.getPaySlipString('', getLName(dataII.department, [lng, 'ru']))],
              ['Должность:'],
              //[this.getPaySlipString('', getLName(dataII.position, [lng, 'ru']))],
              ['='],
              [`Оклад на ${date2str(deI)}:`, dataI.salary, true],
              [`Оклад на ${date2str(deII)}:`, dataII.salary, true],
              ['Разница:', dataII.salary || 0 - (dataII.salary || 0)],
              [`ЧТС на ${date2str(deI)}:`, dataI.hourrate, true],
              [`ЧТС на ${date2str(deII)}:`, dataII.hourrate, true],
              ['Разница:', dataII.hourrate || 0 - (dataI.hourrate || 0)]
            ];
  }
  */

  //async getPaySlip(chatId: string, typePaySlip: TypePaySlip, lng: Lang, db: Date, de: Date, dbII?: Date, deII?: Date): Promise<string> {
  async getPaySlip(customerId: string, employeeId: string, typePaySlip: TypePaySlip, lng: Language, currencyId: string, db: Date, de: Date, dbII?: Date): Promise<string> {

    const paySlipView = (template: Template) => {
      const lenS = 10;
      const len = 19;
      return template.filter( t => t[0] && (t[1] || t[1] === undefined ) )
        .map(t => Array.isArray(t[0])
          ? '!!!'
          : t[1] === undefined
          ? `${t[0] === '=' ? '==============================' : t[0]}`
          : `${t[0]!.toString().padEnd(len)} ${new Intl.NumberFormat('ru-RU', { style: 'decimal', useGrouping: true, minimumFractionDigits: 2}).format(t[1]).padStart(lenS)}`)
        .join('\n');
    };

    const rate = currencyId && await getCurrRate(db, currencyId);

    if (currencyId && !rate) {
      return getLocString('cantLoadRate', lng, currencyId);
    }

    let dataI = this._getPaySlipData(customerId, employeeId, db, de);

    if (!dataI) {
      return '';
    }

    if (rate) {
      dataI = this._getPaySlipByRate(dataI, rate);
    }

    const employees = this._employees[customerId];
    const employee = employees?.read(employeeId);
    const employeeName = employee
      ? `${employee.lastName} ${employee.firstName.slice(0, 1)}. ${employee.patrName ? employee.patrName.slice(0, 1) + '.' : ''}`
      : 'Bond, James Bond';

    const periodName = de.getFullYear() !== db.getFullYear() || de.getMonth() !== db.getMonth()
      ? `${date2str(db)}-${date2str(de)}`
      : `${db.toLocaleDateString(lng, { month: 'long', year: 'numeric' })}`;
    const currencyName = getCurrencyAbbreviationById(currencyId);

    return '```ini\n' + paySlipView(this._getShortPaySlip(dataI, db, de, employeeName, periodName, lng, currencyName)) + '```';

    /*
    let template: Template = [];

    switch (typePaySlip) {
      case 'DETAIL': {
        template = this.getDetailPaySlip(dataI, customerId, employeeId, db, de, lng, currencyId);
      }
      case 'CONCISE': {
        template = this.getShortPaySlip(dataI, customerId, employeeId, db, de, lng, currencyId);
      }
      case 'COMPARE': {
        if (dbII && deII) {
          let dataII = this.getPaySlipData(customerId, employeeId, dbII, deII);
          if (!dataII) {
            return ''
          }
          if (currencyId) {
            dataII = await this.getPaySlipByRate(dataII, currencyId, dbII);
            if (!dataII.rate) {
              return ('Курс валюты не был загружен')
            }
          }
          template = this.getComparePaySlip(dataI, dataII, customerId, employeeId, db, de, dbII, deII, lng, currencyId);
        }
      }
    }
    return this.paySlipView(template);
    */
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
};