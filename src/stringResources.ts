import { IDate } from "./types";

type FormatFunc = (...args: any[]) => string;

export interface ILocString {
  en: string | null | FormatFunc;
  ru: string | null | FormatFunc;
  be: string | null | FormatFunc;
};

export const stringResources = {
  askCompanyName: {
    en: 'Hi!\n\nTo receive payslips you need to sign up.\n\nEnter organization name.',
    ru: 'Здравствуйте!\n\nДля получения расчетных листков необходимо зарегистрироваться.\n\nВведите наименование организации.',
    be: 'Прывітанне!\n\nДля атрымання разліковых лісткоў неабходна зарэгістравацца.\n\nУвядзіце назву арганізацыі.'
  },
  unknownCompanyName: {
    en: null,
    ru: 'Мы не можем найти организацию с таким именем.\n\nВозможно вы ошиблись при вводе или ваша организация не использует систему "Гедымин: Расчет заработной платы".\n\nПопробуйте ввести еще раз.',
    be: null
  },
  unknownEmployee: {
    en: null,
    ru: 'Мы не можем найти сотрудника с таким идентификационным номером.\n\nПроверьте, правильно ли Вы указали данные и повторите ввод.',
    be: null
  },
  askPersonalNumber: {
    en: null,
    ru: 'Введите свой персональный идентификационный номер из паспорта.',
    be: 'Увядзіце свой персанальны ідэнтыфікацыйны нумар з пашпарту.'
  },
  mainMenuCaption: {
    en: null,
    ru: 'Выберите команду из меню.',
    be: 'Выбярыце каманду з меню.'
  },
  goodbye: {
    en: null,
    ru: 'До свидания! Спасибо, что были с нами.\n\nЧтобы начать новую регистрацию введите\nкоманду /start',
    be: 'Да пабачэння! Дзякуй, што былі з намі.\n\nКаб распачаць новую рэгістрацыю ўвядзіце\nкаманду /start'
  },
  noData: {
    en: null,
    ru: '😕 Нет данных за выбранный период!',
    be: '😕 Няма дадзеных за выбраны перыяд!'
  },
  weAreLost: {
    en: null,
    ru: '😕 Извините, я тут немного запутался. Начните с начала.',
    be: '😕 Выбачайце, я тут крыху заблытаўся. Пачніце з пачатку.'
  },
  showSettings: {
    en: null,
    ru: (employee: string, lang: Language, curr: string) => `Текущие настройки:\n\tСотрудник: ${employee}\n\tЯзык: ${lang}\n\tВалюта: ${curr}`,
    be: (employee: string, lang: Language, curr: string) => `Бягучыя настройкі:\n\tСупрацоўнік: ${employee}\n\tМова: ${lang}\n\tВалюта: ${curr}`
  } as ILocString,
  showSelectedDate: {
    en: null,
    ru: (d: IDate) => `Выбран месяц ${d.month + 1}.${d.year}`,
    be: (d: IDate) => `Выбраны месяц ${d.month + 1}.${d.year}`
  },
  shortMonth0: {
    en: 'jan',
    ru: 'янв',
    be: 'сту'
  },
  shortMonth1: {
    en: 'feb',
    ru: 'фев',
    be: 'лют'
  },
  shortMonth2: {
    en: 'mar',
    ru: 'мар',
    be: 'сак'
  },
  shortMonth3: {
    en: 'apr',
    ru: 'апр',
    be: 'кра'
  },
  shortMonth4: {
    en: 'may',
    ru: 'май',
    be: 'тра'
  },
  shortMonth5: {
    en: 'jun',
    ru: 'июн',
    be: 'чэр'
  },
  shortMonth6: {
    en: 'jul',
    ru: 'июл',
    be: 'лiп'
  },
  shortMonth7: {
    en: 'aug',
    ru: 'авг',
    be: 'жнi'
  },
  shortMonth8: {
    en: 'sep',
    ru: 'сен',
    be: 'вер'
  },
  shortMonth9: {
    en: 'oct',
    ru: 'окт',
    be: 'кас'
  },
  shortMonth10: {
    en: 'nov',
    ru: 'ноя',
    be: 'ліс'
  },
  shortMonth11: {
    en: 'dec',
    ru: 'дек',
    be: 'сне'
  },
  selectDB: {
    en: null,
    ru: 'Выберите дату начала периода.',
    be: null
  },
  selectDE: {
    en: null,
    ru: 'Выберите дату окончания периода.',
    be: null
  },
  selectDB2: {
    en: null,
    ru: 'Выберите дату начала второго периода.',
    be: null
  },
  selectMonth: {
    en: null,
    ru: 'Выберите месяц.',
    be: null
  },
  menuPayslip: {
    en: null,
    ru: '💰 Расчетный листок',
    be: '💰 Разліковы лісток',
  },
  menuDetailedPayslip: {
    en: null,
    ru: '💰 Подробный листок',
    be: null
  },
  menuPayslipForPeriod: {
    en: null,
    ru: '💰 Листок за период',
    be: null
  },
  menuComparePayslip: {
    en: null,
    ru: '💰 Сравнить...',
    be: null
  },
  menuSettings: {
    en: null,
    ru: '🔧 Настройки',
    be: null
  },
  menuLogout: {
    en: null,
    ru: '🚪 Выйти',
    be: null
  },
  menuHelp: {
    en: null,
    ru: '❓',
    be: null
  },
  menuSelectLanguage: {
    en: null,
    ru: 'Выбрать язык',
    be: null
  },
  menuSelectCurrency: {
    en: null,
    ru: 'Выбрать валюту',
    be: null
  },
  languageRU: {
    en: null,
    ru: 'Русский',
    be: null
  },
  languageBE: {
    en: null,
    ru: 'Белорусский',
    be: 'Беларуская'
  },
  languageEN: {
    en: null,
    ru: 'Английский',
    be: null
  },
  currencyBYN: {
    en: null,
    ru: 'Белорусский рубль',
    be: null
  },
  currencyUSD: {
    en: null,
    ru: 'Доллар США',
    be: null
  },
  currencyEUR: {
    en: null,
    ru: 'Евро',
    be: null
  },
  currencyRUR: {
    en: null,
    ru: 'Российский рубль',
    be: null
  },
  currencyPLN: {
    en: null,
    ru: 'Польский злотый',
    be: null
  },
  currencyUAH: {
    en: null,
    ru: 'Украинская гривна',
    be: null
  },
  btnPrevYear: {
    en: null,
    ru: ' < ',
    be: null
  },
  btnNextYear: {
    en: null,
    ru: ' > ',
    be: null
  },
  btnBackToMenu: {
    en: null,
    ru: 'Вернуться в главное меню...',
    be: null
  },
  btnBackToSettingsMenu: {
    en: null,
    ru: 'Вернуться в меню параметров...',
    be: null
  },
  cantLoadRate: {
    en: null,
    ru: (currencyId: string) => `Невозможно загрузить курс валюты ${currencyId}`,
    be: null
  } as ILocString,
  payslipTitle: {
    en: 'Payslip',
    ru: 'Расчетный листок',
    be: 'Разліковы лісток'
  },
  comparativePayslipTitle: {
    en: 'Comparative payslip',
    ru: 'Сравнительный листок',
    be: 'Параўнальны лісток'
  }
};

