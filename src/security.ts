export const userRightIds = [
  /**
   * Право на рассылку объявления внутри подразделения.
   */
  'ANN_DEPT',
  /**
   * Право на рассылку объявления внутри предприятия.
   */
  'ANN_ENT',
  /**
   */
  'ANN_GLOBAL',
  /**
   * Право на просмотр д/р.
   */
  'BIRTHDAYS',
  /**
   * Право на график р/вр.
   */
  'SCHEDULE',
  /**
   * Право на табель.
   */
  'TABLE',
  /**
   * Право на доступ к системе, включая регистрацию.
   */
  'ACCESS',
  /**
   * Право на меню общепита.
   */
  'CANTEEN_MENU'
] as const;

export type UserRightId = typeof userRightIds[number];

export interface IUserRightRule {
  rights: UserRightId[];
  read?: boolean;
  write?: boolean;
  eneryone?: boolean;
  users?: string[];
  groups?: string[];
};

export type UserRights = IUserRightRule[];