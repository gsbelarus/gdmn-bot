import { Bot, Menu } from "../bot";
import { getLanguage, getSumByRate } from "../util/utils";
import { ICustomers, IEmploeeByCustomer, IPaySlip, IAccDed, ITypePaySlip } from "../types";
import { IData } from "../util/fileDB";

const vb = require('viber-bot');

const ViberBot = vb.Bot
const BotEvents = vb.Events
const TextMessage = vb.Message.Text;
const KeyboardMessage = vb.Message.Keyboard;

export class Viber extends Bot {
  private _bot: any;

  constructor(token: string,
    getCustomers: () => ICustomers,
    getEmployeesByCustomer: (customerId: string) => IEmploeeByCustomer,
    getAccDeds: (customerId: string) => IData<IAccDed>,
    getPaySlipByUser: (customerId: string, userId: string, year: number) => IData<IPaySlip>) {

    super('viber', getCustomers, getEmployeesByCustomer, getAccDeds, getPaySlipByUser);

    this._bot = new ViberBot({
      authToken: token,
      name: 'GDMN Bot',
      avatar: ''
    });


    const ngrok = require('./get_public_url');
    const http = require('http');
    const port = process.env.PORT || 8080;
    ngrok.getPublicUrl().then((publicUrl: string) => {
      console.log('Set the new webhook to"', publicUrl);
      http.createServer(this._bot.middleware()).listen(port, () => this._bot.setWebhook(publicUrl));
    }).catch((error: any) => {
      console.log('Can not connect to ngrok server. Is it running?');
      console.error(error);
    });

    this._bot.on(BotEvents.SUBSCRIBED, async (response: any) => {
      if (!response?.userProfile) {
        console.error('Invalid chat context');
      } else {
        this.start(response.userProfile.id.toString());
      }
    });

    this._bot.on(BotEvents.CONVERSATION_STARTED, async (response: any, isSubscribed: boolean) => {
      console.log('start');
      // if (isSubscribed) {
      //   return;
      // }

      if (!response?.userProfile) {
        console.error('Invalid chat context');
      } else {
        this.start(response.userProfile.id.toString());
      }
    });

    this._bot.on(BotEvents.MESSAGE_RECEIVED, async (message: any, response: any) => {
      console.log('process: ', message);
      if (!response?.userProfile) {
        console.error('Invalid chat context');
      }
      else if (message?.text === undefined) {
        console.error('Invalid chat message');
      } else {
        this.process(response.userProfile.id.toString(), message.text);
      }
    });

    this._bot.on(BotEvents.MESSAGE_RECEIVED, async (message: any, response: any) => {
      console.log('callback_query: ', message);
      if (!response?.userProfile) {
        console.error('Invalid chat context');
      }
      else if (message?.text === undefined) {
        console.error('Invalid chat callbackQuery');
      } else {
        this.callback_query(response.userProfile.id.toString(), getLanguage(response.userProfile.language), message.text);
      }
    });

    this._bot.onTextMessage(/login/, async (message: any, response: any) => {
      console.log('login: ', message);
      if (!response?.userProfile) {
        console.error('Invalid chat context');
      } else {
        this.loginDialog(response.userProfile.id.toString(), undefined, true);
      }
    });

    this._bot.onTextMessage(/logout/, async (message: any, response: any) => {
      if (!response?.userProfile) {
        console.error('Invalid chat context');
      } else {
        this.logout(response.userProfile.id.toString())
      }
    });

    this._bot.onTextMessage(/paySlip/, (message: any, response: any) => {
      if (!response?.userProfile) {
        console.error('Invalid chat context');
      } else {
        const today = new Date();
        //Для теста период апрель 2019, потом удалить, когда будут данные
        const db = new Date(2019, 4, 1);
        const de = new Date(2019, 5, 0);
        this.paySlip(response.userProfile.id.toString(), 'CONCISE', getLanguage(response.userProfile.language), db, de);
      }
    });

    this._bot.onTextMessage(/detailPaySlip/, (message: any, response: any) => {
      if (!response?.userProfile) {
        console.error('Invalid chat context');
      } else {
        const today = new Date();
        //Для теста период апрель 2019, потом удалить, когда будут данные
        const db = new Date(2019, 4, 1);
        const de = new Date(2019, 5, 0);
        this.paySlip(response.userProfile.id.toString(), 'DETAIL', getLanguage(response.userProfile.language), db, de);
      }
    });

    this._bot.onTextMessage(/concisePaySlip/, (message: any, response: any) => {
      if (!response?.userProfile) {
        console.error('Invalid chat context');
      } else {
        this.paySlipDialog(response.userProfile.id.toString(), getLanguage(response.userProfile.language), undefined, true);
      }
    });

    this._bot.onTextMessage(/comparePaySlip/, (message: any, response: any) => {
      if (!response?.userProfile) {
        console.error('Invalid chat context');
      } else {
        this.paySlipCompareDialog(response.userProfile.id.toString(), getLanguage(response.userProfile.language), undefined, true);
      }
    });

    this._bot.onTextMessage(/settings/, (message: any, response: any) => {
      if (!response?.userProfile) {
        console.error('Invalid chat context');
      } else {
        this.settings(response.userProfile.id.toString())
      }
    });

    this._bot.onTextMessage(/menu/, (message: any, response: any) => {
      if (!response?.userProfile) {
        console.error('Invalid chat context');
      } else {
        this.menu(response.userProfile.id.toString())
      }
    });

    this._bot.onTextMessage(/getCurrency/, (message: any, response: any) => {
      if (!response?.userProfile) {
        console.error('Invalid chat context');
      } else {
        this.currencyDialog(response.userProfile.id.toString(), getLanguage(response.userProfile.language), undefined, true);
      }
    });

    // this._bot.action('delete', ({ deleteMessage }) => deleteMessage());

    //this._bot.launch();
  }