export type Language = keyof ILocString;
export type StringResource = keyof typeof stringResources;

export const getLocString = (r: ILocString, lang: Language, ...args: any[]) => {
  const sr = r[lang]
    ?? r['ru']
    ?? r['be']
    ?? r['en'];

  if (typeof sr === 'function') {
    return sr(...args);
  }
  else if (sr === null) {
    throw new Error(`String resource isn't defined for a given lanuage.`)
  } else {
    return sr;
  }
};

export const str2Language = (s?: string): Language => {
  switch (s?.toLowerCase()) {
    case 'be': return 'be';
    case 'en': return 'en';
  default:
    return 'ru';
  }
};

export interface ITName {
  name: string;
  fullName?: string;
};

export type LName = {
  [lang in Language]?: ITName;
};

export function getLName(n: LName, langPref: Language[] = [], getFullName: boolean = false): string {
  for (let i = 0; i < langPref.length; i++) {
    const tn = n[langPref[i]];
    if (tn) {
      return (getFullName && tn.fullName) ? tn.fullName : tn.name;
    }
  }

  return (
    (getFullName ? n.ru?.fullName : undefined) ?? n.ru?.name ??
    (getFullName ? n.be?.fullName : undefined) ?? n.be?.name ??
    (getFullName ? n.en?.fullName : undefined) ?? n.en?.name ??
    ''
  );
};
