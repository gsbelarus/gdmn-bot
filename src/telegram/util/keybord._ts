import { Markup, ContextMessageUpdate } from "telegraf";
import { Lang, monthList, LName } from "../../types";
import { getLName, getLanguage, getCurrencies, getCurrencyNameById } from "../../util/utils";

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
    Markup.callbackButton('🔧 Параметры', 'settings') as any,
    Markup.callbackButton('🚪 Выйти', 'logout') as any
  ],
  [
    Markup.urlButton('❓', 'http://gsbelarus.com')
  ]
]);

export const keyboardCalendar = (lng: Lang, year: number) => {
  let keyboard: any[] = [];

  for (let i = 0; i < 3;  i++) {
    let row: any[] = [];
    monthList.forEach((m, idx) => {
      if (idx >= i*4 && idx < (i+1)*4) {
        const name = getLName(m.name as LName, [lng, 'ru']);
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

export const createCallBackData = (action: string, year: number, month?: number) => {
  return ([action, year.toString(), month?.toString()]).join(';');
}

export const separateCallBackData = (data: string) => {
  return data.split(';');
}

export const createCallBackCurrency = (action: string, currencyId: number, currencyName?: string) => {
  return ([action, currencyId, currencyName]).join(';');
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

export const currencySelection = (ctx: ContextMessageUpdate): number | undefined => {
  const query = ctx.callbackQuery;

  if (query?.data) {
    const [action, currencyId] = separateCallBackData(query.data);
    switch (action) {
      case 'currency': {
        return parseInt(currencyId);
      }
    }

  }
  return undefined;
}

export const keyboardSettings = Markup.inlineKeyboard([
  [
    Markup.callbackButton('Выбрать валюту', 'getCurrency') as any,
    Markup.callbackButton('Еще что-нибудь', 'test') as any
  ],
  [
    Markup.callbackButton('Меню', 'menu') as any
  ]
]);

export const keyboardCurrency = (ctx: ContextMessageUpdate) => {
  let keyboard: any[] = [];
  if (!ctx.chat) {
    throw new Error('Invalid context');
  }

  let row: any[] = [];
  const lng = getLanguage(ctx.from?.language_code);

  getCurrencies()?.filter(c => c.Cur_ID === 292 || c.Cur_ID === 145).forEach((m, idx) => {
    const currencyName = getCurrencyNameById(lng, m.Cur_ID);
    currencyName && row.push(Markup.callbackButton(currencyName, createCallBackCurrency('currency', m.Cur_ID, currencyName)));
  });
  keyboard.push(row);
  row = [];
  getCurrencies()?.filter(c => c.Cur_ID === 298).forEach((m, idx) => {
    const currencyName = getCurrencyNameById(lng, m.Cur_ID);
    currencyName && row.push(Markup.callbackButton(currencyName, createCallBackCurrency('currency', m.Cur_ID, currencyName)));
  });
  row.push(Markup.callbackButton('Белорусский рубль', createCallBackCurrency('currency', 0, 'Белорусский рубль')));

  keyboard.push(row);

  keyboard.push([
    Markup.callbackButton('Меню', 'menu')
  ]);

  return Markup.inlineKeyboard(keyboard);
};