  private _menu2ViberMenu(menu: Menu) {
    const res: any[] = [];

    for (const row of menu) {
      let buttonWidth = Math.floor(6 / row.length);

      if (!buttonWidth) {
        buttonWidth = 1;
      }

      for (const col of row) {
        if (col.type === 'BUTTON') {
          res.push({
            Columns: buttonWidth,
            Rows: 1,
            ActionType: 'reply',
            ActionBody: col.command,
            Text: `<font color=\"#ffffff\">${col.caption}</font>`,
            BgColor: '#7e72ff' //'#836eff'
          });
        } else {
          res.push({
            Columns: buttonWidth,
            Rows: 1,
            ActionType: 'open-url',
            ActionBody: col.url,
            Text: `<font color=\"#ffffff\">${col.caption}</font>`,
            BgColor: '#7e72ff'//'#836eff'
          });
        }
      }
    }

    return {
      Type: 'keyboard',
      Buttons: res
    };
  }

  get bot() {
    return this._bot;
  }

  async editMessageReplyMarkup(chatId: string, menu: Menu) {
    await this._bot.sendMessage({ id: chatId }, [new KeyboardMessage(this._menu2ViberMenu(menu))]);
  }

  async deleteMessage(chatId: string) {

  }

  async sendMessage(chatId: string, message: string, menu?: Menu, markdown?: boolean) {
    if (menu) {
      console.log(this._menu2ViberMenu(menu));
      await this._bot.sendMessage({ id: chatId }, [new TextMessage(message), new KeyboardMessage(this._menu2ViberMenu(menu))]);
    } else {
      await this._bot.sendMessage({ id: chatId }, [new TextMessage(message)]);
    }
  }

  getPaySlipString(prevStr: string, name: string, s: number) {
    return `${prevStr}${prevStr !== '' ? '\r\n' : ''}  ${name}\r\n  =${s}`
    // let name_1 = '';
    // const len = 27;
    // if (name.length > len) {
    //   name_1 = name.length > len ? name.slice(0, len) : name;
    //   name = name.slice(len).padEnd(len);
    //   return `${prevStr}${prevStr !== '' ? '\r\n' : ''}  ${name_1}\r\n  ${name} ${s.toFixed(2).padStart(7)}`;
    // } else {
    //   return `${prevStr}${prevStr !== '' ? '\r\n' : ''}  ${name.padEnd(len)} ${s.toFixed(2).padStart(7)}`;
    // }
  }

