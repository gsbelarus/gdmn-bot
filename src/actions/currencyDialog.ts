import { ContextMessageUpdate } from "telegraf";
import { IDialogStateGettingCurrency, Lang } from "../types";
import { keyboardCurrency, keyboardMenu, currencySelection } from "../util/keybord";
import { withMenu, dialogStates, accountLink, currencies, currencyRates } from "../server";
import { getLanguage } from "../util/utils";

export const currencyDialog = async (ctx: ContextMessageUpdate, start = false) => {
  if (!ctx.chat) {
    throw new Error('Invalid context');
  }

  const chatId = ctx.chat.id.toString();

  if (start) {
    ctx.deleteMessage();
    await withMenu(ctx, 'Выберите валюту:', keyboardCurrency(ctx), true);
    dialogStates.merge(chatId, { type: 'GETTING_CURRENCY', lastUpdated: new Date().getTime() });
  }

  const dialogState = dialogStates.getMutable(true)[chatId];

  if (!dialogState || dialogState.type !== 'GETTING_CURRENCY') {
    throw new Error('Invalid dialog state');
  }
  const { currencyId } = dialogState as IDialogStateGettingCurrency;

  if (!currencyId) {
    const currencyId = currencySelection(ctx);
    if (currencyId !== undefined ) {
      const link = accountLink.read(chatId);
      accountLink.merge(chatId, {...link, currencyId });
      const lng = getLanguage(ctx.from?.language_code);
      const currencyName = getCurrencyNameById(currencyId, lng);
      ctx.deleteMessage();
      withMenu(ctx, `Валюта ${currencyName} сохранена`, keyboardMenu, true);
    }
  }
}

export const getRateByCurrency = (currencyId: number, date: Date) => {
  console.log(currencyRates.filter(r => r.Cur_ID === currencyId && new Date(r.Date).getTime() < new Date(date).getTime()));
  const rate = currencyRates.filter(r => r.Cur_ID === currencyId && new Date(r.Date).getTime() < new Date(date).getTime()).sort((a, b) => new Date(b.Date).getTime()  - new Date(a.Date).getTime())[0]?.Cur_OfficialRate;
  return currencyId === 298 ? rate/100 : rate;
}

export const getCurrencyNameById = (currencyId: number, lng: Lang) => {
  const c = currencies.find(c => c.Cur_ID === currencyId);
  if (c) {
    return lng === 'ru' ? c.Cur_Name : lng === 'by' ? c.Cur_Name_Bel : c.Cur_Name_Eng;
  }
  return 'Белорусский рубль';
}

export const getCurrencyAbbreviationById = (currencyId: number) => {
  const c = currencies.find(c => c.Cur_ID === currencyId);
  if (c) {
    return c.Cur_Abbreviation;
  }
  return 'BYN';
}