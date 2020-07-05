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
  config.viber.disabled ? '' : config.viber.token,
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
  ctx.response.body = 'Zarobak Telegram/Viber Bot. Copyright (c) 2020 by Golden Software of Belarus, Ltd';
  next();
});

//TODO: dangerous!
router.get('/zarobak/v1/shutdown_gdmn_bot_server', (ctx, next) => {
  ctx.status = 200;
  ctx.body = JSON.stringify({ status: 200, result: `ok` });
  shutdown('Server shutting down...')
    .then( () => setTimeout( () => process.exit(), 100 ) );
  next();
});

router.post('/zarobak/v1/upload_employees', (ctx, next) => {
  try {
    const { customerId, objData } = ctx.request.body;
    bot.uploadEmployees(customerId, objData);
    ctx.response.status = 200;
    ctx.response.body = JSON.stringify({ status: 200, result: `ok` });
  } catch(err) {
    log.error(`Error in employees uploading. ${err.message}`);
    ctx.response.status = 500;
    ctx.response.body = JSON.stringify({ status: 500, result: err.message });
  }
  next();
});

router.post('/zarobak/v1/upload_accDedRefs', async (ctx) => {
  try {
    const { customerId, objData } = ctx.request.body;
    bot.uploadAccDeds(customerId, objData);
    ctx.response.status = 200;
    ctx.response.body = JSON.stringify({ status: 200, result: `ok` });
  } catch(err) {
    log.error(`Error in accdedrefs uploading. ${err.message}`);
    ctx.response.status = 500;
    ctx.response.body = JSON.stringify({ status: 500, result: err.message });
  }
});

router.post('/zarobak/v1/upload_paySlips', (ctx, next) => {
  try {
    const { customerId, objData, rewrite } = ctx.request.body;
    bot.upload_payslips(customerId, objData, rewrite);
    //TODO: отключаем рассылку. может она подвешивает сервер
    //await bot.sendLatestPayslip(customerId, objData.emplId);
    ctx.response.status = 200;
    ctx.response.body = JSON.stringify({ status: 200, result: `ok` });
  } catch(err) {
    log.error(`Error in payslips uploading. ${err.message}`);
    ctx.response.status = 500;
    ctx.response.body = JSON.stringify({ status: 500, result: err.message });
  }
  next();
});

router.post('/zarobak/v2/upload_timeSheets', (ctx, next) => {
  try {
    const { customerId, objData, rewrite } = ctx.request.body;
    bot.upload_timeSheets(customerId, objData, rewrite);
    ctx.response.status = 200;
    ctx.response.body = JSON.stringify({ status: 200, result: `ok` });
  } catch(err) {
    log.error(`Error in timesheets uploading. ${err.message}`);
    ctx.response.status = 500;
    ctx.response.body = JSON.stringify({ status: 500, result: err.message });
  }
  next();
});

app.on('error', (err, ctx) => log.error('koa server error', err, ctx) );

app
  .use(bodyParser({
    jsonLimit: '40mb',
    textLimit: '40mb'
  }))
  .use(router.routes())
  .use(router.allowedMethods());

const koaCallback = app.callback();

const httpServer = http.createServer(koaCallback);

httpServer.listen(config.httpPort, () => log.info(`>>> HTTP server is running at http://localhost:${config.httpPort}`) );

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

if (!ca) {
  throw new Error('No CA file or file is invalid');
}

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

    log.info(`>>> HTTPS server is running at https://localhost:${config.httpsPort}`)

    // раз в час пишем на диск все несохраненные данные
    setInterval(() => bot.finalize(), 60 * 60 * 1000);
  }
);

if (config.telegram.useWebHook) {
  const { callbackHost, hookPath, port } = config.telegram;
  bot.launchTelegram(callbackHost, hookPath, port, { key, cert, ca });
} else {
  bot.launchTelegram();
}

/**
 * При завершении работы сервера скидываем на диск все данные.
 */

const shutdown = async (msg: string) => {
  bot.finalize();
  await logger.info(undefined, undefined, msg);
  await logger.shutdown();
};

process
  .on('exit', code => console.log(`Process exit event with code: ${code}`) )
  .on('SIGINT', async () => {
    await shutdown('SIGINT received...');
    process.exit();
  })
  .on('SIGTERM', async () => {
    await shutdown('SIGINT received...');
    process.exit();
  })
  .on('unhandledRejection', (reason, p) => console.error({ err: reason }, p) )
  .on('uncaughtException', err => console.error(err) );
