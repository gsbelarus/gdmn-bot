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
 * На каждого сотрудника мы заводим на диске отдельный файл, который хранит
 * json объект, внутри которого находится:
 * 1) массив истории изменения должностей
 * 2) массив истории подразделений
 * 3) массив начислений/удержаний
 *
 * Данные с диска загружаются по мере требования. Когда нам из чата приходит
 * команда показать расчетный листок, мы смотрим в объект paySlips по employeeId.
 * Если там нет записи, то создаем новый экземпляр FileDB и загружаем данные
 * с диска и помещаем в объект paySlips. Если есть -- берем данные.
 */
export const paySlips: { [employeeId: string]: FileDB<IPaySlip> } = {};


export const getCustomers = (): ICustomers => {
  return customers.getMutable(false);
}

export const getEmployeesByCustomer = (customerId: string): IEmploeeByCustomer => {
  let employees = employeesByCustomer[customerId];
  if (!employees) {
    employees = new FileDB<Omit<IEmployee, 'id'>>(path.resolve(process.cwd(), `data/payslip/${customerId}/employee.json`), {});
    employeesByCustomer[customerId] = employees;
  }
  return employees.getMutable(false);
}

export const getPaySlipByUser = (customerId: string, userID: string): IPaySlip | undefined => {
  let paySlip = paySlips[userID];
  if (!paySlip) {
    paySlip = new FileDB<IPaySlip>(path.resolve(process.cwd(), `data/payslip/${customerId}/${userID}.json`), {});
    paySlips[userID] = paySlip;
  };
  return paySlip.read(userID);
}

export const getAccDeds = (customerId: string): IData<IAccDed> => {
  let accDed = customerAccDeds[customerId];
  if (!accDed) {
    accDed = new FileDB<IAccDed>(path.resolve(process.cwd(), `data/payslip/${customerId}/accdedref.json`), {});
    customerAccDeds[customerId] = accDed;
  };
  return accDed.getMutable(false);
};

