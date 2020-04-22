import Koa from "koa";
import bodyParser from 'koa-bodyparser';
import Router from 'koa-router';
import http from 'http';
import https from 'https';
import path from 'path';
import { upload_employees, upload_accDedRefs, upload_paySlips } from "./util/upload";
import { TelegramBot } from "./telegram";
import { initCurrencies } from "./currency";
import { Viber } from "./viber";
import * as fs from "fs";
import { getCustomers, getEmployeesByCustomer, getAccDeds, getPaySlipByUser, customers, employeesByCustomer } from "./data";

/**
 * Подгружаем некоторые справочники.
 */

initCurrencies().then( () => console.log('Currencies have been loaded...') );

/**
 * Создаем объекты наших ботов.
 * Телеграм сам как-то установит связь с внешним миром, через свои сервера
 * и сообщенный ему токен.
 * Вайбер надо связать с нашим веб сервером вручную.
 */

const telegramBotToken = process.env.GDMN_TELEGRAM_BOT_TOKEN;
const viberBotToken = process.env.GDMN_VIBER_BOT_TOKEN;

if (typeof telegramBotToken !== 'string') {
  throw new Error('GDMN_TELEGRAM_BOT_TOKEN env variable is not specified.');
}

if (typeof viberBotToken !== 'string') {
  throw new Error('GDMN_VIBER_BOT_TOKEN env variable is not specified.');
}

const telegram = new TelegramBot(
  telegramBotToken,
  getCustomers,
  getEmployeesByCustomer,
  getAccDeds,
  getPaySlipByUser);

const viber = new Viber(
  viberBotToken,
  getCustomers,
  getEmployeesByCustomer,
  getAccDeds,
  getPaySlipByUser);

/**
 * Мы используем KOA для организации веб-сервера.
 *
 * Веб сервер нам нужен:
 *
 *   1) для загрузки данных из Гедымина через POST запросы
 *   2) для реализации веб-интерфейса управления учетными
 *      записями (будет сделано позже)
 */

const app = new Koa();
const router = new Router();

router.get('/', (ctx, next) => {
  ctx.body = 'Hello World!';
  next();
});

router.post('/upload_employees', (ctx, next) => {
  upload_employees(ctx);
  next();
});

router.post('/upload_accDedRefs', (ctx, next) => {
 // upload_accDedRefs(ctx);
  if (ctx.request.body.dataType === 'accDedRef') {
    viber.sendMessageToEmployess(ctx.request.body.customerId, 'Пришли новые данные!');
    telegram.sendMessageToEmployess(ctx.request.body.customerId, 'Пришли новые данные!');
  }
  next();
});

router.post('/upload_paySlips', (ctx, next) => {
  upload_paySlips(ctx);
  next();
});

app
  //.use(viber.bot.middleware())
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

const viberCallback = viber.bot.middleware();
const koaCallback = app.callback();
const host = 'zarobak.gdmn.app';

https.createServer({ cert, ca, key },
  (req, res) => {
    if (req.headers.host === host) {
      viberCallback(req, res);
    } else {
      koaCallback(req, res);
    }
  }
).listen(443, () => viber.bot.setWebhook(`https://${host}`));

/*
const httpsServer = https.createServer({ cert, ca, key }, app.callback());
httpsServer.listen(443, async () => {
  console.log(`>>> HTTPS SERVER: Сервер запущен: https://localhost:443`);

  viber.bot.setWebhook('https://zarobak.gdmn.app');
});
*/

/**
 * При завершении работы сервера скидываем на диск все данные.
 */

process
  .on('exit', code => {
    customers.flush();

    for (const ec of Object.values(employeesByCustomer)) {
      ec.flush();
    }

    telegram.finalize();
    viber.finalize();

    console.log('Process exit event with code: ', code);
  })
  .on('SIGINT', () => process.exit())
  .on('unhandledRejection', (reason, p) => {
    console.log({ err: reason }, `bot launch ${p}`);
  })
  .on('uncaughtException', err => {
    console.log({ err }, 'bot launch');
    process.exit(1);
  });
