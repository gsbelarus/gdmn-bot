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
  'ANT_GLOBAL',
  /**
   * Право на доступ к системе, включая регистрацию.
   */
  'ACCESS'
] as const;

export type UserRightId = typeof userRightIds[number];

export interface IUserRightRule {
  right: UserRightId;
  allow?: boolean;
  eneryone?: boolean;
  users?: string[];
  groups?: string[];
};

export type UserRights = IUserRightRule[];