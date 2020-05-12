import { FileDB } from "./fileDB";
import { IAccDed, IPaySlip, IEmployee, IDepartment, IAccDeds } from "../types";
import path from 'path';
import { customerAccDeds, employeesByCustomer, paySlips, getAccDeds, paySlipRoot, emploeeFileName, accDedRefFileName } from "../data";

/**
 * Загрузка сотрудников
 * @param ctx
 */
export const upload_employees = (ctx: any) => {
  const { customerId, objData } = ctx.request.body;
  let employee = employeesByCustomer[customerId];

  if (!employee) {
    employee = new FileDB<Omit<IEmployee, 'id'>>(path.resolve(process.cwd(), `${paySlipRoot}/${customerId}/${emploeeFileName}`), {});
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
    customerAccDed = new FileDB<IAccDed>(path.resolve(process.cwd(), `${paySlipRoot}/${customerId}/${accDedRefFileName}`), {});
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

interface IUploadPaySlipRequest {
  rewrite: boolean;
  customerId: string;
  objData: IPaySlip;
};

/*

 FileDB делался для работы со множеством записей, у каждой из которых
 свой уникальный ключ. Сейчас мы перестроили схему хранения так, что данные по
 одному сотруднику хранятся в одном файле. Т.е. если мы будем использовать
 для доступа по прежнему FileDB, то в структуре будет только одна запись.
 в качестве ключа можно выбрать employeeID.

*/


/**
 * Загрузка расчетных листков
 * @param ctx
 */
export const upload_paySlips = (ctx: any) => {
  const { rewrite, customerId, objData } = ctx.request.body as IUploadPaySlipRequest;

  const employeeId = objData.emplId;

  // has pay slips for the employee been loaded already?
  let paySlip = paySlips[employeeId];

  if (!paySlip) {
    // no, let's try load them from the disk
    // TODO: extract path into constant
    paySlip = new FileDB<IPaySlip>(path.resolve(process.cwd(), `${paySlipRoot}/${customerId}/${employeeId}.json`));
    paySlips[employeeId] = paySlip;
  }

  if (rewrite) {
    paySlip.clear();
  }

  const paySlipData = paySlip.read(employeeId);

  // если на диске не было файла или там было пусто, то
  // просто запишем данные, которые пришли из интернета
  if (!paySlipData) {
    paySlip.write(employeeId, objData);
  } else {
    // данные есть. надо объединить прибывшие данные с тем
    // что уже есть на диске

    // объединяем начисления
    for (const d of objData.data) {
      const i = paySlipData.data.findIndex( a => a.typeId === d.typeId && a.db === d.db && a.de === d.de );
      if (i === -1) {
        paySlipData.data.push(d);
      } else {
        paySlipData.data[i] = d;
      }
    }

    // объединяем подразделения
    for (const d of objData.dept) {
      const i = paySlipData.dept.findIndex( a => a.id === d.id && a.d === d.d );
      if (i === -1) {
        paySlipData.dept.push(d);
      } else {
        paySlipData.dept[i] = d;
      }
    }

    // объединяем должности
    for (const p of objData.pos) {
      const i = paySlipData.pos.findIndex( a => a.id === p.id && a.d === p.d );
      if (i === -1) {
        paySlipData.pos.push(p);
      } else {
        paySlipData.pos[i] = p;
      }
    }

    // объединяем оклады
    for (const p of objData.salary) {
      const i = paySlipData.salary.findIndex( a => a.d === p.d );
      if (i === -1) {
        paySlipData.salary.push(p);
      } else {
        paySlipData.salary[i] = p;
      }
    }

    paySlip.write(employeeId, paySlipData);
  }

  paySlip.flush();

  ctx.status = 200;
  ctx.body = JSON.stringify({ status: 200, result: `ok` });
}