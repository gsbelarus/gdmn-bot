export interface ICustomer {
  id: string;
  name: string;
  aliases: string[];
};

export interface IEmployee {
  id: string;
  firstName: string;
  lastName: string;
  patrName: string;
  passportId: string;
  tabNumber: string;
};

export interface IAccountLink {
  customerId: string;
  employeeId: string;
  currencyId?: number;
  language?: string;
};

export interface IDialogStateBase {
  type: 'INITIAL' | 'LOGGING_IN' | 'LOGGED_IN' | 'GETTING_CONCISE' | 'GETTING_COMPARE' | 'GETTING_CURRENCY' | 'GETTING_SETTINGS';
  lastUpdated: number;
  menuMessageId?: number;
};

export interface IDialogStateInitial extends IDialogStateBase {

};

export interface IDialogStateLoggingIn extends IDialogStateBase, Partial<Omit<IEmployee, 'id'>> {
  type: 'LOGGING_IN';
  employee: Partial<IEmployee> & { customerId?: string };
};

export interface IDialogStateLoggedIn extends IDialogStateBase {
  type: 'LOGGED_IN';
};

export interface IDialogStateGettingConcise extends IDialogStateBase {
  type: 'GETTING_CONCISE';
  db?: Date;
  de?: Date;
};

export interface IDialogStateGettingCompare extends IDialogStateBase {
  type: 'GETTING_COMPARE';
  fromDb?: Date;
  fromDe?: Date;
  toDb?: Date;
  toDe?: Date;
};

export interface IDialogStateGettingCurrency extends IDialogStateBase {
  type: 'GETTING_CURRENCY';
  currencyId?: number;
};

export type DialogState = IDialogStateInitial
  | IDialogStateLoggingIn
  | IDialogStateLoggedIn
  | IDialogStateGettingConcise
  | IDialogStateGettingCompare
  | IDialogStateGettingCurrency;

export interface IAccDeds {
 [id: string]: IAccDed
}

/**
 * Информация о начислении/ударжании.
 * Наименование и тип.
 */
export interface IAccDed {
  name: LName;
  type: 'ACCRUAL' | 'DEDUCTION' | 'TAX_DEDUCTION' | 'ADVANCE' | 'PRIVILAGE' | 'INCOME_TAX' | 'PENSION_TAX' | 'TRADE_UNION_TAX' | 'TAX' | 'REFERENCE';
}

export interface IPaySlip {
  version: "1.0";
  employeeId: string;
  year: number;
  deptName: LName;
  posName: LName;
  hiringDate: Date;
  dismissalDate: Date;
  data: {
    typeId: string;
    dateBegin?: Date;
    dateEnd?: Date;
    date?: Date;
    granularity?: 'DAY';
    s: number;
    adddata?: any;
  }[]
}

export interface IPaySlipItem {
  name: string;
  type: 'ACCRUAL' | 'DEDUCTION' | 'TAX_DEDUCTION' | 'ADVANCE' | 'PRIVILAGE' | 'INCOME_TAX' | 'PENSION_TAX' | 'TRADE_UNION_TAX' | 'TAX' | 'REFERENCE';
  s: number;
 }

 export type ITypePaySlip = 'DETAIL' | 'CONCISE' | 'COMPARE'
/**
 * TODO: этот кусок мы просто скопировали из gdmn-internals
 * когда оформим gdmn-internals в отдельный пакет, надо убрать
 * этот код и заменить на импорт пакета
 */

export type Lang = 'ru' | 'by' | 'en';

export interface ITName {
  name: string;
  fullName?: string;
};

export type LName = {
  [lang in Lang]?: ITName;
};

export interface IMonth {
  name: LName;
}

export const monthList: IMonth[] = [
  {name: {'ru': {name: 'янв'}}}, {name: {'ru': {name: 'фев'}}},{name: {'ru': {name: 'март'}}},
  {name: {'ru': {name: 'апр'}}}, {name: {'ru': {name: 'май'}}},{name: {'ru': {name: 'июн'}}},
  {name: {'ru': {name: 'июл'}}}, {name: {'ru': {name: 'авг'}}},{name: {'ru': {name: 'сен'}}},
  {name: {'ru': {name: 'окт'}}}, {name: {'ru': {name: 'ноя'}}},{name: {'ru': {name: 'дек'}}},
]

export interface INBRBCurrency  {
  Cur_ID: number;
  Cur_ParentID: number;
  Cur_Code: string;
  Cur_Abbreviation: string;
  Cur_Name: string;
  Cur_Name_Bel: string;
  Cur_Name_Eng: string;
  Cur_QuotName: string;
  Cur_QuotName_Bel: string;
  Cur_QuotName_Eng: string;
  Cur_NameMulti: string;
  Cur_Name_BelMulti: string;
  Cur_Name_EngMulti: string;
  Cur_Scale: number;
  Cur_Periodicity: number;
  Cur_DateStart: Date;
  Cur_DateEnd: Date;
};

export type NBRBCurrencies = INBRBCurrency[];

export interface INBRBRate {
  Cur_ID: number;
  Date: Date;
  Cur_Abbreviation: string;
  Cur_Scale: number;
  Cur_Name: string;
  Cur_OfficialRate: number;
};

export type NBRBRates = INBRBRate[];

