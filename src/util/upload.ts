import { FileDB } from "./fileDB";
import { IAccDed, IPaySlip, IEmployee, IDepartment, IAccDeds } from "../types";
import path from 'path';
import { customerAccDeds, employeesByCustomer, payslips, getAccDeds, payslipRoot, emploeeFileName, accDedRefFileName } from "../data";

/**
 * Загрузка сотрудников
 * @param ctx
 */
export const upload_employees = (ctx: any) => {
  try {
    const { customerId, objData } = ctx.request.body;
    let employee = employeesByCustomer[customerId];

    if (!employee) {
      employee = new FileDB<Omit<IEmployee, 'id'>>(path.resolve(process.cwd(), `${payslipRoot}/${customerId}/${emploeeFileName}`), {});
      employeesByCustomer[customerId] = employee;
    }
    employee.clear();

    for (const [key, value] of Object.entries(objData)) {
      employee.write(key, value as any);
    }

    employee.flush();

    ctx.status = 200;
    ctx.body = JSON.stringify({ status: 200, result: `ok` });
  } catch(err) {
    console.log(`Error in employees uploading. ${err.message}`);
    ctx.status = 500;
    ctx.body = JSON.stringify({ status: 500, result: err.message });
  }
}

/**
 * Загрузка Справочников видов начислений/удержаний
 * @param ctx
 */
export const upload_accDedRefs = (ctx: any) => {
  try {
    const { customerId, objData } = ctx.request.body;
    let customerAccDed = customerAccDeds[customerId];

    if (!customerAccDed) {
      customerAccDed = new FileDB<IAccDed>(path.resolve(process.cwd(), `${payslipRoot}/${customerId}/${accDedRefFileName}`), {});
      customerAccDeds[customerId] = customerAccDed;
    }

    customerAccDed.clear();

    for (const [key, value] of Object.entries(objData)) {
      customerAccDed.write(key, value as any);
    }

    customerAccDed.flush();

    ctx.status = 200;
    ctx.body = JSON.stringify({ status: 200, result: `ok` });
  } catch(err) {
    console.log(`Error in accdedrefs uploading. ${err.message}`);
    ctx.status = 500;
    ctx.body = JSON.stringify({ status: 500, result: err.message });
  }
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
export const upload_payslips = (ctx: any) => {
  try {
    const { rewrite, customerId, objData } = ctx.request.body as IUploadPaySlipRequest;

    const employeeId = objData.emplId;

    // has pay slips for the employee been loaded already?
    let payslip = payslips[employeeId];

    if (!payslip) {
      // no, let's try load them from the disk
      // TODO: extract path into constant
      payslip = new FileDB<IPaySlip>(path.resolve(process.cwd(), `${payslipRoot}/${customerId}/${employeeId}.json`));
      payslips[employeeId] = payslip;
    }

    if (rewrite) {
      payslip.clear();
    }

    const payslipData = payslip.read(employeeId);

    // если на диске не было файла или там было пусто, то
    // просто запишем данные, которые пришли из интернета
    if (!payslipData) {
      payslip.write(employeeId, objData);
    } else {
      // данные есть. надо объединить прибывшие данные с тем
      // что уже есть на диске

      // объединяем начисления
      for (const d of objData.data) {
        const i = payslipData.data.findIndex( a => a.typeId === d.typeId && a.db === d.db && a.de === d.de );
        if (i === -1) {
          payslipData.data.push(d);
        } else {
          payslipData.data[i] = d;
        }
      }

      // объединяем подразделения
      for (const d of objData.dept) {
        const i = payslipData.dept.findIndex( a => a.id === d.id && a.d === d.d );
        if (i === -1) {
          payslipData.dept.push(d);
        } else {
          payslipData.dept[i] = d;
        }
      }

      // объединяем должности
      for (const p of objData.pos) {
        const i = payslipData.pos.findIndex( a => a.id === p.id && a.d === p.d );
        if (i === -1) {
          payslipData.pos.push(p);
        } else {
          payslipData.pos[i] = p;
        }
      }

      // объединяем оклады
      for (const p of objData.salary) {
        const i = payslipData.salary.findIndex( a => a.d === p.d );
        if (i === -1) {
          payslipData.salary.push(p);
        } else {
          payslipData.salary[i] = p;
        }
      }

      payslip.write(employeeId, payslipData);
    }

    payslip.flush();

    ctx.status = 200;
    ctx.body = JSON.stringify({ status: 200, result: `ok` });
  } catch(err) {
    console.log(`Error in accdedrefs uploading. ${err.message}`);
    ctx.status = 500;
    ctx.body = JSON.stringify({ status: 500, result: err.message });
  }
}