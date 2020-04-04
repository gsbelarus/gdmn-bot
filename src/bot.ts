import { DialogState, IAccountLink, IDialogStateLoggingIn, IAccDed, IPaySlip, LName, Lang, ITypePaySlip, ICustomers, IEmploeeByCustomer } from "./types";
import { FileDB, IData } from "./util/fileDB";
import path from 'path';
import { normalizeStr, getYears, getLName, getPaySlipString, getSumByRate } from "./util/utils";

export interface IMenuButton {
  type: 'BUTTON';
  caption: string;
  command: string;
};

export interface IMenuLink {
  type: 'LINK';
  caption: string;
  url: string;
};

export type MenuItem = IMenuButton | IMenuLink;

export type Menu = MenuItem[][];

const keyboardLogin: Menu = [
  [
    { type: 'BUTTON', caption: '✏ Зарегистрироваться', command: 'login' },
    { type: 'LINK', caption: '❓', url: 'http://gsbelarus.com' }
  ]
];

export const keyboardMenu: Menu = [
  [
    { type: 'BUTTON', caption: '💰 Расчетный листок', command: 'paySlip' },
    { type: 'BUTTON', caption: '💰 Подробный листок', command: 'detailPaySlip' }
  ],
  [
    { type: 'BUTTON', caption: '💰 Листок за период', command: 'paySlipByPeriod' },
    { type: 'BUTTON', caption: '💰 Сравнить..', command: 'paySlipCompare' }
  ],
  [
    { type: 'BUTTON', caption: '🔧 Параметры', command: 'settings' },
    { type: 'BUTTON', caption: '🚪 Выйти', command: 'logout' }
  ],
  [
    { type: 'LINK', caption: '❓', url: 'http://gsbelarus.com' }
  ]
];

export class Bot {

  private _accountLink: FileDB<IAccountLink>;
  private _dialogStates: FileDB<DialogState>;
  private getCustomers: () => ICustomers;
  private getEmployeesByCustomer: (customerId: string) => IEmploeeByCustomer;
  private getAccDeds: (customerId: string) => IData<IAccDed>;
  private getPaySlipByUser: (customerId: string, userId: string, year: number) => IData<IPaySlip>;

  constructor(dir: string,
    getCustomers: () => ICustomers,
    getEmployeesByCustomer: (customerId: string) => IEmploeeByCustomer,
    getAccDeds: (customerId: string) => IData<IAccDed>,
    getPaySlipByUser: (customerId: string, userId: string, year: number) => IData<IPaySlip>) {
    this._accountLink = new FileDB<IAccountLink>(path.resolve(process.cwd(), `data/${dir}/accountlink.json`), {});
    this._dialogStates = new FileDB<DialogState>(path.resolve(process.cwd(), `data/${dir}/dialogstates.json`), {});
    this.getCustomers = getCustomers;
    this.getEmployeesByCustomer = getEmployeesByCustomer;
    this.getPaySlipByUser = getPaySlipByUser;
    this.getAccDeds = getAccDeds;
  }

  get accountLink() {
    return this._accountLink;
  }

  get dialogStates() {
    return this._dialogStates;
  }

  /**
   * Посылает сообщение в чат пользователя.
   * @param chatId
   * @param message
   */
  async sendMessage(chatId: string, message: string, menu?: Menu, markdown?: boolean) {

  }

