import { Language, LName } from "./stringResources";

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
  state?: any;
  context?: any;
  /**
   * надо для телеграма, чтобы подменять инлайн меню
   */
  lastMenuId?: number;
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

export type PayslipType = 'DETAIL' | 'CONCISE' | 'COMPARE';

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
};