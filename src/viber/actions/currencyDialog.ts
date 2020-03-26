import { IDialogStateGettingCurrency } from "../../types";
import { dialogStates, accountLink } from "../../server";
import { getLanguage, getCurrencyNameById } from "../../util/utils";
import { withMenu } from "../viber";
import { keyboardCurrency, currencySelection, keyboardMenu } from "../util/keybord";
const TextMessage = require('viber-bot').Message.Text;

export const currencyDialog = async (bot: any, message: any, response: any, start = false) => {
  // if (!ctx.chat) {
  //   throw new Error('Invalid context');
  // }

  const chatId = bot.userProfile.id.toString();
  const lng = getLanguage(bot.chat.language);

  if (start) {
    //ctx.deleteMessage();
    await withMenu(bot, response, [
      TextMessage('Выберите валюту:'),
      keyboardCurrency(bot, response)
    ]);
    dialogStates.merge(chatId, { type: 'GETTING_CURRENCY', lastUpdated: new Date().getTime() });
  }

  const dialogState = dialogStates.getMutable(true)[chatId];

  if (!dialogState || dialogState.type !== 'GETTING_CURRENCY') {
    throw new Error('Invalid dialog state');
  }
  const { currencyId } = dialogState as IDialogStateGettingCurrency;

  if (!currencyId) {
    const currencyId = currencySelection(message);
    if (currencyId !== undefined ) {
      const link = accountLink.read(chatId);
      accountLink.merge(chatId, {...link, currencyId });
      const currencyName = getCurrencyNameById(lng, currencyId);
     // ctx.deleteMessage();
     await withMenu(bot, response, [
      TextMessage(`Валюта ${currencyName} сохранена`),
      keyboardMenu
     ]);
    }
  }
}