  /**
   * Диалог регистрации
   * @param chatId
   */
  async loginDialog(chatId: string, message?: string) {
    if (!message) {
      await this.sendMessage(chatId, 'Для регистрации в системе введите указанные данные.');
      this._dialogStates.merge(chatId, { type: 'LOGGING_IN', lastUpdated: new Date().getTime(), employee: {} });
    }

    const dialogState = this._dialogStates.getMutable(true)[chatId];

    if (!dialogState || dialogState.type !== 'LOGGING_IN') {
      throw new Error('Invalid dialog state');
    }

    const text = !message ? '' : normalizeStr(message);
    const { employee } = dialogState as IDialogStateLoggingIn;

    if (text) {
      if (!employee.customerId) {
        const found = Object.entries(this.getCustomers).find(([_, c]) =>
          normalizeStr(c.name) === text || c.aliases.find(
            (a: any) => normalizeStr(a) === text
          )
        );

        if (found) {
          employee.customerId = found[0];
        } else {
          await this.sendMessage(chatId, '😕 Такого предприятия нет в базе данных!', keyboardLogin);
          this._dialogStates.merge(chatId, { type: 'INITIAL', lastUpdated: new Date().getTime() }, ['employee']);
          return;
        }
      }
      else if (!employee.firstName) {
        employee.firstName = text;
      }
      else if (!employee.lastName) {
        employee.lastName = text;
      }
      else if (!employee.patrName) {
        employee.patrName = text;
      }
      else if (!employee.passportId) {
        employee.passportId = text;
      }
      else if (!employee.tabNumber) {
        employee.tabNumber = text;
      }
    }

    if (employee.tabNumber && employee.customerId) {
      let employees = this.getEmployeesByCustomer(employee.customerId);

      const found = employees ? Object.entries(employees).find(
        ([_, e]) =>
          normalizeStr(e.firstName) === employee.firstName
          &&
          normalizeStr(e.lastName) === employee.lastName
          &&
          normalizeStr(e.patrName) === employee.patrName
          &&
          normalizeStr(e.passportId) === employee.passportId
          &&
          normalizeStr(e.tabNumber) === employee.tabNumber
      )
        : undefined;

      if (found) {
        this._accountLink.merge(chatId, {
          customerId: employee.customerId,
          employeeId: found[0]
        });
        this._accountLink.flush();
        this._dialogStates.merge(chatId, { type: 'LOGGED_IN', lastUpdated: new Date().getTime() }, ['employee']);
        this.sendMessage(chatId, '🏁 Регистрация прошла успешно.', keyboardMenu);
      } else {
        this.sendMessage(chatId,
          `
  Сотрудник не найден в базе данных.

  Обратитесь в отдел кадров или повторите регистрацию.

  Были введены следующие данные:
  Предприятие: ${employee.customerId}
  Имя: ${employee.firstName}
  Фамилия: ${employee.lastName}
  Отчество: ${employee.patrName}
  Идентификационный номер: ${employee.passportId}
  Табельный номер: ${employee.tabNumber}
  `, keyboardLogin);

        this._dialogStates.merge(chatId, { type: 'INITIAL', lastUpdated: new Date().getTime() }, ['employee']);
      }
    } else {
      if (!employee.customerId) {
        this.sendMessage(chatId, 'Введите название предприятия:');
      }
      else if (!employee.firstName) {
        this.sendMessage(chatId, 'Введите имя:');
      }
      else if (!employee.lastName) {
        this.sendMessage(chatId, 'Введите фамилию:');
      }
      else if (!employee.patrName) {
        this.sendMessage(chatId, 'Введите отчество:');
      }
      else if (!employee.passportId) {
        this.sendMessage(chatId, 'Введите идентификационный номер из паспорта:');
      }
      else if (!employee.tabNumber) {
        this.sendMessage(chatId, 'Введите табельный номер из расчетного листка:');
      }
    }
  }

  getRateByCurrency(db: Date, currencyId: number) {
    return 123
  }

  getCurrencyAbbreviationById(currencyId: number) {
    return '123'
  }

