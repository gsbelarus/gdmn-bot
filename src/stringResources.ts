interface ILocString {
  en: string;
  ru: string;
  be: string;
};

const stringResources = {
  invitation: {
    en: 'Hi! To receive payslips you need to sign up.',
    ru: 'Здравствуйте! Для получения расчетных листков необходимо зарегистрироваться.',
    be: 'Прывітанне! Для атрымання разліковых лісткоў неабходна зарэгістравацца.'
  },
  askCompanyName: {
    en: 'Enter organization name:',
    ru: 'Введите наименование организации:',
    be: 'Увядзіце назву арганізацыі:'
  }
};

export type Lang = keyof ILocString;
export type StringResource = keyof typeof stringResources;

export const getLocString = (id: StringResource, lang?: Lang) => stringResources[id][lang ?? 'ru'];
