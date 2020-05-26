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
import { Logger } from "./log";

// if not exists create configuration file using
// config.ts.sample as an example
import { config } from "./config";

const log = new Logger(config.logger);

/**
 * Port number our HTTP server is accessible at.
 */
const HTTP_PORT = 3000;

/**
 * Port number our HTTPS server is accessible at.
 */
const HTTPS_PORT = 8084; //443

/**
 * Host name for Viber callback.
 */
const ZAROBAK_VIBER_CALLBACK_HOST = process.env.ZAROBAK_VIBER_CALLBACK_HOST;

if (typeof ZAROBAK_VIBER_CALLBACK_HOST !== 'string' || !ZAROBAK_VIBER_CALLBACK_HOST) {
  throw new Error('ZAROBAK_VIBER_CALLBACK_HOST env variable is not specified.');
}

/**
 * Подгружаем некоторые справочники.
 */

initCurrencies().then( () => log.info('Currencies have been loaded...') );

/**
 * Создаем объекты наших ботов.
 * Телеграм сам как-то установит связь с внешним миром, через свои сервера
 * и сообщенный ему токен.
 * Вайбер надо связать с нашим веб сервером вручную.
 */

if (!config.telegram.token) {
  throw new Error('Telegram bot token isn\'t specified.');
}

const ZAROBAK_VIBER_BOT_TOKEN = process.env.ZAROBAK_VIBER_BOT_TOKEN;

if (typeof ZAROBAK_VIBER_BOT_TOKEN !== 'string' || !ZAROBAK_VIBER_BOT_TOKEN) {
  throw new Error('ZAROBAK_VIBER_BOT_TOKEN env variable is not specified.');
}

const telegram = new TelegramBot(
  config.telegram.token,
  getCustomers,
  getEmployeesByCustomer,
  getAccDeds,
  getPaySlipByUser);

const viber = new Viber(
  ZAROBAK_VIBER_BOT_TOKEN,
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

// TODO: ид сотрудника, данные которого передаются, можно сразу включать в URI,
// например: /zarobak/v1/upload_paySlips?employeeId=445566
// тогда сразу будет видно на каком именно сотруднике произошла ошибка
router.post('/zarobak/v1/upload_paySlips', (ctx, next) => {
  upload_paySlips(ctx);

  // TODO: Сделать, чтобы не просто надпись выводилась, а человек сразу получал в чат
  //       краткий расчетный листок.
  viber.showPaySlip(ctx.request.body.customerId, ctx.request.body.objData.emplId, 'Пришли новые данные!');
  telegram.showPaySlip(ctx.request.body.customerId, ctx.request.body.objData.emplId, 'Пришли новые данные!');

  return next();
});

app
  .use(bodyParser({
    jsonLimit: '20mb',
    textLimit: '20mb'
  }))
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

httpServer.listen(HTTP_PORT, () => log.info(`>>> SERVER: Сервер запущен: http://localhost:${HTTP_PORT}`) );

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
    if (req.headers['x-viber-content-signature']) {
      viberCallback(req, res);
    } else {
      koaCallback(req, res);
    }
  }
).listen(HTTPS_PORT,
  async () => {
    const viberWebhook = `https://${ZAROBAK_VIBER_CALLBACK_HOST}:${HTTPS_PORT}`;

    try {
      await viber.bot.setWebhook(viberWebhook);
      log.info(`Viber webhook set at ${viberWebhook}`)
    } catch(e) {
      log.error(`Error setting Viber webhook at ${viberWebhook}: ${e}`);
    }

    // раз в час пишем на диск все несохраненные данные
    setInterval(flushData, 60 * 60 * 1000);
  }
);


/**
 * При завершении работы сервера скидываем на диск все данные.
 */

process
  .on('exit', async (code) => {
    flushData();
    await log.info(`Process exit event with code: ${code}`);
    await log.shutdown();
  })
  .on('SIGINT', () => process.exit())
  .on('unhandledRejection', (reason, p) => {
    console.log({ err: reason }, `bot launch ${p}`);
  })
  .on('uncaughtException', err => {
    console.log({ err }, 'bot launch');
    process.exit(1);
  });
