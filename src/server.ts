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
 * Host and port number our HTTP server is accessible at.
 */
const HTTP_PORT = 3000;

/**
 * Host and port number our HTTPS server is accessible at.
 */
const HTTPS_PORT = 443;

/**
 * Host name for Viber callback;
 */
const VIBER_CALLBACK_HOST = 'zarobak.gdmn.app';

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

const GDMN_TELEGRAM_BOT_TOKEN = process.env.GDMN_TELEGRAM_BOT_TOKEN;

if (typeof GDMN_TELEGRAM_BOT_TOKEN !== 'string' || !GDMN_TELEGRAM_BOT_TOKEN) {
  throw new Error('GDMN_TELEGRAM_BOT_TOKEN env variable is not specified.');
}

const GDMN_VIBER_BOT_TOKEN = process.env.GDMN_VIBER_BOT_TOKEN;

if (typeof GDMN_VIBER_BOT_TOKEN !== 'string' || !GDMN_VIBER_BOT_TOKEN) {
  throw new Error('GDMN_VIBER_BOT_TOKEN env variable is not specified.');
}

const telegram = new TelegramBot(
  GDMN_TELEGRAM_BOT_TOKEN,
  getCustomers,
  getEmployeesByCustomer,
  getAccDeds,
  getPaySlipByUser);

const viber = new Viber(
  GDMN_VIBER_BOT_TOKEN,
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
  ctx.body = 'Zarobak Telegram/Viber Bot. Copyright (c) 2020 by Golden Software of Belarus, Ltd';
  return next();
});

router.post('/zarobak/v1/upload_employees', (ctx, next) => {
  upload_employees(ctx);
  return next();
});

router.post('/zarobak/v1/upload_accDedRefs', (ctx, next) => {
  upload_accDedRefs(ctx);
  return next();
});

router.post('/zarobak/v1/upload_paySlips', (ctx, next) => {
  upload_paySlips(ctx);

  // TODO: Сделать, чтобы не просто надпись выводилась, а человек сразу получал в чат
  //       краткий расчетный листок.
  viber.sendMessageToEmployee(ctx.request.body.customerId, ctx.request.body.objData.emplId, 'Пришли новые данные!');
  telegram.sendMessageToEmployee(ctx.request.body.customerId, ctx.request.body.objData.emplId, 'Пришли новые данные!');

  return next();
});

app
  .use(bodyParser())
  .use(router.routes())
  .use(router.allowedMethods());

const koaCallback = app.callback();

const flushData = () => {
  customers.flush();

  for (const ec of Object.values(employeesByCustomer)) {
    ec.flush();
  }

  // FIXME: переименовать finalize в flush
  telegram.finalize();
  viber.finalize();
};


// TODO: Если у нас получится грузить из Гедымина по протоколу HTTPS, то HTTP сервер мы вообще уберем из программы.

const httpServer = http.createServer(koaCallback);

httpServer.listen(HTTP_PORT, async () => {
  console.log(`>>> SERVER: Сервер запущен: https://localhost:${HTTP_PORT}`)
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

https.createServer({ cert, ca, key },
  (req, res) => {
    if (req.headers.host === VIBER_CALLBACK_HOST) {
      viberCallback(req, res);
    } else {
      koaCallback(req, res);
    }
  }
).listen(HTTPS_PORT,
  () => {
    viber.bot.setWebhook(`https://${VIBER_CALLBACK_HOST}`);

    // раз в час пишем на диск все несохраненные данные
    setInterval(flushData, 60 * 60 * 1000);
  }
);


/**
 * При завершении работы сервера скидываем на диск все данные.
 */

process
  .on('exit', code => {
    flushData();
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
