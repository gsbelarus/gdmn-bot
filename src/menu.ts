import { Lang, StringResource, getLocString } from "./stringResources";

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
    { type: 'BUTTON', caption: '💰 Листок за период', command: 'payslipForPeriod' },
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

export const keyboardCalendar = (lng: Lang, year: number): Menu => {
  const mm = [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [8, 9, 10, 11]
  ];

  return mm.map(mr => mr.map(m => ({ type: 'BUTTON', caption: getLocString(`shortMonth${m}` as StringResource, lng), command: `month;${year};${m}` } as IMenuButton)))
    .concat([[
      { type: 'BUTTON', caption: ' < ', command: '{ "type": "CHANGE_YEAR", "delta": -1 }' },
      { type: 'BUTTON', caption: `${year}`, command: `otherYear;${year}` },
      { type: 'BUTTON', caption: ' > ', command: '{ "type": "CHANGE_YEAR", "delta": -1 }' }
    ]])
    .concat([[{ type: 'BUTTON', caption: 'Меню', command: 'menu' }]]);
};