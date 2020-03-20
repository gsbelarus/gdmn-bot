import { NBRBRates, NBRBCurrencies } from "../types";

const fs = require("fs");
const fetch =  require("node-fetch");

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

