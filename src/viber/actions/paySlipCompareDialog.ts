import { dialogStates } from "../../server";
import { getLanguage } from "../../util/utils";
import { IDialogStateGettingCompare } from "../../types";
import { keyboardMenu, keyboardCalendar, calendarSelection } from "../util/keybord";
import { withMenu } from "../viber";
import { getPaySlip } from "./getPaySlip";
const TextMessage = require('viber-bot').Message.Text;

export const paySlipCompareDialog = async (bot: any, message: any, response: any,start = false) => {
  // if (!ctx.chat) {
  //   throw new Error('Invalid context');
  // }

  const chatId = bot.chat.id.toString();
  const lng = getLanguage(bot.chat.language);

  if (start) {
    await withMenu(bot, response, [
      TextMessage('Укажите начало первого периода:'),
      keyboardCalendar(lng, new Date().getFullYear())]);
    dialogStates.merge(chatId, { type: 'GETTING_COMPARE', lastUpdated: new Date().getTime(), fromDb: undefined, fromDe: undefined, toDb: undefined, toDe: undefined });
  }

  const dialogState = dialogStates.getMutable(true)[chatId];

  if (!dialogState || dialogState.type !== 'GETTING_COMPARE') {
    throw new Error('Invalid dialog state');
  }

  const { fromDb, fromDe, toDb, toDe } = dialogState as IDialogStateGettingCompare;
  if (!fromDb) {
    const db = calendarSelection(bot, message, response);
    if (db) {
      await bot.sendMessage(response.userProfile, TextMessage(db.toLocaleDateString()));
      dialogStates.merge(chatId, { type: 'GETTING_COMPARE', lastUpdated: new Date().getTime(), fromDb: db });
      await withMenu(bot, response, [
        TextMessage('Укажите окончание первого периода:'), keyboardCalendar(lng, new Date().getFullYear())
      ]);
    }
  } else if (!fromDe) {
    let de = calendarSelection(bot, message, response);
    if (de) {
      de = new Date(de.getFullYear(), de.getMonth() + 1, 0);
      await bot.sendMessage(response.userProfile, TextMessage(de.toLocaleDateString()));
      dialogStates.merge(chatId, { type: 'GETTING_COMPARE', lastUpdated: new Date().getTime(), fromDe: de });
      await withMenu(bot, response, [
        TextMessage('Укажите начало второго периода:'),
        keyboardCalendar(lng, new Date().getFullYear())
      ]);
    }
  } else if (!toDb) {
      let db = calendarSelection(bot, message, response);
      if (db) {
        await bot.sendMessage(response.userProfile, TextMessage(db.toLocaleDateString()));
        dialogStates.merge(chatId, { type: 'GETTING_COMPARE', lastUpdated: new Date().getTime(), toDb: db });
        await withMenu(bot, response, [
          TextMessage('Укажите окончание второго периода:'),
          keyboardCalendar(lng, new Date().getFullYear())
        ]);
      }
  } else if (!toDe) {
      let de = calendarSelection(bot, message, response);
      if (de) {
        de = new Date(de.getFullYear(), de.getMonth() + 1, 0);
        await bot.sendMessage(response.userProfile, TextMessage(de.toLocaleDateString()));
        dialogStates.merge(chatId, { type: 'GETTING_COMPARE', lastUpdated: new Date().getTime(), toDe: de });
        const cListok = getPaySlip(bot, response, 'COMPARE', fromDb, fromDe, toDb, de);
        cListok &&await withMenu(bot, response, [
          TextMessage(cListok),
          keyboardMenu
        ]);
      }
  }
}