  paySlipView(typePaySlip: ITypePaySlip, db: Date, de: Date, dbMonthName: string, rate: number, deptName: string, posName: string, currencyAbbreviation: string,
    accrual: number[], advance: number[], ded: number[], allTaxes: number[], tax_ded: number[], privilage: number[], salary: number[], saldo: number[], incomeTax: number[], pensionTax: number[], tradeUnionTax: number[],
    strAccruals: string, strAdvances: string, strDeductions: string, strTaxes: string, strTaxDeds: string, strPrivilages: string, toDb?: Date, toDe?: Date) {
    const lenS = 7;
    switch (typePaySlip) {
      case 'DETAIL': {
        const len = 18;
        return (`
Расчетник за ${dbMonthName}
Начисления: ${getSumByRate(accrual[0], rate).toFixed(2)}
===========================
${strAccruals}
===========================
Аванс: ${getSumByRate(advance[0], rate).toFixed(2)}
===========================
${strAdvances}
===========================
Удержания: ${getSumByRate(ded[0], rate).toFixed(2)}
===========================
${strDeductions}
===========================
Налоги: ${allTaxes[0].toFixed(2)}
===========================
${strTaxes}
===========================
Вычеты: ${getSumByRate(tax_ded[0], rate).toFixed(2)}
===========================
${strTaxDeds}
===========================
Льготы: ${getSumByRate(privilage[0], rate).toFixed(2)}
===========================
${strPrivilages}
Подразделение:
${deptName}
Должность:
${posName}
Оклад: ${getSumByRate(salary[0], rate).toFixed(2)}
Валюта: ${currencyAbbreviation}
`)
      }
      case 'CONCISE': {
        const len = 30;
        const m = de.getFullYear() !== db.getFullYear() || de.getMonth() !== db.getMonth() ? `с ${db.toLocaleDateString()} по ${de.toLocaleDateString()}` : `${dbMonthName}`;
        return (`
Расчетник ${m}
Начислено: ${getSumByRate(accrual[0], rate).toFixed(2)}
===========================
Зарплата чистыми: ${(getSumByRate(accrual[0], rate) - allTaxes[0]).toFixed(2)}
Аванс: ${getSumByRate(advance[0], rate).toFixed(2)}
К выдаче: ${getSumByRate(saldo[0], rate).toFixed(2)}
Удержания: ${getSumByRate(ded[0], rate).toFixed(2)}
===========================
Налоги: ${allTaxes[0].toFixed(2)}
Подоходный: ${getSumByRate(incomeTax[0], rate).toFixed(2)}
Пенсионный: ${getSumByRate(pensionTax[0], rate).toFixed(2)}
Профсоюзный: ${getSumByRate(tradeUnionTax[0], rate).toFixed(2)}
===========================
Подразделение:
${deptName}
Должность:
${posName}
Оклад: ${getSumByRate(salary[0], rate).toFixed(2)}
Валюта: ${currencyAbbreviation}
  `);
      }
      case 'COMPARE': {
        if (toDb && toDe) {
          const len = 23;
          return (`
Сравнение расчетных листков
Период I: ${db.toLocaleDateString()} - ${de.toLocaleDateString()}
Период II: ${toDb.toLocaleDateString()} - ${toDe.toLocaleDateString()}

Начислено I: ${getSumByRate(accrual[0], rate).toFixed(2)}
Начислено II:${getSumByRate(accrual[1], rate).toFixed(2)}
Разница: ${(getSumByRate(accrual[1], rate) - getSumByRate(accrual[0], rate)).toFixed(2)}
===========================
Зарплата чистыми I: ${(getSumByRate(accrual[0], rate) - allTaxes[0]).toFixed(2)}
Зарплата чистыми II: ${(getSumByRate(accrual[1], rate) - allTaxes[1]).toFixed(2)}
Разница: ${(getSumByRate(accrual[1], rate) - allTaxes[1] - (getSumByRate(accrual[0], rate) - allTaxes[0])).toFixed(2)}
Аванс I: ${getSumByRate(advance[0], rate).toFixed(2)}
Аванс II: ${getSumByRate(advance[1], rate).toFixed(2)}
Разница: ${(getSumByRate(advance[1], rate) - getSumByRate(advance[0], rate)).toFixed(2)}
К выдаче I: ${getSumByRate(saldo[0], rate).toFixed(2)}
К выдаче II:${getSumByRate(saldo[1], rate).toFixed(2)}
Разница: ${(getSumByRate(saldo[1], rate) - getSumByRate(saldo[0], rate)).toFixed(2)}
Удержания I: ${getSumByRate(ded[0], rate).toFixed(2)}
Удержания II:${getSumByRate(ded[1], rate).toFixed(2)}
Разница: ${(getSumByRate(ded[1], rate) - getSumByRate(ded[0], rate)).toFixed(2)}
===========================
Налоги I: ${allTaxes[0].toFixed(2)}
Налоги II: ${allTaxes[1].toFixed(2)}
Разница: ${(allTaxes[1] - allTaxes[0]).toFixed(2)}
Подоходный I: ${getSumByRate(incomeTax[0], rate).toFixed(2)}
Подоходный II:.${getSumByRate(incomeTax[1], rate).toFixed(2)}
Разница: ${(getSumByRate(incomeTax[1], rate) - getSumByRate(incomeTax[0], rate)).toFixed(2)}
Пенсионный I: ${getSumByRate(pensionTax[0], rate).toFixed(2)}
Пенсионный II: ${getSumByRate(pensionTax[1], rate).toFixed(2)}
Разница: ${(getSumByRate(pensionTax[1], rate) - getSumByRate(pensionTax[0], rate)).toFixed(2)}
Профсоюзный I: ${getSumByRate(tradeUnionTax[0], rate).toFixed(2)}
Профсоюзный II:${getSumByRate(getSumByRate(tradeUnionTax[1], rate), rate).toFixed(2)}
Разница: ${(getSumByRate(getSumByRate(tradeUnionTax[1], rate), rate) - getSumByRate(tradeUnionTax[0], rate)).toFixed(2)}
===========================
Подразделение:
${deptName}
Должность:
${posName}
Оклад I: ${getSumByRate(salary[0], rate).toFixed(2)}
Оклад II: ${getSumByRate(salary[1], rate).toFixed(2)}
Разница: ${(getSumByRate(salary[1], rate) - getSumByRate(salary[0], rate)).toFixed(2)}
Валюта: ${currencyAbbreviation}
`);
        }
      }
    }
    return;
  }
};





