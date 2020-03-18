import { withMenu, dialogStates } from "../server";
import { ContextMessageUpdate } from "telegraf";
import { getLanguage } from "../util/utils";
import { IDialogStateGettingCompare } from "../types";
import { keyboardMenu, keyboardCalendar, calendarSelection } from "../util/keybord";
import { getPaySlip } from "./getPaySlip";

export const paySlipCompareDialog = async (ctx: ContextMessageUpdate, start = false) => {
  if (!ctx.chat) {
    throw new Error('Invalid context');
  }

  const chatId = ctx.chat.id.toString();

  if (start) {
    await withMenu(ctx, 'Укажите начало первого периода:', keyboardCalendar(getLanguage(ctx.from?.language_code), new Date().getFullYear()), true);
    dialogStates.merge(chatId, { type: 'GETTING_COMPARE', lastUpdated: new Date().getTime(), fromDb: undefined, fromDe: undefined, toDb: undefined, toDe: undefined });
  }

  const dialogState = dialogStates.getMutable(true)[chatId];

  if (!dialogState || dialogState.type !== 'GETTING_COMPARE') {
    throw new Error('Invalid dialog state');
  }

  const lng = getLanguage(ctx.from?.language_code);

  const { fromDb, fromDe, toDb, toDe } = dialogState as IDialogStateGettingCompare;
  if (!fromDb) {
    const db = calendarSelection(ctx);
    if (db) {
      await ctx.reply(db.toLocaleDateString());
      dialogStates.merge(chatId, { type: 'GETTING_COMPARE', lastUpdated: new Date().getTime(), fromDb: db });
      await withMenu(ctx, 'Укажите окончание первого периода:', keyboardCalendar(lng, new Date().getFullYear()), true);
    }
  } else if (!fromDe) {
    let de = calendarSelection(ctx);
    if (de) {
      de = new Date(de.getFullYear(), de.getMonth() + 1, 0);
      await ctx.reply(de.toLocaleDateString());
      dialogStates.merge(chatId, { type: 'GETTING_COMPARE', lastUpdated: new Date().getTime(), fromDe: de });
      await withMenu(ctx, 'Укажите начало второго периода:', keyboardCalendar(lng, new Date().getFullYear()), true);
    }
  } else if (!toDb) {
      let db = calendarSelection(ctx);
      if (db) {
        await ctx.reply(db.toLocaleDateString());
        dialogStates.merge(chatId, { type: 'GETTING_COMPARE', lastUpdated: new Date().getTime(), toDb: db });
        await withMenu(ctx, 'Укажите окончание второго периода:', keyboardCalendar(lng, new Date().getFullYear()), true);
      }
  } else if (!toDe) {
      let de = calendarSelection(ctx);
      if (de) {
        de = new Date(de.getFullYear(), de.getMonth() + 1, 0);
        await ctx.reply(de.toLocaleDateString());
        dialogStates.merge(chatId, { type: 'GETTING_COMPARE', lastUpdated: new Date().getTime(), toDe: de });
        const cListok = getPaySlip(ctx, 'COMPARE', fromDb, fromDe, toDb, de);
        cListok && withMenu(ctx, cListok, keyboardMenu, true);
      }
  }
}