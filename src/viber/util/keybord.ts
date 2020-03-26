import { monthList, LName, Lang } from "../../types";
import { getLName, getLanguage, getCurrencies, getCurrencyNameById } from "../../util/utils";

export const keyboardLogin = {
  Type: 'keyboard',
  Buttons: [
    {
      ActionType: 'reply',
      ActionBody: 'login',
      Text: '✏ Зарегистрироваться',
    },
    {
      ActionType: 'reply',
      ActionBody: 'exit',
      Text: 'http://gsbelarus.com',
    }
  ]
}

export const keyboardMenu = {
  Type: 'keyboard',
  Buttons: [
    {
      ActionType: 'reply',
      ActionBody: 'paySlip',
      Text: '💰 Расчетный листок',
    },
    {
      ActionType: 'reply',
      ActionBody: 'detailPaySlip',
      Text: '💰 Подробный листок',
    },
    {
      ActionType: 'reply',
      ActionBody: 'paySlipByPeriod',
      Text: '💰 Листок за период',
    },
    {
      ActionType: 'reply',
      ActionBody: 'paySlipCompare',
      Text: '💰 Сравнить..',
    },
    {
      ActionType: 'reply',
      ActionBody: 'settings',
      Text: '🔧 Параметры',
    },
    {
      ActionType: 'reply',
      ActionBody: 'logout',
      Text: '🚪 Выйти',
    },
    {
      ActionType: 'reply',
      ActionBody: 'exit',
      Text: 'http://gsbelarus.com',
    }
  ],
};

const createCallBackData = (action: string, year: number, month?: number) => {
  return ([action, year.toString(), month?.toString()]).join(';');
}

export const separateCallBackData = (data: string) => {
  return data.split(';');
}

const createCallBackCurrency = (action: string, currencyId: number, currencyName?: string) => {
  return ([action, currencyId, currencyName]).join(';');
}

export const keyboardCalendar = (lng: Lang, year: number) => {

  let keyboard: any[] = [];

  for (let i = 0; i < 3;  i++) {
    monthList.forEach((m, idx) => {
      if (idx >= i*4 && idx < (i+1)*4) {
        const name = getLName(m.name as LName, [lng, 'ru']);
        keyboard.push(
          {
            "Columns": 1,
			      "Rows": 1,
            ActionType: 'reply',
            ActionBody: createCallBackData('month', year, idx),
            Text: name,
          });
      };
    });
    keyboard.push(
      {
        "Columns": 2,
        "Rows": 1,
        ActionType: 'reply',
        ActionBody: '',
        Text: ''
      });
  };

  keyboard.concat([
    {
      "Columns": 1,
      "Rows": 1,
      ActionType: 'reply',
      ActionBody: createCallBackData('prevYear', year),
      Text: "<",
    },
    {
      "Columns": 2,
      "Rows": 1,
      ActionType: 'reply',
      ActionBody: createCallBackData('otherYear', year),
      Text: year.toString(),
    },
    {
      "Columns": 1,
      "Rows": 1,
      ActionType: 'reply',
      ActionBody: createCallBackData('nextYear', year),
      Text: ">",
    }
  ]);
  keyboard.push(
    {
      "Columns": 2,
      "Rows": 1,
      ActionType: 'reply',
      ActionBody: '',
      Text: ''
    });

    return {
      Type: 'keyboard',
      Buttons: keyboard
    }
}


export const calendarSelection = (bot: any, message: any, response: any): Date | undefined => {
  if (message) {
    const [action, year, month] = separateCallBackData(message);
    const lng = getLanguage(bot.chat.language);
    switch (action) {
      case 'month': {
        const selectedDate = new Date(parseInt(year), parseInt(month), 1);
        return selectedDate;
      }
      case 'prevYear': {
        bot.sendMessage(response.userProfile, [keyboardCalendar(lng, parseInt(year) - 1)]);
        break;
      }
      case 'nextYear': {
        bot.sendMessage(response.userProfile, [keyboardCalendar(lng, parseInt(year) + 1)]);
        break;
      }
      case 'otherYear': {
        break;
      }
    }
  }
  return undefined;
}

export const keyboardSettings = {
  Type: 'keyboard',
  Buttons: [
    {
      "Columns": 3,
      "Rows": 1,
      ActionType: 'reply',
      ActionBody: 'getCurrency',
      Text: 'Выбрать валюту',
    },
    {
      "Columns": 3,
      "Rows": 1,
      ActionType: 'reply',
      ActionBody: 'test',
      Text: 'Еще что-нибудь',
    },
    {
      "Columns": 6,
      "Rows": 1,
      ActionType: 'reply',
      ActionBody: 'menu',
      Text: 'Меню',
    }
  ]
}

export const keyboardCurrency = (bot: any, response: any) => {
  let keyboard: any[] = [];
  // if (!ctx.chat) {
  //   throw new Error('Invalid context');
  // }

  let row: any[] = [];
  const lng = getLanguage(bot.chat.language);

  getCurrencies()?.filter(c => c.Cur_ID === 292 || c.Cur_ID === 145).forEach((m, idx) => {
    const currencyName = getCurrencyNameById(lng, m.Cur_ID);
    currencyName &&
    keyboard.push(
      {
        "Columns": 3,
        "Rows": 1,
        ActionType: 'reply',
        ActionBody: createCallBackCurrency('currency', m.Cur_ID, currencyName),
        Text: currencyName
      });
  });

  keyboard.push(row);
  row = [];
  getCurrencies()?.filter(c => c.Cur_ID === 298).forEach((m, idx) => {
    const currencyName = getCurrencyNameById(lng, m.Cur_ID);
    currencyName &&
    keyboard.push(
      {
        "Columns": 3,
        "Rows": 1,
        ActionType: 'reply',
        ActionBody: createCallBackCurrency('currency', m.Cur_ID, currencyName),
        Text: currencyName
      });
  });

  keyboard.push(
    {
      "Columns": 3,
      "Rows": 1,
      ActionType: 'reply',
      ActionBody: createCallBackCurrency('currency', 0, 'Белорусский рубль'),
      Text: 'Белорусский рубль'
    });

  keyboard.push(
    {
      "Columns": 6,
      "Rows": 1,
      ActionType: 'reply',
      ActionBody: 'menu',
      Text: 'Меню'
    });

  return {
    Type: 'keyboard',
    Buttons: keyboard
  }
};

export const currencySelection = (message: any) => {
  if (message) {
    const [action, currencyId] = separateCallBackData(message);
    switch (action) {
      case 'currency': {
        return parseInt(currencyId);
      }
    }
  }
  return undefined;
}