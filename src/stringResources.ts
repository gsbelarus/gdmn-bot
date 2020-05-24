interface ILocString {
  en: string | null;
  ru: string | null;
  be: string | null;
};

const stringResources = {
  askCompanyName: {
    en: 'Hi!\n\nTo receive payslips you need to sign up.\n\nEnter organization name:',
    ru: 'Здравствуйте!\n\nДля получения расчетных листков необходимо зарегистрироваться.\n\nВведите наименование организации:',
    be: 'Прывітанне!\n\nДля атрымання разліковых лісткоў неабходна зарэгістравацца.\n\nУвядзіце назву арганізацыі:'
  },
  unknownCompanyName: {
    en: null,
    ru: 'Мы не можем найти организацию с таким именем.\n\nВозможно вы ошиблись при вводе или ваша организация не использует систему "Гедымин: Расчет заработной платы".\n\nПопробуйте ввести еще раз:',
    be: null
  },
  askPersonalNumber: {
    en: null,
    ru: 'Введите свой персональный идентификационный номер из паспорта:',
    be: null
  },
  test: {
    en: null,
    ru: 'test',
    be: null
  },
  mainMenuCaption: {
    en: null,
    ru: 'Выберите команду из меню:',
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
};

export type Lang = keyof ILocString;
export type StringResource = keyof typeof stringResources;

export const getLocString = (id: StringResource, lang?: Lang) => stringResources[id][lang ?? 'ru']
  ?? stringResources[id]['be']
  ?? stringResources[id]['en']
  ?? stringResources[id]['ru'];
