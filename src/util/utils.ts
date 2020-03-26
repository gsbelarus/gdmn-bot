import { promises } from 'fs';
//import log4js from 'log4js';
import path from "path";
import { Lang, LName, NBRBCurrencies, NBRBRates } from '../types';
import { PATH_NB_RB_CUR, getUpdatedCurrencies, PATH_NB_RB_RATES, BEGIN_DATE_RATES, getUpdatedRates } from './downLoadCurrencyRates';
import fs from 'fs';
/**
 * Удаляет из строки кавычки, двойные пробелы и т.п.
 * Приводит к нижнему регистру.
 * @param s Входящая строка
 */
export const normalizeStr = (s?: string) => s && s.trim()
  .toLowerCase()
  .split('')
  .filter( c => c !== '"' && c !== "'" && c !== '`' && c !== '\n' && c !== '\t')
  .join('')
  .split(' ')
  .filter( ss => ss.trim() )
  .filter( ss => ss !== 'ооо' && ss !== 'оао' )
  .join(' ');

  export const readFile = async (filename: string) => {
    try {
      const result = await promises.readFile(filename, { encoding: 'utf8', flag: 'r' });
      const data = JSON.parse(result);
     // logger.info(`Successful reading: ${filename}`);
      if(Array.isArray(data) && data.length) {
        return data;
      } else {
        return data;
      }
    }
    catch (e) {
     // logger.trace(`Error reading data to file ${filename} - ${e}`);
      console.log(`Error reading data to file ${filename} - ${e}`);
      return undefined;
    }
  }

  export const writeFile = async (filename: string, data: string) => {
    try {
      await promises.mkdir(path.dirname(filename), { recursive: true });
      await promises.writeFile(filename, data, { encoding: 'utf8', flag: 'w' });
     // logger.info(`Successful writing: ${filename}`);
    }
    catch (e) {
     // logger.trace(`Error writing data to file ${filename} - ${e}`);
      console.log(`Error writing data to file ${filename} - ${e}`);
    }
  }

export function getLName(n: LName, langPref: Lang[] = [], getFullName: boolean = false): string {
  for (let i = 0; i < langPref.length; i++) {
    const tn = n[langPref[i]];
    if (tn) {
      return (getFullName && tn.fullName) ? tn.fullName : tn.name;
    }
  }

  if (!n.en) return '';

  return (getFullName && n.en.fullName) ? n.en.fullName : n.en.name;
};

export const getLanguage = (lang_code?: string): Lang => {
    if (!lang_code) {
      return 'ru'
    }
    if (lang_code.indexOf('-')) {
      lang_code = lang_code.split('-')[0]
    }
    if (lang_code === 'ru') {
      return 'ru'
    } else if (lang_code === 'by') {
        return 'by'
      } else {
      return 'en'
    }
}

export const getPaySlipString = (prevStr: string, name: string, s: number): string => {
  let name_1 = '';
  const len = 36;
  if (name.length > len) {
    name_1 = name.length > len ? name.slice(0, len) : name;
    name = name.slice(len).padEnd(len);
    return `${prevStr}${prevStr !== '' ? '\r\n    ' : ''}  ${name_1} \r\n      ${name} ${s.toFixed(2).padStart(8)}`;
  } else {
    return `${prevStr}${prevStr !== '' ? '\r\n    ' : ''}  ${name.padEnd(len)} ${s.toFixed(2).padStart(8)}`;
  }
}

/** Возвращает массив лет за период*/
export function getYears(fromDate: Date, toDate: Date): number[] {
  let years = [];
  let fromYear = fromDate.getFullYear();
  let toYear = toDate.getFullYear();
  while (fromYear <= toYear) {
    years.push(fromDate.getFullYear());
    fromYear = fromYear + 1;
  }
  return years;
};

/**Получить наименование валюты по ID валюты, по умолчанию 'Белорусский рубль' */
export const getCurrencyNameById = (lng: Lang, currencyId?: number) => {
  const c = getCurrencies()?.find(c => c.Cur_ID === currencyId);
  if (c) {
    return lng === 'ru' ? c.Cur_Name : lng === 'by' ? c.Cur_Name_Bel : c.Cur_Name_Eng;
  }
  return 'Белорусский рубль';
}

/**Получить аббривиатуру валюты по ID валюты, по умолчанию 'BYN' */
export const getCurrencyAbbreviationById = (currencyId?: number) => {
  const c = getCurrencies()?.find(c => c.Cur_ID === currencyId);
  if (c) {
    return c.Cur_Abbreviation;
  }
  return 'BYN';
}

/**Получить данные из файла типов валют, и если его нет, загрузить из сайта нацбанка  */
export const getCurrencies = (): NBRBCurrencies | undefined =>  {
  if (!fs.existsSync(PATH_NB_RB_CUR)) {
    return getUpdatedCurrencies();
  } else {
    return JSON.parse(fs.readFileSync(PATH_NB_RB_CUR, { encoding: 'utf8' }).toString());
  }
}

/**Получить курс валюты на дату по ID валюты */
export const getRateByCurrency = (date: Date, currencyId: number) => {
  //Если currencyId = 0 (белорусский рубль), курс = 1
  if (currencyId === 0) {
    return 1
  }
  let currencyRates: NBRBRates | undefined;
  if (!fs.existsSync(PATH_NB_RB_RATES)) {
    currencyRates = undefined;
  } else {
    currencyRates = JSON.parse(fs.readFileSync(PATH_NB_RB_RATES, { encoding: 'utf8' }).toString());
  }
  //Находим курс валюты на заданную дату
  //если нет файла или нет курса на заданную дату, то вызовем функцию загрузки файла из нацбанка
  //если есть курс, вернем его (российский курс разделим на 100)
  const currencyRate = currencyRates?.find(r => r.Cur_ID === currencyId && new Date(r.Date).getTime() === new Date(date).getTime());
  if (currencyRate) {
    const rate = currencyRate.Cur_OfficialRate;
    return currencyId === 298 ? rate/100 : rate;
  } else {
    //Вычисляем дату, от которой будем грузить курсы из нацбанка
    //это максимальная дата от даты из файла и константы BEGIN_DATE_RATES
    let lastDate = currencyRates?.sort((a, b) => new Date(b.Date).getTime()  - new Date(a.Date).getTime())[0]?.Date;
    if (lastDate) {
      lastDate = new Date(Math.max(new Date(BEGIN_DATE_RATES).getTime(), new Date(lastDate).getTime()));
    } else {
      lastDate = BEGIN_DATE_RATES
    }
    //Вызываем загрузку файла из нацбанка
    const updatedRates = getUpdatedRates(lastDate, new Date(), currencyRates);
    if (updatedRates) {
      const rate = updatedRates.filter(r => r.Cur_ID === currencyId && new Date(r.Date).getTime() < new Date(date).getTime())
        .sort((a, b) => new Date(b.Date).getTime()  - new Date(a.Date).getTime())[0]?.Cur_OfficialRate;
      return currencyId === 298 ? rate/100 : rate;
    } else {
      console.log('Rates are not updated!')
      return -1;
    }
  }
}


