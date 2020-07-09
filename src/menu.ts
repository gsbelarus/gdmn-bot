import { ILocString, stringResources } from "./stringResources";
import { UserRightId } from "./security";

export interface IMenuButton {
  type: 'BUTTON';
  caption: ILocString;
  command: string;
  needRight?: UserRightId;
};

export interface IMenuStatic {
  type: 'STATIC';
  label: string;
  needRight?: UserRightId;
};

export interface IMenuLink {
  type: 'LINK';
  caption: ILocString;
  url: string;
  needRight?: UserRightId;
};

export type MenuItem = IMenuButton | IMenuLink | IMenuStatic;

export type Menu = MenuItem[][];

export const keyboardMenu: Menu = [
  [
    { type: 'BUTTON', caption: stringResources.menuWage, command: '.wage' },
    { type: 'BUTTON', caption: stringResources.menuOther, command: '.other' }
  ],
  [
    { type: 'BUTTON', caption: stringResources.menuSettings, command: '.settings' },
    { type: 'BUTTON', caption: stringResources.menuLogout, command: '.logout' }
  ],
  [
    { type: 'LINK', caption: stringResources.menuHelp, url: 'http://gsbelarus.com/pw/front-page/solutions/android/chat-bot-moia-zarplata/' }
  ]
];

export const keyboardWage: Menu = [
  [
    { type: 'BUTTON', caption: stringResources.menuPayslip, command: '.payslip' },
    { type: 'BUTTON', caption: stringResources.menuDetailedPayslip, command: '.detailedPayslip' }
  ],
  [
    { type: 'BUTTON', caption: stringResources.menuPayslipForPeriod, command: '.payslipForPeriod' },
    { type: 'BUTTON', caption: stringResources.menuComparePayslip, command: '.comparePayslip' }
  ],
  [
    { type: 'BUTTON', caption: stringResources.btnBackToMenu, command: '.cancelWage' },
  ]
];

export const keyboardEnterAnnouncement: Menu = [
  [
    { type: 'BUTTON', caption: stringResources.btnCancelEnterAnnouncement, command: '.cancelEnterAnnouncement' },
  ]
];

export const keyboardSendAnnouncement: Menu = [
  [{ type: 'BUTTON', caption: stringResources.btnSendToDepartment, command: '.sendToDepartment' }],
  [{ type: 'BUTTON', caption: stringResources.btnSendToEnterprise, command: '.sendToEnterprise' }],
  [{ type: 'BUTTON', caption: stringResources.btnSendToAll, command: '.sendToAll' }],
  [{ type: 'BUTTON', caption: stringResources.btnCancelSendAnnouncement, command: '.cancelSendAnnouncement' }],
];

export const keyboardOther: Menu = [
  //TODO: temporarily
  /*
  [
    { type: 'BUTTON', caption: stringResources.menuSchedule, command: '.schedule' },
    { type: 'BUTTON', caption: stringResources.menuTable, command: '.table' }
  ],
  */
  [
    { type: 'BUTTON', caption: stringResources.menuBirthdays, command: '.birthdays', needRight: 'BIRTHDAYS' },
    { type: 'BUTTON', caption: stringResources.menuRates, command: '.rates' }
  ],
  /*
  [
    { type: 'BUTTON', caption: stringResources.menuBillboard, command: '.billboard' },
  ],
  */
  [
    { type: 'BUTTON', caption: stringResources.btnBackToMenu, command: '.cancelOther' },
  ]
];

export const keyboardSettings: Menu = [
  [
    { type: 'BUTTON', caption: stringResources.menuSelectLanguage, command: '.selectLanguage' },
    { type: 'BUTTON', caption: stringResources.menuSelectCurrency, command: '.selectCurrency' }
  ],
  [
    { type: 'BUTTON', caption: stringResources.btnBackToMenu, command: '.cancelSettings' },
  ]
];

export const keyboardLanguage: Menu = [
  ...[['BE', stringResources.languageBE], ['RU', stringResources.languageRU], ['EN', stringResources.languageEN]].map(
    l => ([{ type: 'BUTTON', caption: l[1], command: `.selectLanguage/${l[0]}` } as IMenuButton])
  ),
  [{ type: 'BUTTON', caption: stringResources.btnBackToSettingsMenu, command: '.cancelSettings' }]
];

export const keyboardCurrency: Menu = [
  ...[
      ['BYN', stringResources.currencyBYN],
      ['USD', stringResources.currencyUSD],
      ['EUR', stringResources.currencyEUR],
      ['RUB', stringResources.currencyRUR],
      ['PLN', stringResources.currencyPLN],
      ['UAH', stringResources.currencyUAH],
     ].map( l => ([{ type: 'BUTTON', caption: l[1], command: `.selectCurrency/${l[0]}` } as IMenuButton]) ),
  [{ type: 'BUTTON', caption: stringResources.btnBackToSettingsMenu, command: '.cancelSettings' }]
];

export const keyboardCurrencyRates: Menu = [
  ...[
      ['USD', stringResources.currencyUSD],
      ['EUR', stringResources.currencyEUR],
      ['RUB', stringResources.currencyRUR],
      ['PLN', stringResources.currencyPLN],
      ['UAH', stringResources.currencyUAH],
     ].map( l => ([{ type: 'BUTTON', caption: l[1], command: `{ "type": "SELECT_CURRENCY", "id": "${l[0]}" }` } as IMenuButton]) ),
  [{ type: 'BUTTON', caption: stringResources.btnBackToMenu, command: '.cancelRates' }]
];

export const keyboardCalendar = (year: number): Menu => {
  const mm = [
    [ [0, stringResources.shortMonth0], [1, stringResources.shortMonth1], [2, stringResources.shortMonth2],   [ 3, stringResources.shortMonth3] ],
    [ [4, stringResources.shortMonth4], [5, stringResources.shortMonth5], [6, stringResources.shortMonth6],   [ 7, stringResources.shortMonth7] ],
    [ [8, stringResources.shortMonth8], [9, stringResources.shortMonth9], [10, stringResources.shortMonth10], [ 11, stringResources.shortMonth11] ]
  ];

  return mm.map( mr => mr.map( m => (
    {
      type: 'BUTTON',
      caption: m[1],
      command: `{ "type": "SELECT_MONTH", "month": ${m[0]} }`
    } as MenuItem
  )))
    .concat([[
      { type: 'BUTTON', caption: stringResources.btnPrevYear, command: '{ "type": "CHANGE_YEAR", "delta": -1 }' },
      { type: 'STATIC', label: `${year}` },
      { type: 'BUTTON', caption: stringResources.btnNextYear, command: '{ "type": "CHANGE_YEAR", "delta": 1 }' }
    ]])
    .concat([[{ type: 'BUTTON', caption: stringResources.btnBackToMenu, command: '{ "type": "CANCEL_CALENDAR" }' }]]);
};