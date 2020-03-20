import { ContextMessageUpdate } from "telegraf";
import { IDialogStateGettingCurrency, Lang, NBRBRates, NBRBCurrencies } from "../types";
import { keyboardCurrency, keyboardMenu, currencySelection } from "../util/keybord";
import { withMenu, dialogStates, accountLink } from "../server";
import { getLanguage } from "../util/utils";
import { getUpdatedRates, BEGIN_DATE_RATES, PATH_NB_RB_RATES, PATH_NB_RB_CUR, getUpdatedCurrencies } from "../util/downLoadCurrencyRates";
import fs from 'fs';

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

/**Получить наименование валюты по ID валюты, по умолчанию 'Белорусский рубль' */
export const getCurrencyNameById = (lng: Lang, currencyId?: number) => {
  const c = getCurrencies()?.find(c => c.Cur_ID === currencyId);
  if (c) {
    return lng === 'ru' ? c.Cur_Name : lng === 'by' ? c.Cur_Name_Bel : c.Cur_Name_Eng;
  }
  return 'Белорусский рубль';
}

/**Получить аббривиатуру валюты по ID валюты, по умолчанию 'BYN' */
export const getCurrencyAbbreviationById = (currencyId?: number) => {
  const c = getCurrencies()?.find(c => c.Cur_ID === currencyId);
  if (c) {
    return c.Cur_Abbreviation;
  }
  return 'BYN';
}

/**Получить данные из файла типов валют, и если его нет, загрузить из сайта нацбанка  */
export const getCurrencies = (): NBRBCurrencies | undefined =>  {
  if (!fs.existsSync(PATH_NB_RB_CUR)) {
    return getUpdatedCurrencies();
  } else {
    return JSON.parse(fs.readFileSync(PATH_NB_RB_CUR, { encoding: 'utf8' }).toString());
  }
}

/**Получить курс валюты на дату по ID валюты */
export const getRateByCurrency = (date: Date, currencyId: number) => {
  //Если currencyId = 0 (белорусский рубль), курс = 1
  if (currencyId === 0) {
    return 1
  }
  let currencyRates: NBRBRates | undefined;
  if (!fs.existsSync(PATH_NB_RB_RATES)) {
    currencyRates = undefined;
  } else {
    currencyRates = JSON.parse(fs.readFileSync(PATH_NB_RB_RATES, { encoding: 'utf8' }).toString());
  }
  //Находим курс валюты на заданную дату
  //если нет файла или нет курса на заданную дату, то вызовем функцию загрузки файла из нацбанка
  //если есть курс, вернем его (российский курс разделим на 100)
  const currencyRate = currencyRates?.find(r => r.Cur_ID === currencyId && new Date(r.Date).getTime() === new Date(date).getTime());
  if (currencyRate) {
    const rate = currencyRate.Cur_OfficialRate;
    return currencyId === 298 ? rate/100 : rate;
  } else {
    //Вычисляем дату, от которой будем грузить курсы из нацбанка
    //это максимальная дата от даты из файла и константы BEGIN_DATE_RATES
    let lastDate = currencyRates?.sort((a, b) => new Date(b.Date).getTime()  - new Date(a.Date).getTime())[0]?.Date;
    if (lastDate) {
      lastDate = new Date(Math.max(new Date(BEGIN_DATE_RATES).getTime(), new Date(lastDate).getTime()));
    } else {
      lastDate = BEGIN_DATE_RATES
    }
    //Вызываем загрузку файла из нацбанка
    const updatedRates = getUpdatedRates(lastDate, new Date(), currencyRates);
    if (updatedRates) {
      const rate = updatedRates.filter(r => r.Cur_ID === currencyId && new Date(r.Date).getTime() < new Date(date).getTime())
        .sort((a, b) => new Date(b.Date).getTime()  - new Date(a.Date).getTime())[0]?.Cur_OfficialRate;
      return currencyId === 298 ? rate/100 : rate;
    } else {
      console.log('Rates are not updated!')
      return -1;
    }
  }
}
//4b3e05a56367d074-9b93ed160b5ebc92-c3aeed25f53c282