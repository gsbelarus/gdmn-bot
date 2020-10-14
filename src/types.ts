import { Language, LName, ILocString } from "./stringResources";
import { IBotMachineContext } from "./machine";
import { StateValue } from "xstate";
import { ILoggerParams } from "./log";

export interface IConfig {
  telegram: {
    token: string;
    useWebHook?: boolean;
    callbackHost?: string;
    hookPath?: string;
    port?: number;
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

/**
 * Дата, только год и месяц.
 */
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
  /**
   * Дата рождения. При считывании из файла и при обработке
   * POST запроса с Гедымина, преобразовывается
   */
  birthday?: Date;
};

export interface IScheduleData {
  /**
   * РУИД графика.
   */
  id: string;
  name: LName;
  data: {
    d: Date;
    t?: number;
    h?: number;
  }[];
};

export interface IAccountLink {
  customerId: string;
  employeeId: string;
  currency?: string;
  language?: Language;
  state?: StateValue;
  context?: Exclude<IBotMachineContext, 'platform' | 'chatId' | 'semaphore' | 'customerId' | 'employeeId'>;
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

export interface ISchedule {
  id: string;
  name: LName;
  d: Date;
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
  schedule: ISchedule[];
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
  saldo: IPayslipItem[],
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

export interface ITimeSheet {
  emplId: string;
  data: {
    d: Date;
    t?: number;
    h?: number;
  }[];
};

export interface ITimeSheetJSON {
  emplId: string;
  data: {
    d: string;
    t?: number;
    h?: number;
  }[];
};

export interface ICurrencyRate {
  date: Date,
  rate: number
};

export interface IUserGroup {
  id: string;
  name: LName;
};

export interface IHourType {
  name: LName;
};

//TODO: используется?
export type UserGroups = IUserGroup[];

export interface IUsersByGroups {
  [groupId: string]: {
    userIds: string[];
  }
};

export interface IAnnouncement {
  id: string;
  date: Date;
  fromCustomerId: string;
  fromEmployeeId: string;
  /**
   * Если CustomerId не указан, то сообщение рассылается
   * всем пользователям чат-бота.
   */
  toCustomerId?: string;
  toDepartmentId?: string;
  toEmployeeId?: string;
  body: string;
};

export type ICanteenMenus = ICanteenMenu[];

export interface ICanteenMenu {
  /**
   * Уникальный идентификатор меню.
   */
  id: string;
  /**
   * Наименоване меню. Например, "Меню столовой", "Меню буфета"
   */
  name: ILocString;
  /**
   * Группы и блюда.
   */
  data: ICanteenMenuData[];
};

export interface ICanteenMenuData {
  /**
   * Название группы блюд. Например, "Закуски"
   */
  group: ILocString;
  /**
   * Порядковый номер вывода группы при печати меню. Меньшие номера идут вначале.
   */
  n: number;
  /**
   * Список блюд в данной группе.
   */
  groupdata: {
    /**
     * Наименование блюда.
     */
    good: ILocString;
    /**
     * Дополнительная информация: выход, калорийность и т.п.
     */
    det: string;
    /**
     * Цена.
     */
    cost: number;
  }[];
};

/**
 * Объект, который используется при загрузке меню на сервер.
 */
export interface ICanteenMenuUpload {
  /**
   * Сейчас строго "2.0"
   */
  version: string;
  /**
   * ИД клиента.
   */
  customerId: string;
  /**
   * Меню загружается одним запросом за один день. Дата в формате "yyyy.mm.dd"
   */
  date: string;
  objData: ICanteenMenus;
};

export function isICanteenMenuUpload(m: any): m is ICanteenMenuUpload {
  return m instanceof Object
    && typeof(m.version) === 'string'
    && m.version === '2.0'
    && typeof(m.customerId) === 'string'
    && m.customerId
    && typeof(m.date) === 'string'
    && m.date
    && Array.isArray(m.objData)
};