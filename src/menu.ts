export interface IMenuButton {
  type: 'BUTTON';
  caption: string;
  command: string;
};

export interface IMenuLink {
  type: 'LINK';
  caption: string;
  url: string;
};

export type MenuItem = IMenuButton | IMenuLink;

export type Menu = MenuItem[][];

export const keyboardMenu: Menu = [
  [
    { type: 'BUTTON', caption: '💰 Расчетный листок', command: 'payslip' },
    { type: 'BUTTON', caption: '💰 Подробный листок', command: 'detailPayslip' }
  ],
  [
    { type: 'BUTTON', caption: '💰 Листок за период', command: 'concisePayslip' },
    { type: 'BUTTON', caption: '💰 Сравнить..', command: 'comparePayslip' }
  ],
  [
    { type: 'BUTTON', caption: '🔧 Параметры', command: 'settings' },
    { type: 'BUTTON', caption: '🚪 Выйти', command: 'logout' }
  ],
  [
    { type: 'LINK', caption: '❓', url: 'http://gsbelarus.com' }
  ]
];