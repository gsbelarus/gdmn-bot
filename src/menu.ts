import { StringResource } from "./stringResources";

export interface IMenuButton {
  type: 'BUTTON';
  caption: StringResource;
  command: string;
};

export interface IMenuStatic {
  type: 'STATIC';
  label: string;
};

export interface IMenuLink {
  type: 'LINK';
  caption: StringResource;
  url: string;
};

export type MenuItem = IMenuButton | IMenuLink | IMenuStatic;

export type Menu = MenuItem[][];

export const keyboardMenu: Menu = [
  [
    { type: 'BUTTON', caption: 'menuPayslip', command: 'payslip' },
    { type: 'BUTTON', caption: 'menuDetailedPayslip', command: 'detailPayslip' }
  ],
  [
    { type: 'BUTTON', caption: 'menuPayslipForPeriod', command: 'payslipForPeriod' },
    { type: 'BUTTON', caption: 'menuComparePayslip', command: 'comparePayslip' }
  ],
  [
    { type: 'BUTTON', caption: 'menuSettings', command: 'settings' },
    { type: 'BUTTON', caption: 'menuLogout', command: 'logout' }
  ],
  [
    { type: 'LINK', caption: 'menuHelp', url: 'http://gsbelarus.com' }
  ]
];

export const keyboardSettings: Menu = [
  [
    { type: 'BUTTON', caption: 'menuSelectLanguage', command: 'selectLanguage' },
    { type: 'BUTTON', caption: 'menuSelectCurrency', command: 'selectCurrency' }
  ],
  [
    { type: 'BUTTON', caption: 'btnBackToMenu', command: 'cancelSettings' },
  ]
];

export const keyboardLanguage: Menu = [
  ...['BE', 'RU', 'EN'].map(
    l => ([{ type: 'BUTTON', caption: `language${l}`, command: `selectLanguage/${l}` } as IMenuButton])
  ),
  [{ type: 'BUTTON', caption: 'btnBackToSettingsMenu', command: 'cancelSettings' }]
];

export const keyboardCurrency: Menu = [
  ...['BYN', 'USD', 'EUR', 'RUR', 'PLN', 'UAH'].map(
    l => ([{ type: 'BUTTON', caption: `currency${l}`, command: `selectCurrency/${l}` } as IMenuButton])
  ),
  [{ type: 'BUTTON', caption: 'btnBackToSettingsMenu', command: 'cancelSettings' }]
];

export const keyboardCalendar = (year: number): Menu => {
  const mm = [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [8, 9, 10, 11]
  ];

  return mm.map( mr => mr.map( m => (
    {
      type: 'BUTTON',
      caption: `shortMonth${m}` as StringResource,
      command: `{ "type": "SELECT_MONTH", "month": ${m} }`
    } as MenuItem
  )))
    .concat([[
      { type: 'BUTTON', caption: 'btnPrevYear', command: '{ "type": "CHANGE_YEAR", "delta": -1 }' },
      { type: 'STATIC', label: `${year}` },
      { type: 'BUTTON', caption: 'btnNextYear', command: '{ "type": "CHANGE_YEAR", "delta": 1 }' }
    ]])
    .concat([[{ type: 'BUTTON', caption: 'btnBackToMenu', command: '{ "type": "CANCEL_CALENDAR" }' }]]);
};