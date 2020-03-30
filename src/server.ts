import Koa from "koa";
import bodyParser from 'koa-bodyparser';
import Router from 'koa-router';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { IAccountLink, DialogState, ICustomer, IEmployee, IAccDed, IPaySlip } from "./types";
import { FileDB } from "./util/fileDB";
import { upload } from "./util/upload";
import Viber from "./viber/viber";
import TelegramBot from "./telegram/telegram";

/**
 * Связь между ИД чата и человеком, сотрудником предприятия.
 */
export const accountLink = new FileDB<IAccountLink>(path.resolve(process.cwd(), 'data/accountlink.json'), {});
export const dialogStates = new FileDB<DialogState>(path.resolve(process.cwd(), 'data/dialogstates.json'), {});
export const customers = new FileDB<Omit<ICustomer, 'id'>>(path.resolve(process.cwd(), 'data/customers.json'), {});
export const employeesByCustomer: { [customerId: string]: FileDB<Omit<IEmployee, 'id'>> } = {};

/**
 * справочники начислений/удержаний для каждого клиента.
 * ключем объекта выступает РУИД записи из базы Гедымина.
 */
export const customerAccDeds: { [customerID: string]: FileDB<IAccDed> } = {};

/**
 * Расчетные листки для каждого клиента.
 * Ключем объекта выступает персональный номер из паспорта.
 */
export const paySlips: { [employeeId: string]: FileDB<IPaySlip> } = {};

let app = new Koa();
let router = new Router();

router.get('/load', (ctx, next) => {
  // ctx.router available
  load(ctx);
  next();
});

const load = (ctx: any) => {
  ctx.body = 'Hello World!';
}

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

const serverCallback = app.callback();


const server = http.createServer(serverCallback)

server.listen(3000, async () => {
  console.log(`>>> SERVER: Сервер запущен: https://localhost:3000`)
})

//https.createServer(config.https.options, serverCallback).listen(config.https.port);

if (typeof process.env.GDMN_BOT_TOKEN !== 'string') {
  throw new Error('GDMN_BOT_TOKEN env variable is not specified.');
}

const telegram = TelegramBot.init();
const viber = Viber.init();

/**
 * При завершении работы сервера скидываем на диск все данные.
 */
process.on('exit', code => {
  accountLink.flush();
  dialogStates.flush();
  customers.flush();

  for (const ec of Object.values(employeesByCustomer)) {
    ec.flush();
  }

  console.log('Process exit event with code: ', code);
});

process.on('SIGINT', () => process.exit() );

process
  .on('unhandledRejection', (reason, p) => {
    console.log({ err: reason }, `viber launch ${p}`);
  })
  .on('uncaughtException', err => {
    console.log({ err }, 'viber launch');
    process.exit(1);
  });