  getPaySlip(chatId: string, typePaySlip: ITypePaySlip, lng: Lang, db: Date, de: Date, toDb?: Date, toDe?: Date): string | undefined {
    const link = this._accountLink.read(chatId);

    if (link?.customerId && link.employeeId) {

      const { customerId, employeeId, currencyId = 0 } = link;
      const rate = this.getRateByCurrency(db, currencyId);
      const currencyAbbreviation = this.getCurrencyAbbreviationById(currencyId);

      if (rate === -1) {
        return (`${'`'}${'`'}${'`'}ini
  Повторите действие через несколько минут.
  Выполняется загрузка курсов валют...
          ${'`'}${'`'}${'`'}`)
      }

      let empls = this.getEmployeesByCustomer(customerId);

      const passportId = empls ? empls[employeeId].passportId : undefined;

      if (passportId) {
        const accDedObj = this.getAccDeds(customerId);

        let allTaxes = [0, 0];

        let accrual = [0, 0], salary = [0, 0], tax = [0, 0], ded = [0, 0], saldo = [0, 0],
          incomeTax = [0, 0], pensionTax = [0, 0], tradeUnionTax = [0, 0], advance = [0, 0], tax_ded = [0, 0], privilage = [0, 0];

        let strAccruals = '', strAdvances = '', strDeductions = '', strTaxes = '', strPrivilages = '', strTaxDeds = '';

        let deptName = '';
        let posName = '';
        const dbMonthName = db.toLocaleDateString(lng, { month: 'long', year: 'numeric' });

        /** Получить информацию по расчетным листкам за период*/
        const getAccDedsByPeriod = (fromDb: Date, fromDe: Date, i: number) => {
          const years = getYears(fromDb, fromDe);
          //пробегаемся по всем годам
          for (let y = 0; y < years.length; y++) {
            const year = years[y];
            let paySlip = this.getPaySlipByUser(customerId, passportId, year);

            if (!paySlip || Object.keys(paySlip).length === 0) {
              this.sendMessage(chatId,
                `Нет расчетного листка за период ${fromDb.toLocaleDateString()} - ${fromDe.toLocaleDateString()}!`,
                keyboardMenu);
            } else {

              deptName = getLName(paySlip.deptName as LName, [lng, 'ru']);
              posName = getLName(paySlip.posName as LName, [lng, 'ru']);

              for (const [key, value] of Object.entries(paySlip.data) as any) {
                if (new Date(value?.dateBegin) >= fromDb && new Date(value?.dateEnd) <= fromDe || new Date(value?.date) >= fromDb && new Date(value?.date) <= fromDe) {
                  if (value.typeId === 'saldo') {
                    saldo[i] = saldo[i] + value.s;
                  } else if (value.typeId === 'salary') {
                    salary[i] = value.s;
                  } else if (accDedObj[value.typeId]) {

                    let accDedName = getLName(accDedObj[value.typeId].name, [lng, 'ru']);

                    switch (accDedObj[value.typeId].type) {
                      case 'INCOME_TAX': {
                        incomeTax[i] = incomeTax[i] + value.s;
                        strTaxes = typePaySlip === 'DETAIL' ? getPaySlipString(strTaxes, accDedName, value.s) : ''
                        break;
                      }
                      case 'PENSION_TAX': {
                        pensionTax[i] = pensionTax[i] + value.s;
                        strTaxes = typePaySlip === 'DETAIL' ? getPaySlipString(strTaxes, accDedName, value.s) : ''
                        break;
                      }
                      case 'TRADE_UNION_TAX': {
                        tradeUnionTax[i] = tradeUnionTax[i] + value.s;
                        strTaxes = typePaySlip === 'DETAIL' ? getPaySlipString(strTaxes, accDedName, value.s) : ''
                        break;
                      }
                      case 'ADVANCE': {
                        advance[i] = advance[i] + value.s;
                        strAdvances = typePaySlip === 'DETAIL' ? getPaySlipString(strAdvances, accDedName, value.s) : ''
                        break;
                      }
                      case 'DEDUCTION': {
                        ded[i] = ded[i] + value.s;
                        strDeductions = typePaySlip === 'DETAIL' ? getPaySlipString(strDeductions, accDedName, value.s) : ''
                        break;
                      }
                      case 'TAX': {
                        tax[i] = tax[i] + value.s;
                        break;
                      }
                      case 'ACCRUAL': {
                        accrual[i] = accrual[i] + value.s;
                        strAccruals = typePaySlip === 'DETAIL' ? getPaySlipString(strAccruals, accDedName, value.s) : ''
                        break;
                      }
                      case 'TAX_DEDUCTION': {
                        tax_ded[i] = tax_ded[i] + value.s;
                        strTaxDeds = typePaySlip === 'DETAIL' ? getPaySlipString(strTaxDeds, accDedName, value.s) : ''
                        break;
                      }
                      case 'PRIVILAGE': {
                        privilage[i] = privilage[i] + value.s;
                        strPrivilages = typePaySlip === 'DETAIL' ? getPaySlipString(strPrivilages, accDedName, value.s) : ''
                        break;
                      }
                    }
                  }
                }
              };

              allTaxes[i] = getSumByRate(incomeTax[i], rate) + getSumByRate(pensionTax[i], rate) + getSumByRate(tradeUnionTax[i], rate);
            }
          }//for
        };

        //Данные по листку заносятся в массивы с индектом = 0
        getAccDedsByPeriod(db, de, 0);
        const lenS = 8;

        switch (typePaySlip) {
          case 'DETAIL': {
            const len = 37;
            return (`${'`'}${'`'}${'`'}ini
      Расчетный листок ${dbMonthName}
      ${'Начисления:'.padEnd(len)}  ${getSumByRate(accrual[0], rate).toFixed(2).padStart(lenS)}
      ===============================================
      ${strAccruals}
      ===============================================
      ${'Аванс:'.padEnd(len)}  ${getSumByRate(advance[0], rate).toFixed(2).padStart(lenS)}
      ===============================================
      ${strAdvances}
      ===============================================
      ${'Удержания:'.padEnd(len)}  ${getSumByRate(ded[0], rate).toFixed(2).padStart(lenS)}
      ===============================================
      ${strDeductions}
      ===============================================
      ${'Налоги:'.padEnd(len)}  ${allTaxes[0].toFixed(2).padStart(lenS)}
      ===============================================
      ${strTaxes}
      ===============================================
      ${'Вычеты:'.padEnd(len)}  ${getSumByRate(tax_ded[0], rate).toFixed(2).padStart(lenS)}
      ===============================================
      ${strTaxDeds}
      ===============================================
      ${'Льготы:'.padEnd(len)}  ${getSumByRate(privilage[0], rate).toFixed(2).padStart(lenS)}
      ===============================================
      ${strPrivilages}
      ${'Информация:'.padEnd(len)}
        ${deptName}
        ${posName}
      ${'Оклад:'.padEnd(len + 2)}  ${getSumByRate(salary[0], rate).toFixed(2).padStart(lenS)}
      ${'Валюта:'.padEnd(len + 2)}  ${currencyAbbreviation.padStart(lenS)}
   ${'`'}${'`'}${'`'}`)
          }
          case 'CONCISE': {
            const len = 30;
            const m = de.getFullYear() !== db.getFullYear() || de.getMonth() !== db.getMonth() ? `с ${db.toLocaleDateString()} по ${de.toLocaleDateString()}` : `${dbMonthName}`;
            return (`${'`'}${'`'}${'`'}ini
    Расчетный листок ${m}
    ${'Начислено:'.padEnd(len + 2)}  ${getSumByRate(accrual[0], rate).toFixed(2).padStart(lenS)}
    ==========================================
    ${'Зарплата (чистыми):'.padEnd(len + 2)}  ${(getSumByRate(accrual[0], rate) - allTaxes[0]).toFixed(2).padStart(lenS)}
      ${'Аванс:'.padEnd(len)}  ${getSumByRate(advance[0], rate).toFixed(2).padStart(lenS)}
      ${'К выдаче:'.padEnd(len)}  ${getSumByRate(saldo[0], rate).toFixed(2).padStart(lenS)}
      ${'Удержания:'.padEnd(len)}  ${getSumByRate(ded[0], rate).toFixed(2).padStart(lenS)}
    ==========================================
    ${'Налоги:'.padEnd(len + 2)}  ${allTaxes[0].toFixed(2).padStart(lenS)}
      ${'Подоходный:'.padEnd(len)}  ${getSumByRate(incomeTax[0], rate).toFixed(2).padStart(lenS)}
      ${'Пенсионный:'.padEnd(len)}  ${getSumByRate(pensionTax[0], rate).toFixed(2).padStart(lenS)}
      ${'Профсоюзный:'.padEnd(len)}  ${getSumByRate(tradeUnionTax[0], rate).toFixed(2).padStart(lenS)}
    ==========================================
    ${'Информация:'.padEnd(len)}
      ${deptName}
      ${posName}
    ${'Оклад:'.padEnd(len + 2)}  ${getSumByRate(salary[0], rate).toFixed(2).padStart(lenS)}
    ${'Валюта:'.padEnd(len + 2)}  ${currencyAbbreviation.padStart(lenS)}
  ${'`'}${'`'}${'`'}`);
          }
          case 'COMPARE': {
            if (toDb && toDe) {
              const len = 23;
              //Данные по листку за второй период заносятся в массивы с индектом = 1
              getAccDedsByPeriod(toDb, toDe, 1);

              return (`${'`'}${'`'}${'`'}ini
    ${'Сравнение расчетных листков'.padEnd(len + 2)}
    Период I:  ${db.toLocaleDateString()} - ${de.toLocaleDateString()}
    Период II: ${toDb.toLocaleDateString()} - ${toDe.toLocaleDateString()}
                                      I       II
    ${'Начислено:'.padEnd(len + 2)}  ${getSumByRate(accrual[0], rate).toFixed(2).padStart(lenS)} ${getSumByRate(accrual[1], rate).toFixed(2).padStart(lenS)} ${(getSumByRate(accrual[1], rate) - getSumByRate(accrual[0], rate)).toFixed(2).padStart(lenS)}
    =====================================================
    ${'Зарплата (чистыми):'.padEnd(len + 2)}  ${(getSumByRate(accrual[0], rate) - allTaxes[0]).toFixed(2).padStart(lenS)} ${(getSumByRate(accrual[1], rate) - allTaxes[1]).toFixed(2).padStart(lenS)} ${(getSumByRate(accrual[1], rate) - allTaxes[1] - (getSumByRate(accrual[0], rate) - allTaxes[0])).toFixed(2).padStart(lenS)}
      ${'Аванс:'.padEnd(len)}  ${getSumByRate(advance[0], rate).toFixed(2).padStart(lenS)} ${getSumByRate(advance[1], rate).toFixed(2).padStart(lenS)} ${(getSumByRate(advance[1], rate) - getSumByRate(advance[0], rate)).toFixed(2).padStart(lenS)}
      ${'К выдаче:'.padEnd(len)}  ${getSumByRate(saldo[0], rate).toFixed(2).padStart(lenS)} ${getSumByRate(saldo[1], rate).toFixed(2).padStart(lenS)} ${(getSumByRate(saldo[1], rate) - getSumByRate(saldo[0], rate)).toFixed(2).padStart(lenS)}
      ${'Удержания:'.padEnd(len)}  ${getSumByRate(ded[0], rate).toFixed(2).padStart(lenS)} ${getSumByRate(ded[1], rate).toFixed(2).padStart(lenS)} ${(getSumByRate(ded[1], rate) - getSumByRate(ded[0], rate)).toFixed(2).padStart(lenS)}
    =====================================================
    ${'Налоги:'.padEnd(len + 2)}  ${allTaxes[0].toFixed(2).padStart(lenS)} ${allTaxes[1].toFixed(2).padStart(lenS)} ${(allTaxes[1] - allTaxes[0]).toFixed(2).padStart(lenS)}
      ${'Подоходный:'.padEnd(len)}  ${getSumByRate(incomeTax[0], rate).toFixed(2).padStart(lenS)} ${getSumByRate(incomeTax[1], rate).toFixed(2).padStart(lenS)} ${(getSumByRate(incomeTax[1], rate) - getSumByRate(incomeTax[0], rate)).toFixed(2).padStart(lenS)}
      ${'Пенсионный:'.padEnd(len)}  ${getSumByRate(pensionTax[0], rate).toFixed(2).padStart(lenS)} ${getSumByRate(pensionTax[1], rate).toFixed(2).padStart(lenS)} ${(getSumByRate(pensionTax[1], rate) - getSumByRate(pensionTax[0], rate)).toFixed(2).padStart(lenS)}
      ${'Профсоюзный:'.padEnd(len)}  ${getSumByRate(tradeUnionTax[0], rate).toFixed(2).padStart(lenS)} ${getSumByRate(getSumByRate(tradeUnionTax[1], rate), rate).toFixed(2).padStart(lenS)} ${(getSumByRate(getSumByRate(tradeUnionTax[1], rate), rate) - getSumByRate(tradeUnionTax[0], rate)).toFixed(2).padStart(lenS)}
    =====================================================
    ${'Информация:'.padEnd(len)}
      ${'Оклад:'.padEnd(len)}  ${getSumByRate(salary[0], rate).toFixed(2).padStart(lenS)} ${getSumByRate(salary[1], rate).toFixed(2).padStart(lenS)} ${(getSumByRate(salary[1], rate) - getSumByRate(salary[0], rate)).toFixed(2).padStart(lenS)}
      ${'Валюта:'.padEnd(len + 2)}${currencyAbbreviation.padStart(lenS)}
    ${'`'}${'`'}${'`'}`);
            }
          }
        }
      }
    }
    return undefined
  }

  /**
   * Обработка поступившего текста или команды из чата.
   * @param chatId
   * @param message
   */
  process(chatId: string, message: string, fromId?: string, fromUserName?: string) {

    console.log(`Из чата ${chatId} нам пришел такой текст: ${message}`)

    const dialogState = this._dialogStates.read(chatId);

    if (dialogState?.type === 'LOGGING_IN') {
      this.loginDialog(chatId, message);
    } else if (dialogState?.type === 'LOGGED_IN' && message === 'организации') {
      //Почему здесь было reply?
      this.sendMessage(chatId, Object.values(this.getCustomers).map(c => c.name).join(', '));
      this.sendMessage(chatId, chatId);
      fromId && this.sendMessage(chatId, fromId);
      fromUserName && this.sendMessage(chatId, fromUserName);
    } else if (dialogState?.type === 'INITIAL') {
      this.sendMessage(chatId,
        'Для получения информации о заработной плате необходимо зарегистрироваться в системе.',
        keyboardLogin);
    } else {
      this.sendMessage(chatId,
        `
  🤔 Ваша команда непонятна.

  Выберите одно из предложенных действий.
  `, keyboardMenu);
    }
  }

  /**
   * Вызывается при запуске чат бота клиентом.
   * @param chatId
   */
  start(chatId: string) {
    const link = this.accountLink.read(chatId);

    console.log('start');

    if (!link) {
      this.dialogStates.merge(chatId, { type: 'INITIAL', lastUpdated: new Date().getTime() });
      this.sendMessage(chatId,
        'Приветствуем! Для получения информации о заработной плате необходимо зарегистрироваться в системе.',
        keyboardLogin);
    } else {
      this.dialogStates.merge(chatId, { type: 'LOGGED_IN', lastUpdated: new Date().getTime() });
      this.sendMessage(chatId,
        'Здравствуйте! Вы зарегистрированы в системе. Выберите одно из предложенных действий.',
        keyboardMenu);
    }
  }

  async logout(chatId: string) {
    await this.sendMessage(chatId, '💔 До свидания!', keyboardLogin);
    this.accountLink.delete(chatId);
    this.dialogStates.merge(chatId, { type: 'INITIAL', lastUpdated: new Date().getTime() }, ['employee']);
  }

  paySlip(chatId: string, typePaySlip: ITypePaySlip, lng: Lang, db: Date, de: Date) {
    const cListok = this.getPaySlip(chatId, typePaySlip, lng, db, de);
    cListok && this.sendMessage(chatId, cListok, keyboardMenu, true);
  }

  /**
   * Вызов справки.
   * @param chatId
   * @param state
   */
  help(chatId: string, state: DialogState) {
    this.sendMessage(chatId, 'Help message')
  }

  finalize() {
    this.accountLink.flush();
    this.dialogStates.flush();
  }
};