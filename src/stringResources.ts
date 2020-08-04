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
  askPIN: {
    en: (d: Date) => `Enter PIN code from your payslip of ${d.toLocaleString('en-US', { month: 'long' })} ${d.getFullYear()}.`,
    ru: (d: Date) => `Введите ПИН код из своего расчетного листка за ${d.toLocaleString('ru', { month: 'long' })} ${d.getFullYear()}.`,
    be: (d: Date) => `Увядзіце ПІН код з свайго разлiковага лicтка за ${d.toLocaleString('be', { month: 'long' })} ${d.getFullYear()}.`
  },
  invalidPIN: {
    en: (d: Date) => `Invalid PIN code!\n\nCheck PIN code from your payslip of ${d.toLocaleString('en-US', { month: 'long' })} ${d.getFullYear()} and repeat the enter.`,
    ru: (d: Date) => `Неправильный ПИН код!\n\nПроверьте, правильно ли Вы указали ПИН код из своего расчетного листка за ${d.toLocaleString('ru', { month: 'long' })} ${d.getFullYear()} и повторите ввод.`,
    be: (d: Date) => `Няверны ПІН код!\n\nПраверце, ці дакладна Вы ўказалі ПІН код з свайго разлiковага лicтка за ${d.toLocaleString('be', { month: 'long' })} ${d.getFullYear()} і паўтарыце ўвод.`
  },
  unknownCompanyName: {
    en: (customers: string) => `We can\'t find a company or organization with such name.\n\nEither you have misspelled the company name or your company doesn\'t use system "Gedemin: Payroll calculation".\n\nAs for now only following companies are supported:\n${customers}\n\nTry again.`,
    ru: (customers: string) => `Мы не можем найти предприятие или организацию с таким названием.\n\nВозможно вы ошиблись при вводе или ваше предприятие не использует систему "Гедымин: Расчет заработной платы".\n\nНа данный момент поддерживаются только следующие компании:\n${customers}\n\nПопробуйте ввести еще раз.`,
    be: (customers: string) => `Мы ня можам знайсці прадпрыемства альбо арганізацыю з такой назвай.\n\nМагчыма Вы памыліліся пры ўводзе, альбо вашае прадпрыемства не выкарыстоўвае сістэму "Гедымін: Разлік заробку".\n\nПакуль што падтрымліваюцца толькі наступныя кампаніі:\n${customers}\n\nПаспрабуйце яшчэ раз.`
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
  logoutMessage: {
    en: 'Please, confirm your decision of exiting from the chat. To register again personal employee\'s data should be entered. ',
    ru: 'Пожалуйста, подтвердите своё желание выйти из чата. Для повторной регистрации надо будет заново ввести данные сотрудника.',
    be: 'Калі ласка, пацвердзіце сваё рашэнне выйсці з чату. Для паўторнай рэгістрацыі трэба будзе наноў увесці дадзеныя супрацоўніка.'
  },
  goodbye: {
    en: 'Good-bye! Thank you for being with us.\n\nTo begin new registration enter /start command.',
    ru: 'До свидания! Спасибо, что были с нами.\n\nЧтобы начать новую регистрацию введите\nкоманду /start',
    be: 'Да пабачэння! Дзякуй, што былі з намі.\n\nКаб распачаць новую рэгістрацыю ўвядзіце\nкаманду /start'
  },
  btnConfirmLogout: {
    en: 'Confirm',
    ru: 'Подтвердить',
    be: 'Пацвердзіць'
  },
  btnCancelLogout: {
    en: 'Don\'t logout',
    ru: 'Не выходить',
    be: 'Не выходзіць'
  },
  btnConfirmSending: {
    en: 'Confirm',
    ru: 'Подтвердить',
    be: 'Пацвердзіць'
  },
  btnCancelSending: {
    en: 'Cancel sending',
    ru: 'Отменить рассылку',
    be: 'Адмяніць рассылку'
  },
  noData: {
    en: '😕 There is no data for selected period!',
    ru: '😕 Нет данных за выбранный период!',
    be: '😕 Няма дадзеных за выбраны перыяд!'
  },
  noCanteenData: {
    en: '😕 Can\'t view the canteen menu.\nYour company doesn\'t use system "Gedemin: Canteen"!',
    ru: '😕 Невозможно просмотреть меню столовой.\nНа вашем предприятии не установлена программа "Гедымин: Общепит"!',
    be: '😕 Немагчыма праглядзець меню сталовай.\nНа вашым прадпрыемстве не ўсталяваная праграма "Гедымін: Грамадзкае харчаванне"!'
  },
  noCanteenDataToday: {
    en: '😕 The canteen menu for today has not been loaded yet.\nTry later!',
    ru: '😕 Меню столовой на сегодня еще не было загружено.\nПопробуйте позже!',
    be: '😕 Меню сталовай на сёння яшчэ не было загружана.\nПаспрабуйце пазней!'
  },
  weAreLost: {
    en: '😕 Sorry! I\'m lost a little bit. Please, start it over.',
    ru: '😕 Извините, я тут немного запутался. Начните с начала.',
    be: '😕 Выбачайце, я тут крыху заблытаўся. Пачніце з пачатку.'
  },
  selectCurrency: {
    en: 'Select currency.',
    ru: 'Выберите валюту.',
    be: 'Выбярыце валюту.'
  },
  canteenMenu: {
    en: 'Select a menu.',
    ru: 'Выберите меню.',
    be: 'Выбярыце меню.'
  },
  selectLanguage: {
    en: 'Select language.',
    ru: 'Выберите язык.',
    be: 'Выбярыце мову.'
  },
  sentBy: {
    en: 'Announcement was sent by:',
    ru: 'Объявление составлено:',
    be: 'Аб\'ява складзена:'
  },
  selectYear: {
    en: (year: number) => `${year} year has been selected...`,
    ru: (year: number) => `Был выбран ${year} год...`,
    be: (year: number) => `Быў выбраны ${year} год...`,
  } as ILocString,
  showSettings: {
    en: (employee: string, department: string, lang: Language, curr: string) => `Current settings:\n\tEmployee: ${employee}\n\tDepartment: ${department}\n\tLanguage: ${lang}\n\tCurrency: ${curr}`,
    ru: (employee: string, department: string, lang: Language, curr: string) => `Текущие настройки:\n\tСотрудник: ${employee}\n\tПодразделение: ${department}\n\tЯзык: ${lang}\n\tВалюта: ${curr}`,
    be: (employee: string, department: string, lang: Language, curr: string) => `Бягучыя настройкі:\n\tСупрацоўнік: ${employee}\n\tДэпартамент: ${department}\n\tМова: ${lang}\n\tВалюта: ${curr}`
  } as ILocString,
  showSelectedDate: {
    en: (d: IDate) => `Selected month ${(d.month + 1).toString().padStart(2, '0')}.${d.year}`,
    ru: (d: IDate) => `Выбран месяц ${(d.month + 1).toString().padStart(2, '0')}.${d.year}`,
    be: (d: IDate) => `Выбраны месяц ${(d.month + 1).toString().padStart(2, '0')}.${d.year}`
  },
  todayBirthday: {
    en: 'Birthdays today',
    ru: 'Дни рождения сегодня',
    be: 'Дні народзінаў сёння',
  },
  tomorrowBirthday: {
    en: 'Birthdays tomorrow',
    ru: 'Дни рождения завтра',
    be: 'Дні народзінаў заўтра',
  },
  noBirthdays: {
    en: 'No birthdays today and tomorrow',
    ru: 'Сегодня и завтра нет дней рождений',
    be: 'Сёння і заўтра няма дзён народзінаў',
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
    en: '🔎 Detailed payslip',
    ru: '🔎 Подробный листок',
    be: '🔎 Падрабязны лісток',
  },
  menuPayslipForPeriod: {
    en: '📅 Payslip for period',
    ru: '📅 Листок за период',
    be: '📅 Лісток за перыяд',
  },
  menuComparePayslip: {
    en: '⚖ Compare...',
    ru: '⚖ Сравнить...',
    be: '⚖ Параўнаць...'
  },
  menuSettings: {
    en: '🛠 Settings...',
    ru: '🛠 Настройки...',
    be: '🛠 Настройкі...',
  },
  menuLogout: {
    en: '🚪 Logout',
    ru: '🚪 Выйти',
    be: '🚪 Выйсці'
  },
  menuWage: {
    en: '💰 Wage...',
    ru: '💰 Зарплата...',
    be: '💰 Заробак...',
  },
  menuOther: {
    en: '🚀 Other...',
    ru: '🚀 Другое...',
    be: '🚀 Іншае...',
  },
  menuSchedule: {
    en: '⏳ Working schedule',
    ru: '⏳ График',
    be: '⏳ Графік',
  },
  menuTable: {
    en: '📅 Time sheet',
    ru: '📅 Табель',
    be: '📅 Табель',
  },
  menuBirthdays: {
    en: '🎂 Birthdays',
    ru: '🎂 Дни рождения',
    be: '🎂 Дні народзінаў',
  },
  menuRates: {
    en: '💲 Currency rates',
    ru: '💲 Курсы валют',
    be: '💲 Курсы валютаў',
  },
  menuBillboard: {
    en: '📢 Billboard',
    ru: '📢 Доска объявлений',
    be: '📢 Дошка аб\'яў',
  },
  menuMenu: {
    en: '🍲 Canteen menu',
    ru: '🍲 Меню столовой',
    be: '🍲 Меню сталовай',
  },
  menuHelp: {
    en: '❓',
    ru: '❓',
    be: '❓'
  },
  menuSelectLanguage: {
    en: 'Select language',
    ru: 'Выбрать язык',
    be: 'Выбраць мову'
  },
  menuSelectCurrency: {
    en: 'Select currency',
    ru: 'Выбрать валюту',
    be: 'Выбраць валюту'
  },
  languageRU: {
    en: 'Russian',
    ru: 'Русский',
    be: 'Руская'
  },
  languageBE: {
    en: 'Belarusian',
    ru: 'Белорусский',
    be: 'Беларуская'
  },
  languageEN: {
    en: 'English',
    ru: 'Английский',
    be: 'Ангельская'
  },
  currencyBYN: {
    en: 'BYN',
    ru: 'Белорусский рубль',
    be: 'Беларускі рубель'
  },
  currencyUSD: {
    en: 'USD',
    ru: 'Доллар США',
    be: 'Даляр ЗША'
  },
  currencyEUR: {
    en: 'EUR',
    ru: 'Евро',
    be: 'Эўра'
  },
  currencyRUR: {
    en: 'RUR',
    ru: 'Российский рубль',
    be: 'Расейскі рубель'
  },
  currencyPLN: {
    en: 'PLN',
    ru: 'Польский злотый',
    be: 'Польскі злоты'
  },
  currencyUAH: {
    en: 'UAH',
    ru: 'Украинская гривна',
    be: 'Украінская грыўна'
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
    en: 'Back to main menu...',
    ru: 'Вернуться в главное меню...',
    be: 'Вярнуцца ў галоўнае меню...'
  },
  btnBackToSettingsMenu: {
    en: 'Back to settings menu...',
    ru: 'Вернуться в меню настроек...',
    be: 'Вярнуцца ў меню настроек...'
  },
  cantLoadRate: {
    en: (currencyId: string) => `Unable to load currency rate for ${currencyId}.`,
    ru: (currencyId: string) => `Невозможно загрузить курс валюты ${currencyId}.`,
    be: (currencyId: string) => `Немагчыма загрузіць курс валюты ${currencyId}.`
  } as ILocString,
  ratesForMonth: {
    en: (currencyId: string, date: IDate) => `Currency rate for ${new Date(date.year, date.month).toLocaleString('en-US', {month: 'long'})} ${date.year},\nFor one ${currencyId} in rubles:\n`,
    ru: (currencyId: string, date: IDate) => `Курс валюты за ${new Date(date.year, date.month).toLocaleString('ru', {month: 'long'})} ${date.year},\nза один ${currencyId} в рублях:\n`,
    be: (currencyId: string, date: IDate) => `Курс валюты за ${new Date(date.year, date.month).toLocaleString('be', {month: 'long'})} ${date.year},\nза адзін ${currencyId} у рублях:\n`
  } as ILocString,
  tableTitle: {
    en: (date: IDate) => `Time sheet for ${new Date(date.year, date.month).toLocaleString('en-US', {month: 'long'})} ${date.year}:\n`,
    ru: (date: IDate) => `Табель рабочего времени за ${new Date(date.year, date.month).toLocaleString('ru', {month: 'long'})} ${date.year}:\n`,
    be: (date: IDate) => `Табель працоўнага часу за ${new Date(date.year, date.month).toLocaleString('be', {month: 'long'})} ${date.year}:\n`
  } as ILocString,
  scheduleTitle: {
    en: (date: IDate) => `Work schedule for ${new Date(date.year, date.month).toLocaleString('en-US', {month: 'long'})} ${date.year}:\n`,
    ru: (date: IDate) => `График рабочего времени за ${new Date(date.year, date.month).toLocaleString('ru', {month: 'long'})} ${date.year}:\n`,
    be: (date: IDate) => `Графiк працоўнага часу за ${new Date(date.year, date.month).toLocaleString('be', {month: 'long'})} ${date.year}:\n`
  } as ILocString,
  menuTitle: {
    en: (date: Date) => `Menu on ${date2str(date, 'DD.MM.YYYY')}:\n`,
    ru: (date: Date) => `Меню на ${date2str(date, 'DD.MM.YYYY')}:\n`,
    be: (date: Date) => `Меню на ${date2str(date, 'DD.MM.YYYY')}:\n`
  } as ILocString,
  payslipTitle: {
    en: 'Payslip',
    ru: 'Расчетный листок',
    be: 'Разліковы лісток'
  },
  enterAnnouncementInvitation: {
    en: 'Enter text of the announcement:',
    ru: 'Введите текст объявления:',
    be: 'Увядзіце тэкст аб\'явы:'
  },
  btnCancelEnterAnnouncement: {
    en: 'Cancel',
    ru: 'Отменить ввод',
    be: 'Адмяніць увод'
  },
  btnSendToDepartment: {
    en: 'Send to my department',
    ru: 'Разослать всем в подразделении',
    be: 'Разаслаць усім у падраздзяленні'
  },
  btnSendToEnterprise: {
    en: 'Send to all in enterprise',
    ru: 'Разослать всем на предприятии',
    be: 'Разаслаць усім на прадпрыемстве'
  },
  btnSendToAll: {
    en: 'Send to all',
    ru: 'Разослать всем',
    be: 'Разаслаць усім'
  },
  btnCancelSendAnnouncement: {
    en: 'Cancel',
    ru: 'Отменить рассылку',
    be: 'Адмяніць рассылку'
  },
  sendAnnouncementMenuCaption: {
    en: 'Check the message text and choose type of mailing.',
    ru: 'Проверьте текст сообщения и выберите тип рассылки.',
    be: 'Праверце тэкст паведамлення і выбярыце тып рассылкі.'
  },
  sendAnnouncementConfirmation: {
    en: 'Please, confirm sending of the announcement.',
    ru: 'Пожалуйста, подтвердите рассылку объявления.',
    be: 'Калі ласка, пацвердзіце рассылку аб\'явы.'
  },
  notEnoughRights: {
    en: 'You don\'t have enough rights to send announcements.',
    ru: 'У вас недостаточно прав для рассылки объявлений.',
    be: 'У вас недастаткова правоў для рассылкі аб\'яў.'
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
  nightShift: {
    en: 'N',
    ru: 'Н',
    be: 'Н'
  },
  holidayShift: {
    en: 'H',
    ru: 'В',
    be: 'В'
  },
  vacationShift: {
    en: 'V',
    ru: 'О',
    be: 'А'
  },
  sickShift: {
    en: 'S',
    ru: 'Б',
    be: 'Б'
  },
  absenteeismShift: {
    en: 'A',
    ru: 'ПР',
    be: 'ПР'
  },
  leaveWOPayShift: {
    en: 'L',
    ru: 'А',
    be: 'А'
  },
  appearanceShift: {
    en: '',
    ru: '',
    be: ''
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
    ru: 'Зарплата чистыми:',
    be: 'Зарплата чыстымі:'
  },
  payslipDeductions: {
    en: '  Deductions:',
    ru: '  Удержания:',
    be: '  Вылічэнні:'
  },
  payslipAdvance: {
    en: '  Advance:',
    ru: '  Аванс:',
    be: '  Аванс:'
  },
  payslipPayroll: {
    en: '  Payable:',
    ru: '  К выдаче:',
    be: '  Да выдачы:'
  },
  payslipPayrollDetail: {
    en: 'Payable:',
    ru: 'К выдаче:',
    be: 'Да выдачы:'
  },
  payslipPayrollDebt: {
    en: '  Due by an employee:',
    ru: '  Долг за сотрудником:',
    be: '  Доўг за супрацоўнікам:'
  },
  payslipPayrollDebtDetail: {
    en: 'Due by an employee:',
    ru: 'Долг за сотрудником:',
    be: 'Доўг за супрацоўнікам:'
  },
  payslipTaxes: {
    en: 'Taxes:',
    ru: 'Налоги:',
    be: 'Падаткi:'
  },
  payslipIncometax: {
    en: '  Income tax:',
    ru: '  Подоходный:',
    be: '  Падаходны:'
  },
  payslipPensionTax: {
    en: '  Pension tax:',
    ru: '  Пенсионный:',
    be: '  Пенсійны:'
  },
  payslipTradeUnionTax: {
    en: '  Trade-union:',
    ru: '  Профсоюзный:',
    be: '  Прафсаюзны:'
  },
  payslipPrivileges: {
    en: 'Privileges:',
    ru: 'Льготы:',
    be: 'Ільготы:'
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
  startSendingAnnouncements: {
    en: '📧 Sending of announcements has just began. We will inform when it is finished. Wait, please...',
    ru: '📧 Начата рассылка объявлений. Мы сообщим, когда она будет окончена. Пожалуйста, подождите...',
    be: '📧 Распачалася рассылка аб\'яў. Мы паведамім, калі яна будзе скончана. Калі ласка, пачакайце...'
  },
  endSendingAnnouncements: {
    en: (sent: number) => `🏁 Sending is finished. ${sent} announcements were sent.`,
    ru: (sent: number) => `🏁 Рассылка закончилась. Было разослано ${sent} объявлений.`,
    be: (sent: number) => `🏁 Рассылка скончылася. Было разослана ${sent} аб\'яў.`
  },
  payslipCurrency: {
    en: (currency: string, currencyRate?: ICurrencyRate) => 'Currency: ' + (
      currencyRate
        ? `${currency}\nExchange rate ${currencyRate.rate.toFixed(4)} on ${date2str(currencyRate.date, 'DD.MM.YY')}`
        : 'Belarusian ruble'),
    ru: (currency: string, currencyRate?: ICurrencyRate) => 'Валюта: ' + (
      currencyRate
        ? `${currency}\nКурс ${currencyRate.rate.toFixed(4)} на ${date2str(currencyRate.date, 'DD.MM.YY')}`
        : 'Белорусский рубль'),
    be: (currency: string, currencyRate?: ICurrencyRate) => 'Валюта: ' + (
      currencyRate
        ? `${currency}\nКурс ${currencyRate.rate.toFixed(4)} на ${date2str(currencyRate.date, 'DD.MM.YY')}`
        : 'Беларускі рубель')
  },
  comparativePayslipCurrency: {
    en: (currency: string, currencyRate?: ICurrencyRate, currencyRate2?: ICurrencyRate) => 'Currency: ' + (
      currencyRate && currencyRate2
        ? `${currency}\nExchange rate ${currencyRate.rate.toFixed(4)} on ${date2str(currencyRate.date, 'DD.MM.YY')}\n${currencyRate2.rate.toFixed(4)} on ${date2str(currencyRate2.date, 'DD.MM.YY')}`
        : 'Belarusian ruble'),
    ru: (currency: string, currencyRate?: ICurrencyRate, currencyRate2?: ICurrencyRate) => 'Валюта: ' + (
      currencyRate && currencyRate2
        ? `${currency}\nКурс ${currencyRate.rate.toFixed(4)} на ${date2str(currencyRate.date, 'DD.MM.YY')}\n${currencyRate2.rate.toFixed(4)} на ${date2str(currencyRate2.date, 'DD.MM.YY')}`
        : 'Белорусский рубль'),
    be: (currency: string, currencyRate?: ICurrencyRate, currencyRate2?: ICurrencyRate) => 'Валюта: ' + (
      currencyRate && currencyRate2
        ? `${currency}\nКурс ${currencyRate.rate.toFixed(4)} на ${date2str(currencyRate.date, 'DD.MM.YY')}\n${currencyRate2.rate.toFixed(4)} на ${date2str(currencyRate2.date, 'DD.MM.YY')}`
        : 'Беларускі рубель')
  },
  comparativePayslipPeriod: {
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
  },
  canteenMenuCurrency: {
    en: (currency: string, date: Date, currencyRate?: number) => 'Currency: ' + (
      currencyRate
        ? `${currency}\nExchange rate ${currencyRate.toFixed(4)} on ${date2str(date, 'DD.MM.YY')}`
        : 'Belarusian ruble'),
    ru: (currency: string, date: Date, currencyRate?: number) => 'Валюта: ' + (
      currencyRate
        ? `${currency}\nКурс ${currencyRate.toFixed(4)} на ${date2str(date, 'DD.MM.YY')}`
        : 'Белорусский рубль'),
    be: (currency: string, date: Date, currencyRate?: number) => 'Валюта: ' + (
      currencyRate
        ? `${currency}\nКурс ${currencyRate.toFixed(4)} на ${date2str(date, 'DD.MM.YY')}`
        : 'Беларускі рубель')
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

export function getLName2(n?: LName, langPref: Language[] = [], getFullName: boolean = false): string | undefined {
  return n && getLName(n, langPref, getFullName);
};
