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

const fs = require("fs");
const fetch = require("node-fetch");

export interface INBRBCurrency  {
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

export type NBRBCurrencies = INBRBCurrency[];

export interface INBRBRate {
  Cur_ID: number;
  Date: Date;
  Cur_Abbreviation: string;
  Cur_Scale: number;
  Cur_Name: string;
  Cur_OfficialRate: number;
};

export type NBRBRates = INBRBRate[];


export const PATH_NB_RB_RATES = "./data/nbrbrates.json";
export const PATH_NB_RB_CUR = "./data/nbrbcurrencies.json";

const urlNBRBRates = "http://www.nbrb.by/API/ExRates/Rates";
const urlNBRBCurrencies = "http://www.nbrb.by/API/ExRates/Currencies";

export const BEGIN_DATE_RATES = new Date(2018, 0, 1);

async function downloadRates(d: Date, endDate: Date, rates: NBRBRates): Promise<NBRBRates>  {
  if (d < endDate) {
    const result = await fetch(`${urlNBRBRates}?Periodicity=0&onDate=${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`, {});
    const text = await result.json();
    return await downloadRates(new Date(d.setDate(d.getDate() + 1)), endDate, rates.concat(text));
  }
  return rates;
}

async function downloadCurrencies() {
  const result = await fetch(urlNBRBCurrencies, {});
  return await result.json();
}

export const getUpdatedCurrencies = (): NBRBCurrencies | undefined => {
  downloadCurrencies()
    .then((res: NBRBCurrencies) => {
       fs.writeFileSync(PATH_NB_RB_CUR, JSON.stringify(res, undefined, 2))
       return res;
    })
    .catch((error: any) => {
      console.error(error);
      process.exit(1);
    });
  return undefined;
}

export const getUpdatedRates = (startDate: Date, endDate: Date, rates: NBRBRates = []): NBRBRates | undefined => {
  downloadRates(startDate, endDate, rates)
    .then((res: NBRBRates) => {
      fs.writeFileSync(PATH_NB_RB_RATES, JSON.stringify(res, undefined, 2));
      return res;
    })
    .catch((error: any) => {
      console.error(error);
      process.exit(1);
    });
  return undefined;
}
