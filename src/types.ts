import { IData } from "./util/fileDB";
import { Language } from "./stringResources";

export type Platform = 'TELEGRAM' | 'VIBER';
export type UpdateType = 'MESSAGE' | 'ACTION' | 'COMMAND';

/*
export interface IReplyParams {
  text?: string;
  menu?: Menu;
};
*/

export interface IUpdate {
  platform: Platform;
  chatId: string;
  userId?: string;
  type: UpdateType;
  body: string;
  language: Language;
};

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
};

export interface IAccountLink {
  customerId: string;
  employeeId: string;
  currencyId?: string;
  language?: Language;
  state?: any;
  context?: any;
  /**
   * надо для телеграма, чтобы подменять инлайн меню
   */
  lastMenuId?: number;
};

/*
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
*/

export interface IAccDeds {
 [id: string]: IAccDed
};

export type AccDedType = 'ACCRUAL' | 'DEDUCTION' | 'TAX_DEDUCTION' | 'ADVANCE' | 'PRIVILAGE' | 'INCOME_TAX' | 'PENSION_TAX' | 'TRADE_UNION_TAX' | 'TAX' | 'REFERENCE' | 'SALDO';

/**
 * Информация о начислении/удержании.
 * Наименование и тип.
 */
export interface IAccDed {
  name: LName;
  type: AccDedType;
};

export interface IPosition {
  id: string;
  name: LName;
  d: Date;
};

export interface IDepartment {
  id: string;
  name: LName;
  d: Date;
};

export interface ISalary {
  s: number;
  d: Date;
};
export interface IHourRate {
  s: number;
  d: Date;
};

export interface IDet {
  days?: number,
  hours?: number,
  incMonth?: number,
  incYear?: number
}

export interface IPaySlip {
  emplId: string;
  dept: IDepartment[];
  pos: IPosition[];
  salary: ISalary[];
  hourrate?: IHourRate[];
  data: {
    typeId: string;
    db: Date;
    de: Date;
    s: number;
    det?: IDet;
  }[];
  dismissalDate?: Date;
};

 export type TypePaySlip = 'DETAIL' | 'CONCISE' | 'COMPARE'
/**
 * TODO: этот кусок мы просто скопировали из gdmn-internals
 * когда оформим gdmn-internals в отдельный пакет, надо убрать
 * этот код и заменить на импорт пакета
 */

/*
export const monthList: LName[] = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
  .map( name => ({ ru: { name }}) );
*/

export type ICustomers = IData<Omit<ICustomer, 'id'>>
export type IEmploeeByCustomer = IData<Omit<IEmployee, 'id'>>

export const addName = {
  'days': { ru: { name: 'дн' }},
  'hours': { ru: { name: 'ч' }}
}

export interface IPaySlipItem {
  name: LName;
  s: number;
  type?: AccDedType;
  det?: IDet;
};

export interface IPaySlipData {
  department: LName;
  position: LName;
  saldo?: IPaySlipItem,
  tax?: IPaySlipItem[],
  advance?: IPaySlipItem[],
  deduction?: IPaySlipItem[],
  accrual?: IPaySlipItem[],
  tax_deduction?: IPaySlipItem[],
  privilage?: IPaySlipItem[],
  salary?: number;
  hourrate?: number;
  rate?: number;
}