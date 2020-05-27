import Koa from "koa";
import bodyParser from 'koa-bodyparser';
import Router from 'koa-router';
import http from 'http';
import https from 'https';
import path from 'path';
import { upload_employees, upload_accDedRefs, upload_payslips } from "./util/upload";
import { initCurrencies } from "./currency";
import * as fs from "fs";
import { customers, employeesByCustomer } from "./data";
import { Logger } from "./log";

// if not exists create configuration file using
// config.ts.sample as an example
import { config } from "./config";
import { Bot } from "./bot";

const log = new Logger(config.logger);

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

if (!config.viber.token) {
  throw new Error('Viber bot token isn\'t specified.');
}

/*
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
*/

const bot = new Bot(
  config.telegram.token,
  path.resolve(process.cwd(), 'data/telegram'),
  path.resolve(process.cwd(), 'data/viber')
);

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
  upload_payslips(ctx);

  // TODO: Сделать, чтобы не просто надпись выводилась, а человек сразу получал в чат
  //       краткий расчетный листок.
  /*
  viber.showPaySlip(ctx.request.body.customerId, ctx.request.body.objData.emplId, 'Пришли новые данные!');
  telegram.showPaySlip(ctx.request.body.customerId, ctx.request.body.objData.emplId, 'Пришли новые данные!');
  */

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
  /*
  telegram.finalize();
  viber.finalize();
  */

  bot.finalize();
};


// TODO: Если у нас получится грузить из Гедымина по протоколу HTTPS, то HTTP сервер мы вообще уберем из программы.

const httpServer = http.createServer(koaCallback);

httpServer.listen(config.httpPort, () => log.info(`>>> SERVER: Сервер запущен: http://localhost:${config.httpPort}`) );

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

/*
const viberCallback = viber.bot.middleware();
*/

https.createServer({ cert, ca, key },
  (req, res) => {
    if (req.headers['x-viber-content-signature']) {
      /*
      viberCallback(req, res);
      */
    } else {
      koaCallback(req, res);
    }
  }
).listen(config.httpsPort,
  async () => {
    const viberWebhook = `https://${config.viber.callbackHost}`;

    try {
      /*
      await viber.bot.setWebhook(viberWebhook);
      log.info(`Viber webhook set at ${viberWebhook}`)
      */
    } catch(e) {
      log.error(`Error setting Viber webhook at ${viberWebhook}: ${e}`);
    }

    // раз в час пишем на диск все несохраненные данные
    setInterval(flushData, 60 * 60 * 1000);
  }
);

bot.launch();

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
