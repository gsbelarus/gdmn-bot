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
};

export interface IDialogStateBase {
  type: 'INITIAL' | 'LOGGING_IN' | 'LOGGED_IN';
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

export type DialogState = IDialogStateInitial
  | IDialogStateLoggingIn
  | IDialogStateLoggedIn;

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


