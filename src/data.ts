import { FileDB, IData } from "./util/fileDB";
import { ICustomer, IEmployee, IAccDed, IPaySlip, ICustomers, IEmploeeByCustomer } from "./types";
import path from 'path';

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


export const getCustomers = (): ICustomers => {
  return customers.getMutable(false);
}

export const getEmployeesByCustomer = (customerId: string): IEmploeeByCustomer => {
  let employees = employeesByCustomer[customerId];
  if (!employees) {
    employees = new FileDB<Omit<IEmployee, 'id'>>(path.resolve(process.cwd(), `data/employee.${customerId}.json`), {});
    employeesByCustomer[customerId] = employees;
  }
  return employees.getMutable(false);
}

export const getPaySlipByUser = (customerId: string, userID: string, year: number): IData<IPaySlip> => {
  let paySlip = paySlips[userID + '_' + year];
  if (!paySlip) {
    paySlip = new FileDB<IPaySlip>(path.resolve(process.cwd(), `data/payslip.${customerId}/${year}/payslip.${customerId}.${userID}.${year}.json`), {});
    paySlips[userID + '_' + year] = paySlip;
  };
  return paySlip.getMutable(false);
}

export const getAccDeds = (customerId: string): IData<IAccDed> => {
  let accDed = customerAccDeds[customerId];
  if (!accDed) {
    accDed = new FileDB<IAccDed>(path.resolve(process.cwd(), `data/payslip.${customerId}/accdedref.json`), {});
    customerAccDeds[customerId] = accDed;
  };
  return accDed.getMutable(false);
};

