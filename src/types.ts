import { Language, LName } from "./stringResources";
import { IBotMachineContext } from "./machine";
import { StateValue } from "xstate";

export interface IDate {
  year: number;
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
   */
  protected?: boolean;
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
  currency?: string;
  language?: Language;
  state?: StateValue;
  context?: Pick<IBotMachineContext, 'dateBegin' | 'dateEnd' | 'dateBegin2'>;
  /**
   * надо для телеграма, чтобы подменять инлайн меню
   */
  lastMenuId?: number;
  lastUpdated?: Date;
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

export interface IPayslip {
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

export type PayslipType = 'DETAIL' | 'CONCISE' | 'COMPARE';

export interface IPayslipItem {
  id: string;
  name: LName;
  s: number;
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