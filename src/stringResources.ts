interface ILocString {
  en?: string;
  ru?: string;
  be?: string;
};

const stringResources = {
  invitation: {
    en: 'Hi!',
    ru: 'Привет!',
    be: 'Прывітанне!'
  }
};

export type Lang = keyof ILocString;

export const getLocString = (id: keyof typeof stringResources, lang?: Lang) => stringResources[id]?.[lang ?? 'ru'];
