import { Markup, ContextMessageUpdate } from "telegraf";
import { Lang, monthList, LName } from "../types";
import { getLName, getLanguage } from "./utils";

export const keyboardLogin = Markup.inlineKeyboard([
  Markup.callbackButton('✏ Зарегистрироваться', 'login') as any,
  Markup.urlButton('❓', 'http://gsbelarus.com'),
]);

export const keyboardMenu = Markup.inlineKeyboard([
  [
    Markup.callbackButton('💰 Расчетный листок', 'paySlip') as any,
    Markup.callbackButton('💰 Подробный листок', 'detailPaySlip') as any
  ],
  [
    Markup.callbackButton('💰 Листок за период', 'paySlipByPeriod') as any,
    Markup.callbackButton('💰 Сравнить..', 'paySlipCompare') as any
  ],
  [
    Markup.callbackButton('🚪 Выйти', 'logout') as any,
    Markup.urlButton('❓', 'http://gsbelarus.com')
  ],
  [
    Markup.callbackButton('Параметры', 'settings') as any,

  ]
]);

export const keyboardCalendar = (lng: Lang, year: number) => {
  let keyboard: any[] = [];

  for (let i = 0; i < 3;  i++) {
    let row: any[] = [];
    monthList.forEach((m, idx) => {
      if (idx >= i*4 && idx < (i+1)*4) {
        const name = getLName(m.name as LName, ['ru']);
        row.push(Markup.callbackButton(name, createCallBackData('month', year, idx)));
      }
    });
    keyboard.push(row)
  };
  keyboard.push([
    Markup.callbackButton("<", createCallBackData('prevYear', year)),
    Markup.callbackButton(year.toString(), createCallBackData('otherYear', year)),
    Markup.callbackButton(">", createCallBackData('nextYear', year))
  ]);
  return Markup.inlineKeyboard(keyboard);
};

const createCallBackData = (action: string, year: number, month?: number) => {
  return ([action, year.toString(), month?.toString()]).join(';');
}

const separateCallBackData = (data: string) => {
  return data.split(';');
}

export const calendarSelection = (ctx: ContextMessageUpdate): Date | undefined => {
  const query = ctx.callbackQuery;

  if (query?.data) {
    const [action, year, month] = separateCallBackData(query.data);
    const lng = getLanguage(ctx.from?.language_code);
    switch (action) {
      case 'month': {
        const selectedDate = new Date(parseInt(year), parseInt(month), 1);
        return selectedDate;
      }
      case 'prevYear': {
        ctx.editMessageReplyMarkup(keyboardCalendar(lng, parseInt(year) - 1));
        break;
      }
      case 'nextYear': {
        ctx.editMessageReplyMarkup(keyboardCalendar(lng, parseInt(year) + 1));
        break;
      }
      case 'otherYear': {
        break;
      }
    }
  }
  return undefined;
}