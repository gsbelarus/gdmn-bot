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

import fs from 'fs';
import path from 'path';
import { Lang, LName } from './types';
import { FileDB, IData } from './util/fileDB';
import { getLName } from './util/utils';

const fetch = require("node-fetch");

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

/**
 * Функция считывает справочник валют с диска. Если на диске нет нужной нам информации,
 * то справочник берется с сайта национального банка и записывается на диск для
 * последующего использования.
 */
export async function initCurrencies() {
  const fdb = new FileDB<ICurrency>(
    path.resolve(process.cwd(), `data/nbrbcurrencies.json`),
    {},
    (data: IData<ICurrency>) => !Object.keys(data).length
      || (typeof Object.values(data)[0].abbreviation === 'string' && typeof Object.values(data)[0].name === 'object'),
    true
  );

  if (fdb.isEmpty()) {
    const urlNBRBCurrencies = "http://www.nbrb.by/API/ExRates/Currencies";

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
      const fetched = await fetch(urlNBRBCurrencies, {});
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
            by: {
              name: currency.Cur_Name_Bel
            },
          }
        });
      }

      fdb.flush();
    }
    catch (e) {
      console.error(`Error fetching currency list: ${e}`);
    }
  }

  currenciesDB = fdb;
};

/**
 * Вовзращает локализованное наименование валюты.
 * @param lng ИД языка.
 * @param currencyId ИД валюты. Если не задано, функция вернет 'Белорусский рубль'.
 */
export const getCurrencyNameById = (lng: Lang, currencyId?: string) => {
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

/**
 * Преобразует дату в строку вида YYYY.MM.DD.
 * @param date Дата.
 */
const date2str = (date: Date) => `${date.getFullYear()}.${(date.getMonth() + 1).toString().padStart(2)}.${date.getDate().toString().padStart(2)}`;

let ratesDB: FileDB<ICurrencyRates> | undefined = undefined;

/**
 * Возвращает курс заданной валюты на заданную дату. Если курса нет, то пытаемся
 * загрузить с сайта. Если на сайте нет, то берем на максимальную предыдущую дату.
 * Если все равно нет курса валюты, то возвращаем ЧТО?
 * @param date Дата.
 * @param currId ИД валюты.
 */
export const getCurrRate = async (date: Date, currId: string) => {
  if (!ratesDB) {
    // загружаем курсы с диска
    ratesDB = new FileDB<ICurrencyRates>(
      path.resolve(process.cwd(), `data/nbrbrates.json`),
      {},
      (data: IData<ICurrencyRates>) => !Object.keys(data).length || typeof Object.values(data)[0] === 'object',
      true
    );
  }

  let d = date;
  let rate: number | undefined = undefined;

  while (true) {
    const strDate = date2str(d);
    const ratesForDate = ratesDB.read(strDate);
    rate = ratesForDate?.[currId];

    if (rate !== undefined) {
      break;
    }

    // курса на дату нет
    // попробуем загрузить из интернета
    const urlNBRBRates = "http://www.nbrb.by/API/ExRates/Rates";

    interface INBRBRate {
      Cur_ID: number;
      Date: Date;
      Cur_Abbreviation: string;
      Cur_Scale: number;
      Cur_Name: string;
      Cur_OfficialRate: number;
    };

    try {
      const fetched = await fetch(`${urlNBRBRates}?Periodicity=0&onDate=${strDate}`, {});
      const parsed: INBRBRate[] = await fetched.json();

      if (Array.isArray(parsed)) {
        const c = parsed.find( p => p['Cur_ID'].toString() === currId );
        const scale = c?.['Cur_Scale'];
        const officialRate = c?.['Cur_OfficialRate'];

        if (scale && scale > 0 && officialRate && officialRate > 0) {
          rate = officialRate / scale;

          if (ratesForDate) {
            ratesDB.write(strDate, { ...ratesForDate, [currId]: rate });
          } else {
            ratesDB.write(strDate, { [currId]: rate });
          }

          ratesDB.flush();
          break;
        }
      }
    }
    catch (e) {
      console.error(`Error fetching currencyRate list: ${e}`);
    }

    d.setDate(d.getDate() - 1);

    if (d.getTime() < new Date(2018, 0, 1).getTime()) {
      break;
    }
  }

  return rate;
};



// async function downloadRates(d: Date, endDate: Date, rates: NBRBRates): Promise<NBRBRates>  {
//   if (d < endDate) {
//     const result = await fetch(`${urlNBRBRates}?Periodicity=0&onDate=${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`, {});
//     const text = await result.json();
//     return await downloadRates(new Date(d.setDate(d.getDate() + 1)), endDate, rates.concat(text));
//   }
//   return rates;
// }

// export const getUpdatedRates = (startDate: Date, endDate: Date, rates: NBRBRates = []): NBRBRates | undefined => {
//   downloadRates(startDate, endDate, rates)
//     .then((res: NBRBRates) => {
//       fs.writeFileSync(PATH_NB_RB_RATES, JSON.stringify(res, undefined, 2));
//       return res;
//     })
//     .catch((error: any) => {
//       console.error(error);
//       process.exit(1);
//     });
//   return undefined;
// }

// /**Получить курс валюты на дату по ID валюты */
// export const getRateByCurrency = (date: Date, currencyId: string) => {
//   //Если currencyId = 0 (белорусский рубль), курс = 1
//   if (!currencyId) {
//     return 1
//   }
//   let currencyRates: NBRBRates | undefined;
//   if (!fs.existsSync(PATH_NB_RB_RATES)) {
//     currencyRates = undefined;
//   } else {
//     currencyRates = JSON.parse(fs.readFileSync(PATH_NB_RB_RATES, { encoding: 'utf8' }).toString());
//   }
//   //Находим курс валюты на заданную дату
//   //если нет файла или нет курса на заданную дату, то вызовем функцию загрузки файла из нацбанка
//   //если есть курс, вернем его (российский курс разделим на 100)
//   const currencyRate = currencyRates?.find(r => r.Cur_ID.toString() === currencyId && new Date(r.Date).getTime() === new Date(date).getTime());
//   if (currencyRate) {
//     const rate = currencyRate.Cur_OfficialRate;
//     return currencyId === '298' ? rate/100 : rate;
//   } else {
//     //Вычисляем дату, от которой будем грузить курсы из нацбанка
//     //это максимальная дата от даты из файла и константы BEGIN_DATE_RATES
//     let lastDate = currencyRates?.sort((a, b) => new Date(b.Date).getTime()  - new Date(a.Date).getTime())[0]?.Date;
//     if (lastDate) {
//       lastDate = new Date(Math.max(new Date(BEGIN_DATE_RATES).getTime(), new Date(lastDate).getTime()));
//     } else {
//       lastDate = BEGIN_DATE_RATES
//     }
//     //Вызываем загрузку файла из нацбанка
//     const updatedRates = getUpdatedRates(lastDate, new Date(), currencyRates);
//     if (updatedRates) {
//       const rate = updatedRates.filter(r => r.Cur_ID.toString() === currencyId && new Date(r.Date).getTime() < new Date(date).getTime())
//         .sort((a, b) => new Date(b.Date).getTime()  - new Date(a.Date).getTime())[0]?.Cur_OfficialRate;
//       return currencyId === '298' ? rate/100 : rate;
//     } else {
//       console.log('Rates are not updated!')
//       return -1;
//     }
//   }
// }
