
/**
 * Загрузка сотрудников
 * @param ctx
 */
 /*
export const upload_employees = (ctx: any) => {
  try {
    const { customerId, objData } = ctx.request.body;
    const employee = new FileDB<Omit<IEmployee, 'id'>>(path.resolve(process.cwd(), `${payslipRoot}/${customerId}/${emploeeFileName}`), {});

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
*/


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
/*
export const upload_payslips = (ctx: any) => {
  interface IUploadPaySlipRequest {
    rewrite: boolean;
    customerId: string;
    objData: IPaySlip;
  };

  try {
    const { rewrite, customerId, objData } = ctx.request.body as IUploadPaySlipRequest;
    const employeeId = objData.emplId;
    const payslip = new FileDB<IPaySlip>(path.resolve(process.cwd(), `${payslipRoot}/${customerId}/${employeeId}.json`));

    if (rewrite) {
      payslip.clear();
    }

    const prevPayslipData = payslip.read(employeeId);

    // если на диске не было файла или там было пусто, то
    // просто запишем данные, которые пришли из интернета
    if (!prevPayslipData) {
      payslip.write(employeeId, objData);
    } else {
      // данные есть. надо объединить прибывшие данные с тем
      // что уже есть на диске
      const newPayslipData = {
        ...prevPayslipData,
        data: [...prevPayslipData.data],
        dept: [...prevPayslipData.dept],
        pos: [...prevPayslipData.pos],
        salary: [...prevPayslipData.salary]
      };

      // объединяем начисления
      for (const d of objData.data) {
        const i = newPayslipData.data.findIndex( a => a.typeId === d.typeId && a.db === d.db && a.de === d.de );
        if (i === -1) {
          newPayslipData.data.push(d);
        } else {
          newPayslipData.data[i] = d;
        }
      }

      // объединяем подразделения
      for (const d of objData.dept) {
        const i = newPayslipData.dept.findIndex( a => a.id === d.id && a.d === d.d );
        if (i === -1) {
          newPayslipData.dept.push(d);
        } else {
          newPayslipData.dept[i] = d;
        }
      }

      // объединяем должности
      for (const p of objData.pos) {
        const i = newPayslipData.pos.findIndex( a => a.id === p.id && a.d === p.d );
        if (i === -1) {
          newPayslipData.pos.push(p);
        } else {
          newPayslipData.pos[i] = p;
        }
      }

      // объединяем оклады
      for (const p of objData.salary) {
        const i = newPayslipData.salary.findIndex( a => a.d === p.d );
        if (i === -1) {
          newPayslipData.salary.push(p);
        } else {
          newPayslipData.salary[i] = p;
        }
      }

      payslip.write(employeeId, newPayslipData);
    }

    payslip.flush();

    ctx.status = 200;
    ctx.body = JSON.stringify({ status: 200, result: `ok` });
  } catch(err) {
    console.log(`Error in accdedrefs uploading. ${err.message}`);
    ctx.status = 500;
    ctx.body = JSON.stringify({ status: 500, result: err.message });
  }
};
*/