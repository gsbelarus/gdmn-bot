interface ILocString {
  en: string | null;
  ru: string | null;
  be: string | null;
};

const stringResources = {
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
  askPersonalNumber: {
    en: null,
    ru: 'Введите свой персональный идентификационный номер из паспорта.',
    be: null
  },
  test: {
    en: null,
    ru: 'test',
    be: null
  },
  mainMenuCaption: {
    en: null,
    ru: 'Выберите команду из меню.',
    be: null
  },
  goodBye: {
    en: null,
    ru: 'До свидания! Спасибо, что были с нами.',
    be: null
  },
  payslip: {
    en: null,
    ru: 'Здесь будет расчетный листок...',
    be: null
  },
  payslipForPeriod: {
    en: null,
    ru: 'Здесь будет расчетный листок за период...',
    be: null
  },
  sayGoodbye: {
    en: null,
    ru: 'До свидания! Спасибо, что использовали наш чат-бот.',
    be: null
  },
  showSelectedDate: {
    en: null,
    ru: 'Выбрана дата...',
    be: null
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
};

export type Lang = keyof ILocString;
export type StringResource = keyof typeof stringResources;

export const getLocString = (id: StringResource, lang?: Lang) => stringResources[id][lang ?? 'ru']
  ?? stringResources[id]['be']
  ?? stringResources[id]['en']
  ?? stringResources[id]['ru'];
