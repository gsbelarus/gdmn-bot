import { ContextMessageUpdate } from "telegraf";
import { IDialogStateGettingCurrency } from "../../types";
import { keyboardCurrency, keyboardMenu, currencySelection } from "../util/keybord";
import { dialogStates, accountLink } from "../../server";
import { getLanguage, getCurrencyNameById } from "../../util/utils";
import { withMenu } from "../telegram";

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
      const currencyName = getCurrencyNameById(lng, currencyId);
      ctx.deleteMessage();
      withMenu(ctx, `Валюта ${currencyName} сохранена`, keyboardMenu, true);
    }
  }
}