import Koa from "koa";
import bodyParser from 'koa-bodyparser';
import Router from 'koa-router';
import http from 'http';
import https from 'https';
import path from 'path';
import { initCurrencies } from "./currency";
import * as fs from "fs";
import { Logger } from "./log";

// if not exists create configuration file using
// config.ts.sample as an example
import { config } from "./config";
import { Bot } from "./bot";

const logger = new Logger(config.logger);
const log = logger.getLogger();

/**
 * Подгружаем некоторые справочники.
 */

initCurrencies(log).then( () => log.info('Currencies have been loaded...') );

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
  log.warn('Viber bot token isn\'t specified.');
}

const bot = new Bot(
  config.telegram.token,
  path.resolve(process.cwd(), 'data/telegram'),
  config.viber.disabled ? '' : config.viber.token,
  path.resolve(process.cwd(), 'data/viber'),
  logger
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

//TODO: dangerous!
router.get('/zarobak/v1/shutdown_gdmn_bot_server', (ctx, next) => {
  ctx.status = 200;
  ctx.body = JSON.stringify({ status: 200, result: `ok` });
  log.info('Server shutting down...');
  bot.finalize();
  setTimeout( () => process.exit(), 100 );
  return next();
});

router.post('/zarobak/v1/upload_employees', (ctx, next) => {
  try {
    const { customerId, objData } = ctx.request.body;
    bot.uploadEmployees(customerId, objData);
    ctx.status = 200;
    ctx.body = JSON.stringify({ status: 200, result: `ok` });
  } catch(err) {
    log.error(`Error in employees uploading. ${err.message}`);
    ctx.status = 500;
    ctx.body = JSON.stringify({ status: 500, result: err.message });
  }
  return next();
});

router.post('/zarobak/v1/upload_accDedRefs', (ctx, next) => {
  try {
    const { customerId, objData } = ctx.request.body;
    bot.uploadAccDeds(customerId, objData);
    ctx.status = 200;
    ctx.body = JSON.stringify({ status: 200, result: `ok` });
  } catch(err) {
    log.error(`Error in accdedrefs uploading. ${err.message}`);
    ctx.status = 500;
    ctx.body = JSON.stringify({ status: 500, result: err.message });
  }
  return next();
});

// TODO: ид сотрудника, данные которого передаются, можно сразу включать в URI,
// например: /zarobak/v1/upload_paySlips?employeeId=445566
// тогда сразу будет видно на каком именно сотруднике произошла ошибка
router.post('/zarobak/v1/upload_paySlips', (ctx, next) => {
  try {
    const { customerId, objData, rewrite } = ctx.request.body;
    bot.upload_payslips(customerId, objData, rewrite);
    ctx.status = 200;
    ctx.body = JSON.stringify({ status: 200, result: `ok` });
  } catch(err) {
    log.error(`Error in payslips uploading. ${err.message}`);
    ctx.status = 500;
    ctx.body = JSON.stringify({ status: 500, result: err.message });
  }
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

const viberCallback = bot.viber?.middleware();

https.createServer({ cert, ca, key },
  (req, res) => {
    if (req.headers['x-viber-content-signature']) {
      viberCallback?.(req, res);
    } else {
      koaCallback(req, res);
    }
  }
).listen(config.httpsPort,
  async () => {
    if (config.viber.token && !config.viber.disabled) {
      const viberWebhook = `https://${config.viber.callbackHost}`;

      try {
        await bot.viber.setWebhook(viberWebhook);
        log.info(`Viber webhook set at ${viberWebhook}`);
      } catch(e) {
        log.error(`Error setting Viber webhook at ${viberWebhook}: ${e}`);
      }
    } else {
      log.warn('Viber bot isn\'t activated.')
    }

    // раз в час пишем на диск все несохраненные данные
    setInterval(() => bot.finalize(), 60 * 60 * 1000);
  }
);

bot.launch();

/**
 * При завершении работы сервера скидываем на диск все данные.
 */

process
  .on('exit', async (code) => {
    bot.finalize();
    await logger.info(undefined, undefined, `Process exit event with code: ${code}`);
    await logger.shutdown();
  })
  .on('SIGINT', () => process.exit(0))
  .on('unhandledRejection', (reason, p) => {
    console.error({ err: reason }, `bot launch ${p}`);
  })
  .on('uncaughtException', err => {
    console.error({ err }, 'bot launch');
    process.exit(2);
  });
