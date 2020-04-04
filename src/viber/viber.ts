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

//     bot.onTextMessage(/paySlipCompare/, async (message: any, response: any) => {
//       paySlipCompareDialog(bot, message, response, true);
//     });

//     bot.onTextMessage(/paySlipByPeriod/, async (message: any, response: any) => {
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