// const ViberBot  = require('viber-bot').Bot
// const BotEvents = require('viber-bot').Events
// const TextMessage = require('viber-bot').Message.Text;
// const KeyboardMessage = require('viber-bot').Message.Keyboard;
// import * as https from 'https'
// import {  customers } from '../server'
// import { keyboardMenu, keyboardLogin, keyboardSettings } from './util/keybord';
// import { loginDialog } from './actions/loginDialog._ts';
// import { getPaySlip } from './actions/getPaySlip._ts';
// import { paySlipDialog } from './actions/paySlipDialog._ts';
// import { paySlipCompareDialog } from './actions/paySlipCompareDialog._ts';
// import { currencyDialog } from './actions/currencyDialog._ts';
// import fs from 'fs';
// import path from 'path';

// const token = '4b3e05a56367d074-9b93ed160b5ebc92-c3aeed25f53c282'
// export const config = {
//   domain: 'gs.selfip.biz',
//   https: {
//     port: 8443,
//     options: {
//       key: fs.readFileSync(path.resolve(process.cwd(), 'cert/gsbot-key.pem'), 'utf8').toString(),
//       cert: fs.readFileSync(path.resolve(process.cwd(), 'cert/gsbot-cert.pem'), 'utf8').toString(),
//     },
//   },
// };

