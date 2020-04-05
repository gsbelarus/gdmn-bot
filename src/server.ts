import Koa from "koa";
import bodyParser from 'koa-bodyparser';
import Router from 'koa-router';
import http from 'http';
import path from 'path';
import { ICustomer, IEmployee, IAccDed, IPaySlip, ICustomers, IEmploeeByCustomer } from "./types";
import { FileDB, IData } from "./util/fileDB";
import { upload } from "./util/upload";
import { TelegramBot } from "./telegram";

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

const getCustomers = (): ICustomers => {
  return customers.getMutable(false);
}

const getEmployeesByCustomer = (customerId: string): IEmploeeByCustomer => {
  let employees = employeesByCustomer[customerId];
  if (!employees) {
    employees = new FileDB<IEmployee>(path.resolve(process.cwd(), `data/employee.${customerId}.json`), {});
    employeesByCustomer[customerId] = employees;
  }
  return employees.getMutable(false);
}

const getPaySlipByUser = (customerId: string, userID: string, year: number): IData<IPaySlip> => {
  let paySlip = paySlips[userID + '_' + year];
  if (!paySlip) {
    paySlip = new FileDB<IPaySlip>(path.resolve(process.cwd(), `data/payslip.${customerId}/${year}/payslip.${customerId}.${userID}.${year}.json`), {});
    paySlips[userID + '_' + year] = paySlip;
  };
  return paySlip.getMutable(false);
}

const getAccDeds = (customerId: string): IData<IAccDed> => {
  let accDed = customerAccDeds[customerId];
  if (!accDed) {
    accDed = new FileDB<IAccDed>(path.resolve(process.cwd(), `data/payslip.${customerId}/accdedref.json`), {});
    customerAccDeds[customerId] = accDed;
  };
  return accDed.getMutable(false);
}

//const telegram = TelegramBot.init();
const telegram = new TelegramBot(
  process.env.GDMN_BOT_TOKEN,
  getCustomers,
  getEmployeesByCustomer,
  getAccDeds,
  getPaySlipByUser);

/**
 * При завершении работы сервера скидываем на диск все данные.
 */
process.on('exit', code => {
  customers.flush();

  for (const ec of Object.values(employeesByCustomer)) {
    ec.flush();
  }

  telegram.finalize();

  console.log('Process exit event with code: ', code);
});

process.on('SIGINT', () => process.exit());

process
  .on('unhandledRejection', (reason, p) => {
    console.log({ err: reason }, `bot launch ${p}`);
  })
  .on('uncaughtException', err => {
    console.log({ err }, 'bot launch');
    process.exit(1);
  });
