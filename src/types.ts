import { Language, LName } from "./stringResources";
import { IBotMachineContext } from "./machine";
import { StateValue } from "xstate";
import { ILoggerParams } from "./log";

export interface IConfig {
  telegram: {
    token: string;
  },
  viber: {
    token: string;
    callbackHost: string;
    disabled?: boolean;
  },
  httpPort: number,
  httpsPort: number,
  logger: ILoggerParams;
};

export interface IDate {
  year: number;
  /**
   * Индекс месяца, начиная с 0 (январь).
   */
  month: number;
};

export type Platform = 'TELEGRAM' | 'VIBER';
export type UpdateType = 'MESSAGE' | 'ACTION' | 'COMMAND';

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
  /**
   * Защита регистрации сотрудников дополнительным ПИН кодом.
   * См. https://docs.google.com/document/d/1XoWdsyjaMDgc0p2B7eidObij6vShxbpUqA_bBDe5ku8
   */
  protected?: boolean;
  aliases: string[];
};

export interface IEmployee {
  /**
   * РУИД сотрудника.
   */
  id: string;
  /**
   * Идентификационный номер из паспорта.
   */
  passportId: string;
  firstName: string;
  lastName: string;
  patrName?: string;
  birthday?: Date;
};

export interface IAccountLink {
  customerId: string;
  employeeId: string;
  currency?: string;
  language?: Language;
  state?: StateValue;
  context?: Pick<IBotMachineContext, 'dateBegin' | 'dateEnd' | 'dateBegin2'>;
  /**
   * надо для телеграма, чтобы подменять инлайн меню
   */
  lastMenuId?: number;
  lastUpdated?: Date;
  /**
   * Дата конца периода последнего в хронологическом порядке расчетного листка,
   * который был автоматически выслан в чат пользователя.
   */
  payslipSentOn?: Date;
};

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
  n?: number;
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

export interface IPayForm {
  slr: boolean;
  d: Date;
};

export interface IDet {
  days?: number,
  hours?: number,
  incMonth?: number,
  incYear?: number
}

export interface IPayslip {
  emplId: string;
  dept: IDepartment[];
  pos: IPosition[];
  payForm: IPayForm[];
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

export type PayslipType = 'DETAIL' | 'CONCISE' | 'COMPARE';

export interface IPayslipItem {
  id: string;
  name: LName;
  s: number;
  n: number;
  type?: AccDedType;
  det?: IDet;
};

export interface IPayslipData {
  department: LName;
  position: LName;
  saldo?: IPayslipItem,
  tax: IPayslipItem[],
  advance: IPayslipItem[],
  deduction: IPayslipItem[],
  accrual: IPayslipItem[],
  tax_deduction: IPayslipItem[],
  privilage: IPayslipItem[],
  salary?: number;
  hourrate?: number;
  rate?: number;
};

export interface ICurrencyRate {
  date: Date,
  rate: number
}