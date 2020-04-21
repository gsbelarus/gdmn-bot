import Koa from "koa";
import bodyParser from 'koa-bodyparser';
import Router from 'koa-router';
import http from 'http';
import https from 'https';
import path from 'path';
import { ICustomer, IEmployee, IAccDed, IPaySlip, ICustomers, IEmploeeByCustomer } from "./types";
import { FileDB, IData } from "./util/fileDB";
import { upload } from "./util/upload";
import { TelegramBot } from "./telegram";
import { initCurrencies } from "./currency";
import { Viber } from "./viber";
import { request } from 'https';
import * as fs from "fs";

/**
 * Мы используем KOA для организации веб-сервера.
 *
 * Веб сервер нам нужен:
 *
 *   1) для загрузки данных из Гедымина через POST запросы
 *   2) для реализации веб-интерфейса управления учетными
 *      записями (будет сделано позже)
 */

let app = new Koa();
let router = new Router();

router.get('/', (ctx, next) => {
  ctx.body = 'Hello World!';
  next();
});

router.post('/upload', (ctx, next) => {
  upload(ctx);
  next();
});

app
  .use(bodyParser())
  .use(router.routes())
  .use(router.allowedMethods());

/**
 * Если у нас получится грузить из Гедымина по протоколу
 * HTTPS, то HTTP сервер мы вообще уберем из программы.
 */

const httpServer = http.createServer(app.callback());

httpServer.listen(3000, async () => {
  console.log(`>>> SERVER: Сервер запущен: https://localhost:3000`)
});

/**
 * HTTPS сервер с платным сертификатом нам нужен для подключения
 * Viber.
 */

const cert = fs.readFileSync(path.resolve(process.cwd(), 'ssl/star.gdmn.app.crt'));
const key = fs.readFileSync(path.resolve(process.cwd(), 'ssl/gdmn.app.key'));
const ca = fs.readFileSync(path.resolve(process.cwd(), 'ssl/star.gdmn.app.ca-bundle'), {encoding:'utf8'})
  .split('-----END CERTIFICATE-----\r\n')
  .map(cert => cert +'-----END CERTIFICATE-----\r\n')
  .pop();

const httpsServer = https.createServer({ cert, ca, key }, app.callback());

httpsServer.listen(443, async () => {
  console.log(`>>> HTTPS SERVER: Сервер запущен: https://localhost:443`)
});

const telegramBotToken = process.env.GDMN_TELEGRAM_BOT_TOKEN;
const viberBotToken = process.env.GDMN_VIBER_BOT_TOKEN;

  // var headerBody = {
  //   'cache-control': 'no-cache',
  //   'content-type': 'application/json',
  //   // recommended to inject access tokens as environmental variables, e.g.
  //   'x-viber-auth-token': viberBotToken
  // };

//   router.get('/', function(ctx, next) {
//     ctx.header(200, {
//         'content-type': 'text/plain'
//     });
//     ctx.throw("To chat with ZarobakBot\n\n");
//     // setting options to request the chat api of viber.
//     const options = {
//         method: 'POST',
//         url: 'https://chatapi.viber.com/pa/set_webhook',
//         headers: headerBody,
//         body: {
//             url: 'https://zarobak.gdmn.app',
//             event_types: ['delivered', 'seen', 'failed', 'subscribed', 'unsubscribed', 'conversation_started']
//         },
//         json: true
//     };

//     const req = request(options, (res) => {
//       console.log(`statusCode: ${res.statusCode}`)

//       res.on('data', (d) => {
//         process.stdout.write(d)
//       })
//     })

//     req.on('error', (error) => {
//       console.error(error)
//     })

//     //req.write(data)
//     req.end()


//     // request to the chat api of viber.
//     // const req = request(options, function(res: any) {
//     //   console.log("The status message received for set Webhook request is - " + res.message);

//     // });
//     // req.end();

//     // req.on('error', function(e) {
//     //   console.log('Problem with Webhook request: ' + e.message);
//     // });
// });


//https.createServer(config.https.options, serverCallback).listen(config.https.port);


if (typeof telegramBotToken !== 'string') {
  throw new Error('GDMN_TELEGRAM_BOT_TOKEN env variable is not specified.');
}

if (typeof viberBotToken !== 'string') {
  throw new Error('GDMN_VIBER_BOT_TOKEN env variable is not specified.');
}

// initCurrencies()
//   .then( () => {
//     const telegram = new TelegramBot(
//       telegramBotToken,
//       getCustomers,
//       getEmployeesByCustomer,
//       getAccDeds,
//       getPaySlipByUser);

//     const viber = new Viber(
//       viberBotToken,
//       getCustomers,
//       getEmployeesByCustomer,
//       getAccDeds,
//       getPaySlipByUser);

//     /**
//      * При завершении работы сервера скидываем на диск все данные.
//      */
//     process.on('exit', code => {
//       customers.flush();

//       for (const ec of Object.values(employeesByCustomer)) {
//         ec.flush();
//       }

//       telegram.finalize();

//       viber.finalize();

//       console.log('Process exit event with code: ', code);
//     });
//   });

process
  .on('SIGINT', () => process.exit())
  .on('unhandledRejection', (reason, p) => {
    console.log({ err: reason }, `bot launch ${p}`);
  })
  .on('uncaughtException', err => {
    console.log({ err }, 'bot launch');
    process.exit(1);
  });
