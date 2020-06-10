import { IDate, ICurrencyRate } from "./types";
import { date2str } from "./util/utils";

type FormatFunc = (...args: any[]) => string;

export interface ILocString {
  en: string | null | FormatFunc;
  ru: string | null | FormatFunc;
  be: string | null | FormatFunc;
};

export const stringResources = {
  askCompanyName: {
    en: 'Hi!\n\nTo receive payslips you need to sign up.\n\nEnter your company or organization name.',
    ru: 'Здравствуйте!\n\nДля получения расчетных листков необходимо зарегистрироваться.\n\nВведите наименование вашего предприятия или организации.',
    be: 'Прывітанне!\n\nДля атрымання разліковых лісткоў неабходна зарэгістравацца.\n\nУвядзіце назву вашага прадпрыемства альбо арганізацыі.'
  },
  unknownCompanyName: {
    en: 'We can\'t find a company or organization with such name.\n\nApparently you have made a typo while entering the name or your company doesn\'t use system "Gedemin: Payroll calculation".\n\nTry again.',
    ru: 'Мы не можем найти предприятие или организацию с таким названием.\n\nВозможно вы ошиблись при вводе или ваше предприятие не использует систему "Гедымин: Расчет заработной платы".\n\nПопробуйте ввести еще раз.',
    be: 'Мы ня можам знайсці прадпрыемства альбо арганізацыю з такой назвай.\n\nМагчыма Вы памыліліся пры ўводзе, альбо вашае прадпрыемства не выкарыстоўвае сістэму "Гедымін: Разлік зарабку".\n\nПаспрабуйце яшчэ раз.'
  },
  unknownEmployee: {
    en: 'We can\'t find an employee with such personal identification umber.\n\nCheck the data and repeat the enter.',
    ru: 'Мы не можем найти сотрудника с таким идентификационным номером.\n\nПроверьте, правильно ли Вы указали данные и повторите ввод.',
    be: 'Мы ня можам знайсці супрацоўніка з такім ідэнтыфікацыйным нумарам.\n\nПраверце, ці дакладна Вы ўказалі дадзеныя і паўтарыце ўвод.'
  },
  askPersonalNumber: {
    en: 'Enter your personal identification number from passport.',
    ru: 'Введите свой персональный идентификационный номер из паспорта.',
    be: 'Увядзіце свой персанальны ідэнтыфікацыйны нумар з пашпарту.'
  },
  mainMenuCaption: {
    en: 'Select a command from the menu.',
    ru: 'Выберите команду из меню.',
    be: 'Выбярыце каманду з меню.'
  },
  goodbye: {
    en: 'Good-bye! Thank you for being with us.\n\nTo begin new registration enter /start command.',
    ru: 'До свидания! Спасибо, что были с нами.\n\nЧтобы начать новую регистрацию введите\nкоманду /start',
    be: 'Да пабачэння! Дзякуй, што былі з намі.\n\nКаб распачаць новую рэгістрацыю ўвядзіце\nкаманду /start'
  },
  noData: {
    en: '😕 There is no data for selected period!',
    ru: '😕 Нет данных за выбранный период!',
    be: '😕 Няма дадзеных за выбраны перыяд!'
  },
  weAreLost: {
    en: '😕 Sorry! I\'m lost a little bit. Please, start it over.',
    ru: '😕 Извините, я тут немного запутался. Начните с начала.',
    be: '😕 Выбачайце, я тут крыху заблытаўся. Пачніце з пачатку.'
  },
  showSettings: {
    en: (employee: string, lang: Language, curr: string) => `Current settings:\n\tEmployee: ${employee}\n\tLanguage: ${lang}\n\tCurrency: ${curr}`,
    ru: (employee: string, lang: Language, curr: string) => `Текущие настройки:\n\tСотрудник: ${employee}\n\tЯзык: ${lang}\n\tВалюта: ${curr}`,
    be: (employee: string, lang: Language, curr: string) => `Бягучыя настройкі:\n\tСупрацоўнік: ${employee}\n\tМова: ${lang}\n\tВалюта: ${curr}`
  } as ILocString,
  showSelectedDate: {
    en: (d: IDate) => `Selected month ${d.month + 1}.${d.year}`,
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
    en: 'Select the date of the beginning of period.',
    ru: 'Выберите дату начала периода.',
    be: 'Выбярыце дату пачатку перыяду.'
  },
  selectDE: {
    en: 'Select the date of the ending of period.',
    ru: 'Выберите дату окончания периода.',
    be: 'Выбярыце дату заканчэння перыяду.'
  },
  selectDB2: {
    en: 'Select the date of the beginning of second period.',
    ru: 'Выберите дату начала второго периода.',
    be: 'Выбярыце дату пачатку другога перыяду.'
  },
  selectMonth: {
    en: 'Select month.',
    ru: 'Выберите месяц.',
    be: 'Выбярыце месяц.'
  },
  menuPayslip: {
    en: '💰 Payslip',
    ru: '💰 Расчетный листок',
    be: '💰 Разліковы лісток',
  },
  menuDetailedPayslip: {
    en: '💰 Detailed payslip',
    ru: '💰 Подробный листок',
    be: '💰 Падрабязны лісток',
  },
  menuPayslipForPeriod: {
    en: '💰 Payslip for period',
    ru: '💰 Листок за период',
    be: '💰 Лісток за перыяд',
  },
  menuComparePayslip: {
    en: '⚖ Compare...',
    ru: '⚖ Сравнить...',
    be: '⚖ Параўнаць...'
  },
  menuSettings: {
    en: '🛠 Settings',
    ru: '🛠 Настройки',
    be: '🛠 Настройкі',
  },
  menuLogout: {
    en: '🚪 Logout',
    ru: '🚪 Выйти',
    be: '🚪 Выйсці'
  },
  menuHelp: {
    en: '❓',
    ru: '❓',
    be: '❓'
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
  },
  hours: {
    en: 'h.',
    ru: 'ч.',
    be: 'г.'
  },
  days: {
    en: 'd.',
    ru: 'д.',
    be: 'д.'
  },
  payslipDepartment: {
    en: 'Department:',
    ru: 'Подразделение:',
    be: 'Падраздзяленне:'
  },
  payslipPosition: {
    en: 'Position:',
    ru: 'Должность:',
    be: 'Пасада:'
  },
  payslipSalary: {
    en: 'Salary:',
    ru: 'Оклад:',
    be: 'Аклад:'
  },
  payslipHpr: {
    en: 'H/R:',
    ru: 'ЧТС:',
    be: 'ПТС:'
  },
  payslipAccrued: {
    en: 'Accrued:',
    ru: 'Начислено:',
    be: 'Налічана:'
  },
  payslipNetsalary: {
    en: 'Net salary:',
    ru: 'Начислено:',
    be: 'Зарплата чыстымі:'
  },
  payslipDeductions: {
    en: '  Deductions:',
    ru: '  Удержания:',
    be: '  Ўтрымання:'
  },
  payslipAdvance: {
    en: '  Advance:',
    ru: '  Аванс:',
    be: '  Аванс:'
  },
  payslipPayroll: {
    en: '  PayRoll:',
    ru: '  К выдаче:',
    be: '  Да выдачы:'
  },
  payslipTaxes: {
    en: 'Taxes:',
    ru: 'Налоги:',
    be: 'Падаткi:'
  },
  payslipIncometax: {
    en: '  Income:',
    ru: '  Подоходный:',
    be: '  Падаходны:'
  },
  payslipPensionTax: {
    en: '  Pension:',
    ru: '  Подоходный:',
    be: '  Падаходны:'
  },
  payslipTradeUnionTax: {
    en: '  Trade-union:',
    ru: '  Профсоюзный:',
    be: '  Прафсаюзны:'
  },
  payslipPrivilages: {
    en: 'Privilages:',
    ru: 'Льготы:',
    be: 'Льготы:'
  },
  payslipDeductionsWOSpace: {
    en: 'Deductions:',
    ru: 'Удержания:',
    be: 'Ўтрымання:'
  },
  payslipAdvanceWOSpace: {
    en: 'Advance:',
    ru: 'Аванс:',
    be: 'Аванс:'
  },
  payslipTaxDeduction: {
    en: 'Tax deduction:',
    ru: 'Вычеты:',
    be: 'Вылiкi:'
  },
  payslipPeriod: {
    en: 'Period: ',
    ru: 'Период: ',
    be: 'Перыяд: '
  },
  payslipCurrency: {
    en: (currency: string, currencyRate?: ICurrencyRate) => 'Currency: ' + (
      currencyRate
        ? `${currency}, exchange rate ${currencyRate.rate.toFixed(2)} on ${date2str(currencyRate.date, 'DD.MM.YY')}`
        : 'Belarusian ruble'),
    ru: (currency: string, currencyRate?: ICurrencyRate) => 'Валюта: ' + (
      currencyRate
        ? `${currency}, курс ${currencyRate.rate.toFixed(2)} на ${date2str(currencyRate.date, 'DD.MM.YY')}`
        : 'Белорусский рубль'),
    be: (currency: string, currencyRate?: ICurrencyRate) => 'Валюта: ' + (
      currencyRate
        ? `${currency}, курс ${currencyRate.rate.toFixed(2)} на ${date2str(currencyRate.date, 'DD.MM.YY')}`
        : 'Беларускі рубель')
  },
  payslipCurrencyCompare: {
    en: (currency: string, currencyRate?: ICurrencyRate, currencyRate2?: ICurrencyRate) => 'Currency: ' + (
      currencyRate && currencyRate2
        ? `${currency}\exchange rate ${currencyRate.rate.toFixed(2)} on ${date2str(currencyRate.date, 'DD.MM.YY')}\n${currencyRate2.rate.toFixed(2)} on ${date2str(currencyRate2.date, 'DD.MM.YY')}`
        : 'Belarusian ruble'),
    ru: (currency: string, currencyRate?: ICurrencyRate, currencyRate2?: ICurrencyRate) => 'Валюта: ' + (
      currencyRate && currencyRate2
        ? `${currency}\nкурс ${currencyRate.rate.toFixed(2)} на ${date2str(currencyRate.date, 'DD.MM.YY')}\n${currencyRate2.rate.toFixed(2)} на ${date2str(currencyRate2.date, 'DD.MM.YY')}`
        : 'Белорусский рубль'),
    be: (currency: string, currencyRate?: ICurrencyRate, currencyRate2?: ICurrencyRate) => 'Валюта: ' + (
      currencyRate && currencyRate2
        ? `${currency}\nкурс ${currencyRate.rate.toFixed(2)} на ${date2str(currencyRate.date, 'DD.MM.YY')}\n${currencyRate2.rate.toFixed(2)} на ${date2str(currencyRate2.date, 'DD.MM.YY')}`
        : 'Беларускі рубель')
  },
  payslipCurrencyPeriod: {
    en: (db: IDate, de: IDate, db2: IDate, de2: IDate) => 'Period:\n' + (de.year !== db.year || de.month !== db.month
        ? `${db.month + 1}.${db.year}-${de.month + 1}.${de.year}`
        : `${new Date(db.year, db.month).toLocaleDateString('en', { month: 'long', year: 'numeric' })}`
      ) + ' to ' + (de2.year !== db2.year || de2.month !== db2.month
        ? `${db2.month + 1}.${db2.year}-${de2.month + 1}.${de2.year}`
        : `${new Date(db2.year, db2.month).toLocaleDateString('en', { month: 'long', year: 'numeric' })}`
      ),
    ru: (db: IDate, de: IDate, db2: IDate, de2: IDate) => 'Период:\n' + (de.year !== db.year || de.month !== db.month
        ? `${db.month + 1}.${db.year}-${de.month + 1}.${de.year}`
        : `${new Date(db.year, db.month).toLocaleDateString('ru', { month: 'long', year: 'numeric' })}`
      ) + ' к ' + (de2.year !== db2.year || de2.month !== db2.month
        ? `${db2.month + 1}.${db2.year}-${de2.month + 1}.${de2.year}`
        : `${new Date(db2.year, db2.month).toLocaleDateString('ru', { month: 'long', year: 'numeric' })}`
      ),
    be:(db: IDate, de: IDate, db2: IDate, de2: IDate) => 'Перыяд:\n' + (de.year !== db.year || de.month !== db.month
        ? `${db.month + 1}.${db.year}-${de.month + 1}.${de.year}`
        : `${new Date(db.year, db.month).toLocaleDateString('be', { month: 'long', year: 'numeric' })}`
      ) + ' да ' + (de2.year !== db2.year || de2.month !== db2.month
        ? `${db2.month + 1}.${db2.year}-${de2.month + 1}.${de2.year}`
        : `${new Date(db2.year, db2.month).toLocaleDateString('be', { month: 'long', year: 'numeric' })}`
      )
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