// export default class Viber {
//   public static bot: any

//   public static init = () => {
//     if (typeof process.env.GDMN_BOT_TOKEN !== 'string') {
//       throw new Error('GDMN_BOT_TOKEN env variable is not specified.');
//     }

//     const bot = new ViberBot({
//       authToken: token,
//       name: 'GDMN Bot',
//       avatar: ''
//     })

//     // const webhookUrl = `https://${config.domain}:${config.https.port}`
//     // console.log(webhookUrl);

//     // // Starting webhook server
//     // const serverViber = https.createServer(config.https.options, bot.middleware());
//     // serverViber.listen(config.https.port, async () => {
//     //   try {
//     //     await bot.setWebhook(webhookUrl)
//     //    console.log(`>>> VIBER: Webhook сервер запущен!`)
//     //   }
//     //   catch (err) {
//     //     console.error(err)
//     //   }
//     // })
//     const ngrok = require('./get_public_url');
//     const http = require('http');
//     const port = process.env.PORT || 8080;
//     ngrok.getPublicUrl().then((publicUrl: string) => {
//         console.log('Set the new webhook to"', publicUrl);
//         http.createServer(bot.middleware()).listen(port, () => bot.setWebhook(publicUrl));
//     }).catch((error: any) => {
//         console.log('Can not connect to ngrok server. Is it running?');
//         console.error(error);
//     });


//     Viber.bot = bot;


//     bot.on(BotEvents.SUBSCRIBED, async (response: any) => {
//       const chatId = response.userProfile.id.toString();
//       const link = accountLink.read(chatId);
//       if (!link) {
//         dialogStates.merge(chatId, { type: 'INITIAL', lastUpdated: new Date().getTime() });
//       } else {
//         dialogStates.merge(chatId, { type: 'LOGGED_IN', lastUpdated: new Date().getTime() });
//       }
//     });


//     bot.on(BotEvents.CONVERSATION_STARTED, async (response: any, isSubscribed: boolean) => {
//       if (isSubscribed) {
//         return;
//       }
//       const chatId = response.userProfile.id.toString();
//       const link = accountLink.read(chatId);
//       if (!link) {
//         dialogStates.merge(chatId, { type: 'INITIAL', lastUpdated: new Date().getTime() });
//         await withMenu(bot, response,
//          'Приветствуем! Для получения информации о заработной плате необходимо зарегистрироваться в системе.',
//           keyboardLogin)
//       } else {
//         dialogStates.merge(chatId, { type: 'LOGGED_IN', lastUpdated: new Date().getTime() });
//         await withMenu(bot, response,
//           'Здраствуйте! Вы зарегистрированы в системе. Выберите одно из предложенных действий.',
//           keyboardMenu)
//       }
//     });

//     bot.on(BotEvents.MESSAGE_RECEIVED, async (message: any, response: any) => {
//     //    if (ctx.chat) {
//       const chatId = response.userProfile.id.toString();
//       const dialogState = dialogStates.read(chatId);

//       if (dialogState?.type === 'LOGGING_IN') {
//         loginDialog(bot, response, message);
//       } else if (dialogState?.type === 'GETTING_CURRENCY' || dialogState?.type === 'GETTING_SETTINGS') {
//         await withMenu(bot, response,
//           `
//           🤔 Ваша команда непонятна.

//           Выберите одно из предложенных действий.
//           `,
//           keyboardMenu);
//       }
//       else if (dialogState?.type === 'LOGGED_IN') {
//         if (message.text === 'организации') {
//             new TextMessage(Object.values(customers).map( c => c.name).join(', ')),
//             new TextMessage(chatId),
//             new TextMessage(response.userProfile.name);
//           // ctx.reply(Object.values(customers).map( c => c.name).join(', '));
//           // ctx.reply(ctx.chat.id.toString());
//           // ctx.reply(ctx.from!.id.toString());
//           // ctx.reply(ctx.from!.username!);
//         } else {
//           await withMenu(bot, response,
//   `
//   🤔 Ваша команда непонятна.

