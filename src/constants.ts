import { ILocString, stringResources } from "./stringResources";

export const MINDATE = new Date(2018, 0, 1);
export const URLNBRBRATES = "https://www.nbrb.by/api/exrates/rates";
export const URLNBRBCURRENCIES = "https://www.nbrb.by/api/exrates/currencies";

export const hourTypes: ILocString[] = [
  stringResources.appearanceShift,
  stringResources.nightShift,
  stringResources.holidayShift,
  stringResources.holidayShift,
  stringResources.vacationShift,
  stringResources.sickShift,
  stringResources.absenteeismShift,
  stringResources.leaveWOPayShift
]
