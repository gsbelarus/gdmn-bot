import { dialogStates } from "../../server";
import { IDialogStateGettingConcise } from "../../types";

import { getPaySlip } from "./getPaySlip";
import { withMenu } from "../viber";
import { getLanguage } from "../../util/utils";
import { keyboardCalendar, calendarSelection, keyboardMenu } from "../util/keybord";
const TextMessage = require('viber-bot').Message.Text;


export const paySlipDialog = async (bot: any, message: any, response: any, start = false) => {
  // if (!ctx.chat) {
  //   throw new Error('Invalid context');
  // }

  const chatId = bot.chat.id.toString();
  const lng = getLanguage(bot.chat.language);

  if (start) {
    await withMenu(bot, response, [
      TextMessage('Укажите начало периода:'),
      keyboardCalendar(lng, new Date().getFullYear())
    ]);
    dialogStates.merge(chatId, { type: 'GETTING_CONCISE', lastUpdated: new Date().getTime(), db: undefined, de: undefined });
  }

  const dialogState = dialogStates.getMutable(true)[chatId];

  if (!dialogState || dialogState.type !== 'GETTING_CONCISE') {
    throw new Error('Invalid dialog state');
  }

  const { db, de } = dialogState as IDialogStateGettingConcise;
  if (!db) {
    const db = calendarSelection(bot, message, response);
    if (db) {
      await bot.sendMessage(response.userProfile, TextMessage(db.toLocaleDateString()));
      dialogStates.merge(chatId, { type: 'GETTING_CONCISE', lastUpdated: new Date().getTime(), db });
      await withMenu(bot, response, [
        TextMessage('Укажите окончание периода:'), keyboardCalendar(lng, new Date().getFullYear())
      ]);
    }
  } else if (!de) {
    let de = calendarSelection(bot, message, response);
    if (de) {
      de = new Date(de.getFullYear(), de.getMonth() + 1, 0)
      await bot.sendMessage(response.userProfile, TextMessage(de.toLocaleDateString()));
      dialogStates.merge(chatId, { type: 'GETTING_CONCISE', lastUpdated: new Date().getTime(), de });
      const cListok = getPaySlip(bot, response, 'CONCISE', db, de);
      cListok && withMenu(bot, response, [
        TextMessage(cListok),
        keyboardMenu]);
    }
  }
}