//   Выберите одно из предложенных действий.
//   `, keyboardMenu);
//         }
//       }
//       else if (dialogState?.type !== 'INITIAL') {
//         await withMenu(bot, response,
//           'Для получения информации о заработной плате необходимо зарегистрироваться в системе.',
//           keyboardLogin);
//       }
//     });

//     bot.onTextMessage(/login/, (message: any, response: any) => {
//       const chatId = response.userProfile.id.toString();
//       const dialogState = dialogStates.read(chatId);

//       if (dialogState?.type !== 'LOGGING_IN') {
//         loginDialog(bot, response, message, true);
//       }
//     });

//     bot.onTextMessage(/logout/, async (message: any, response: any) => {
//       await withMenu(bot, response,
//         '💔 До свидания!',
//         keyboardLogin);
//       const chatId = response.userProfile.id.toString();
//       accountLink.delete(chatId);
//       dialogStates.merge(chatId, { type: 'INITIAL', lastUpdated: new Date().getTime() }, ['employee']);
//     });

//     bot.onTextMessage(/paySlip/, async (message: any, response: any) => {
//       const today = new Date();
//       //Для теста на существующих данных
//       //потом оставить на текущую дату
//       const db = new Date(2019, 4, 1);
//       const de = new Date(2019, 5, 0);
//       const cListok = getPaySlip(bot, response, 'CONCISE', db, de);
//       cListok && withMenu(bot, response,
//         cListok,
//         keyboardMenu);
//     });

//     bot.onTextMessage(/detailPaySlip/, async (message: any, response: any) => {
//       const today = new Date();
//       const db = new Date(2019, 4, 1);
//       const de = new Date(2019, 5, 0);
//       const cListok = getPaySlip(bot, response, 'DETAIL', db, de);
//       cListok && withMenu(bot, response,
//         cListok,
//         keyboardMenu);
//     });

//     bot.onTextMessage(/comparePaySlip/, async (message: any, response: any) => {
//       paySlipCompareDialog(bot, message, response, true);
//     });

//     bot.onTextMessage(/concisePaySlip/, async (message: any, response: any) => {
//       paySlipDialog(bot, message, response, true);
//     });

//     bot.onTextMessage(/settings/, async (message: any, response: any) => {
//       dialogStates.merge(response.userProfile.id.toString(), { type: 'GETTING_SETTINGS', lastUpdated: new Date().getTime() });
//       withMenu(bot, response,
//         'Параметры',
//         keyboardSettings);
//     });

//     bot.onTextMessage(/menu/, async (message: any, response: any) => {
//       withMenu(bot, response,
//         'Выберите одно из предложенных действий',
//         keyboardMenu);
//     });

//     bot.onTextMessage(/getCurrency/, async (message: any, response: any) => {
//       currencyDialog(bot, response, true);
//     });
//   }
// }

// export const withMenu = async (bot: any, response: any, msg: string, menu?: any) => {
//   // if (!ctx.chat) {
//   //   throw new Error('Invalid context');
//   // }
//   const chatId = response.userProfile.id.toString();
//   if (menu) {
//     bot.sendMessage(response.userProfile, new TextMessage(msg, menu));
//   } else {
//     bot.sendMessage(response.userProfile, new TextMessage(msg));
//   }
//   const dialogState = dialogStates.read(chatId);

//   if (dialogState) {
//     // if (dialogState.menuMessageId) {
//     //   try {
//     //     await Viber.bot.telegram.editMessageReplyMarkup(ctx.chat.id, dialogState.menuMessageId);
//     //   }
//     //   catch (e) {
//     //     // TODO: если сообщение уже было удалено из чата, то
//     //     // будет ошибка, которую мы подавляем.
//     //     // В будущем надо ловить события удаления сообщения
//     //     // и убирать его ИД из сохраненных данных
//     //   }
//     // }

//     if (menu) {
//       dialogStates.merge(chatId, { menuMessageId: chatId });
//     } else {
//       dialogStates.merge(chatId, { menuMessageId: undefined });
//     }
//   }
// };

