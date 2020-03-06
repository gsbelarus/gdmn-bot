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
  type: 'ACCRUAL' | 'DEDUCTION' | 'TAX_DEDUCTION' | 'ADVANCE' | 'PRIVILAGE' | 'INCOME_TAX' | 'PENSION_TAX' | 'TRADE_UNION_TAX' | 'TAX' | 'REFERENCE' ;
}

export interface IPaySlip {
  version: "1.0";
  employeeId: string;
  year: number;
  deptName: string;
  posName: string;
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

export function getLName(n: LName, langPref: Lang[] = [], getFullName: boolean = false): string {
  for (let i = 0; i < langPref.length; i++) {
    const tn = n[langPref[i]];
    if (tn) {
      return (getFullName && tn.fullName) ? tn.fullName : tn.name;
    }
  }

  if (!n.en) return '';

  return (getFullName && n.en.fullName) ? n.en.fullName : n.en.name;
};

