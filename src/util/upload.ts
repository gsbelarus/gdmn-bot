import { FileDB } from "./fileDB";
import { IAccDed, IPaySlip, IEmployee } from "../types";
import path from 'path';
import { customerAccDeds, employeesByCustomer, paySlips } from "../data";

export const upload = (ctx: any) => {
  const { dataType, customerId, objData } = ctx.request.body;
  switch (dataType) {
    //Если тип загружаемых данных - Справочники видов начислений/удержаний
    case 'accDedRef': {
      let customerAccDed = customerAccDeds[customerId];

      if (!customerAccDed) {
        customerAccDed = new FileDB<IAccDed>(path.resolve(process.cwd(), `data/payslip.${customerId}/accdedref.json`), {});
        customerAccDeds[customerId] = customerAccDed;
      }
      customerAccDed.clear();

      for (const [key, value] of Object.entries(objData)) {
        customerAccDed.write(key, value as any);
      }

      customerAccDed.flush();
      break;
    }
    //Если тип загружаемых данных - Сотрудники
    case 'employees': {
      let employee = employeesByCustomer[customerId];

      if (!employee) {
        employee = new FileDB<Omit<IEmployee, 'id'>>(path.resolve(process.cwd(), `data/employee.${customerId}.json`), {});
        employeesByCustomer[customerId] = employee;
      }
      employee.clear();

      for (const [key, value] of Object.entries(objData)) {
        employee.write(key, value as any);
      }

      employee.flush();
      break;
    }
    //Если тип загружаемых данных - Расчетные листки по сотрудникам в разрезе года
    case 'paySlip': {
      const { rewrite } = ctx.request.body;
      let paySlip: FileDB<IPaySlip>;
      for (const [key, value] of Object.entries(objData) as any) {
        const employeeId = value.employeeId;
        const year = value.year;

        paySlip = paySlips[employeeId + '_' + year];

        if (!paySlip || paySlip.getMutable(false).year !== year) {
          paySlip = new FileDB<IPaySlip>(path.resolve(process.cwd(), `data/payslip.${customerId}/${year}/payslip.${customerId}.${employeeId}.${year}.json`), {});
          paySlips[employeeId + '_' + year] = paySlip;
        }

        paySlip.clear();

        paySlip.write('employeeId', value.employeeId);
        paySlip.write('year', value.year);
        paySlip.write('deptName', value.deptName);
        paySlip.write('posName', value.posName);
        paySlip.write('hiringDate', value.hiringDate);
        paySlip.write('data', value.data);

        paySlip.flush();
      }
      break;
    }
  }
  ctx.status = 200;
  ctx.body = JSON.stringify({ status: 200, result: `ok` });
}