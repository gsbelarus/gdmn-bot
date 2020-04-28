import { FileDB } from "./fileDB";
import { IAccDed, IPaySlip, IEmployee } from "../types";
import path from 'path';
import { customerAccDeds, employeesByCustomer, paySlips } from "../data";

/**
 * Загрузка сотрудников
 * @param ctx
 */
export const upload_employees = (ctx: any) => {
  const { customerId, objData } = ctx.request.body;
  let employee = employeesByCustomer[customerId];

  if (!employee) {
    employee = new FileDB<Omit<IEmployee, 'id'>>(path.resolve(process.cwd(), `data/payslip/${customerId}/employee.json`), {});
    employeesByCustomer[customerId] = employee;
  }
  employee.clear();

  for (const [key, value] of Object.entries(objData)) {
    employee.write(key, value as any);
  }

  employee.flush();

  ctx.status = 200;
  ctx.body = JSON.stringify({ status: 200, result: `ok` });
}

/**
 * Загрузка Справочников видов начислений/удержаний
 * @param ctx
 */
export const upload_accDedRefs = (ctx: any) => {
  const { customerId, objData } = ctx.request.body;
  let customerAccDed = customerAccDeds[customerId];

  if (!customerAccDed) {
    customerAccDed = new FileDB<IAccDed>(path.resolve(process.cwd(), `data/payslip/${customerId}/accdedref.json`), {});
    customerAccDeds[customerId] = customerAccDed;
  }
  customerAccDed.clear();

  for (const [key, value] of Object.entries(objData)) {
    customerAccDed.write(key, value as any);
  }

  customerAccDed.flush();

  ctx.status = 200;
  ctx.body = JSON.stringify({ status: 200, result: `ok` });
}

/**
 * Загрузка расчетных листков
 * @param ctx
 */
export const upload_paySlips = (ctx: any) => {
  const { rewrite, customerId } = ctx.request.body;
  const objData: IPaySlip = ctx.request.body.objData;
  let paySlip: FileDB<IPaySlip>;

  const employeeId = objData.emplId;
  paySlip = paySlips[employeeId];

  if (!paySlip) {
    paySlip = new FileDB<IPaySlip>(path.resolve(process.cwd(), `data/payslip/${customerId}/${employeeId}.json`), {});
    paySlips[employeeId] = paySlip;
  }

  let newPaySlip: IPaySlip = objData;
  if (rewrite) {
    paySlip.clear();
  } else {
    const p = paySlip.getMutable(true)[employeeId];
    //сделать слияние
      }
  paySlip.write(employeeId, newPaySlip);

  paySlip.flush();

  ctx.status = 200;
  ctx.body = JSON.stringify({ status: 200, result: `ok` });
}