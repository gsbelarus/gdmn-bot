import { withMenu, dialogStates } from "../server";
import { ContextMessageUpdate } from "telegraf";
import { getLanguage } from "../util/utils";
import { IDialogStateGettingConcise } from "../types";
import { keyboardMenu, keyboardCalendar, calendarSelection } from "../util/keybord";
import { getPaySlip } from "./getPaySlip";

export const paySlipConciseDialog = async (ctx: ContextMessageUpdate, start = false) => {
  if (!ctx.chat) {
    throw new Error('Invalid context');
  }

  const chatId = ctx.chat.id.toString();

  if (start) {
    await withMenu(ctx, 'Укажите начало периода:', keyboardCalendar(getLanguage(ctx.from?.language_code), new Date().getFullYear()), true);
    dialogStates.merge(chatId, { type: 'GETTING_CONCISE', lastUpdated: new Date().getTime(), fromDb: undefined, fromDe: undefined, toDb: undefined, toDe: undefined });
  }

  const dialogState = dialogStates.getMutable(true)[chatId];

  if (!dialogState || dialogState.type !== 'GETTING_CONCISE') {
    throw new Error('Invalid dialog state');
  }

  const lng = getLanguage(ctx.from?.language_code);

  const { db, de } = dialogState as IDialogStateGettingConcise;
  if (!db) {
    const db = calendarSelection(ctx);
    if (db) {
      await ctx.reply(db.toLocaleDateString());
      dialogStates.merge(chatId, { type: 'GETTING_CONCISE', lastUpdated: new Date().getTime(), db });
      await withMenu(ctx, 'Укажите окончание периода:', keyboardCalendar(lng, new Date().getFullYear()), true);
    }
  } else if (!de) {
    let de = calendarSelection(ctx);
    if (de) {
      de = new Date(de.getFullYear(), de.getMonth() + 1, 0)
      await ctx.reply(de.toLocaleDateString());
      dialogStates.merge(chatId, { type: 'GETTING_CONCISE', lastUpdated: new Date().getTime(), de });
      const cListok = getPaySlip(ctx, 'CONCISE', db, de);
      cListok && withMenu(ctx, cListok, keyboardMenu, true);
    }
  }
}