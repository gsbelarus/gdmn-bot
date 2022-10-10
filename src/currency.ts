/**
 * Мы предоставляем пользователю возможность пересчитать суммы в расчетном
 * листке в любую валюту. При этом:
 *
 * 1. Справочник валют (названия, коды и т.п.) мы подгружаем из файла на диске.
 *    Если файла нет, то загружаем с сайта нацбанка и сохраняем в файл.
 * 2. Курс валюты для пересчета берем на дату расчетного листка или первую
 *    дату в периоде, если листок строится за период.
 * 3. Курс валюты загружаем из файла на диске. Если курса в файле нет,
 *    то берем его с сайта нацбанка и дописываем в файл на диске.
 *
 */

import { FileDB, IData } from './util/fileDB';
import { date2str } from './util/utils';
import { MINDATE, URLNBRBRATES, URLNBRBCURRENCIES } from './constants';
import { LName, Language, getLName } from './stringResources';
import { IDate } from './types';
import { ILogger } from './log';
import { getCurrenciesFN, getRatesFN } from './files';

/**
 * Информация о валюте в справочнике валют. Краткая аббревиатура
 * и названия на разных языках. Ключем в справочнике будет выступать
 * строковый идентификатор валюты, который мы получаем, когда
 * скачиваем справочник с сайта национального банка.
 */
interface ICurrency {
  abbreviation: string;
  name: LName;
};

let currenciesDB: FileDB<ICurrency> | undefined = undefined;

export interface ICurrencyRates {

}

/**
 * Функция считывает справочник валют с диска. Если на диске нет нужной нам информации,
 * то справочник берется с сайта национального банка и записывается на диск для
 * последующего использования.
 */
export async function initCurrencies(log: ILogger) {
  const fdb = new FileDB<ICurrency>({
    fn: getCurrenciesFN(),
    logger: log,
    check: (data: IData<ICurrency>) => !Object.keys(data).length
      || (typeof Object.values(data)[0].abbreviation === 'string' && typeof Object.values(data)[0].name === 'object'),
    ignore: true
  });

  if (fdb.isEmpty()) {


    interface INBRBCurrency  {
      Cur_ID: number;
      Cur_ParentID: number;
      Cur_Code: string;
      Cur_Abbreviation: string;
      Cur_Name: string;
      Cur_Name_Bel: string;
      Cur_Name_Eng: string;
      Cur_QuotName: string;
      Cur_QuotName_Bel: string;
      Cur_QuotName_Eng: string;
      Cur_NameMulti: string;
      Cur_Name_BelMulti: string;
      Cur_Name_EngMulti: string;
      Cur_Scale: number;
      Cur_Periodicity: number;
      Cur_DateStart: Date;
      Cur_DateEnd: Date;
    };

    try {
      const fetched = await fetch(URLNBRBCURRENCIES, {});
      const parsed: INBRBCurrency[] = await fetched.json();

      for (const currency of parsed) {
        fdb.write(currency.Cur_ID.toString(), {
          abbreviation: currency.Cur_Abbreviation,
          name: {
            ru: {
              name: currency.Cur_Name
            },
            en: {
              name: currency.Cur_Name_Eng
            },
            be: {
              name: currency.Cur_Name_Bel
            },
          }
        });
      }

      fdb.flush();
    }
    catch (e) {
      log.error(`Error fetching currency list: ${e}`);
    }
  }

  currenciesDB = fdb;
};

/**
 * Вовзращает локализованное наименование валюты.
 * @param lng ИД языка.
 * @param currencyId ИД валюты. Если не задано, функция вернет 'Белорусский рубль'.
 */
export const getCurrencyNameById = (lng: Language, currencyId?: string) => {
  if (currenciesDB && currencyId) {
    const c = currenciesDB.read(currencyId);
    if (c) {
      return getLName(c.name, [lng]);
    }
  }
  return 'Белорусский рубль';
};

/**
 * Возвращает буквенный код валюты.
 * @param currencyId ИД валюты, если не задано функция вернет BYN.
 */
export const getCurrencyAbbreviationById = (currencyId?: string) => {
  if (currenciesDB && currencyId) {
    const c = currenciesDB.read(currencyId);
    if (c) {
      return c.abbreviation;
    }
  }
  return 'BYN';
};

/*

Курсы валют к белорусскому рублю будем хранить в файле в таком формате:

{
  "2020-03-20T00:00:00": {
    "999": 2.001,
    "645": 4.000,
    ...
  },
  ...
}

*/

export interface ICurrencyRates {
  [currId: string]: number;
};

let ratesDB: FileDB<ICurrencyRates> | undefined = undefined;

/**
 * Возвращает курс заданной валюты на заданную дату. Если курса нет, то пытаемся
 * загрузить с сайта. Если на сайте нет, то берем на максимальную предыдущую дату.
 * Если все равно нет курса валюты, то возвращаем ЧТО?
 * @param forDate Дата.
 * @param currency Код валюты. Например, USD.
 */
export const getCurrRate = async (forDate: IDate, currency: string, log: ILogger) => {
  const date = new Date(forDate.year, forDate.month);
  let rate: number | undefined = undefined;

  while (date.getTime() > MINDATE.getTime()) {
    rate = await getCurrRateForDate(date, currency, log);
    if (rate !== undefined) {
      break;
    }
    date.setDate(date.getDate() - 1);
  }

  return rate ? { date, rate } : undefined;
};

export const getCurrRateForDate = async (date: Date, currency: string, log: ILogger) => {

  if (!currenciesDB) {
    throw new Error('No currency db');
  }

  let currId = '';

  for (const [id, data] of Object.entries(currenciesDB?.getMutable(false))) {
    if (data.abbreviation === currency) {
      currId = id;
    }
  }

  if (!currId) {
    throw new Error(`Invalid currency abbreviation ${currency}`);
  }

  if (!ratesDB) {
    // загружаем курсы с диска
    ratesDB = new FileDB<ICurrencyRates>({
      fn: getRatesFN(),
      logger: log,
      check: (data: IData<ICurrencyRates>) => !Object.keys(data).length || typeof Object.values(data)[0] === 'object',
      ignore: true
    });
  }

  const strDate = date2str(date, 'YYYY-M-D');
  const ratesForDate = ratesDB.read(strDate);
  let rate = ratesForDate?.[currId];

  if (rate !== undefined) {
    return rate;
  }

  // курса на дату нет
  // попробуем загрузить из интернета

  interface INBRBRate {
    Cur_ID: number;
    Date: Date;
    Cur_Abbreviation: string;
    Cur_Scale: number;
    Cur_Name: string;
    Cur_OfficialRate: number;
  };

  const url = `${URLNBRBRATES}?periodicity=0&ondate=${strDate}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout( () => {
      log.error('Request timed out...');
      controller.abort();
    }, 5000);
    const fetched = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    const parsed: INBRBRate[] = await fetched.json();

    if (Array.isArray(parsed)) {
      const c = parsed.find( p => p['Cur_ID'].toString() === currId );
      const scale = c?.['Cur_Scale'];
      const officialRate = c?.['Cur_OfficialRate'];

      if (scale && scale > 0 && officialRate && officialRate > 0) {
        rate = parseFloat((officialRate / scale).toFixed(4));

        if (ratesForDate) {
          ratesDB.write(strDate, { ...ratesForDate, [currId]: rate });
        } else {
          ratesDB.write(strDate, { [currId]: rate });
        }

        ratesDB.flush();
      }
    }
  }
  catch (e) {
    log.error(`Error fetching ${url}: ${e}`);
    return undefined;
  }
  return rate;
}