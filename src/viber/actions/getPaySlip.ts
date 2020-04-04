// import { ITypePaySlip, IEmployee, IAccDed, IPaySlip, LName } from "../../types";
// import { accountLink, employeesByCustomer, customerAccDeds, paySlips } from "../../server";
// import { FileDB } from "../../util/fileDB";
// import path from 'path';
// import { getLanguage, getYears, getLName, getPaySlipString, getRateByCurrency, getCurrencyAbbreviationById } from "../../util/utils";
// import { keyboardMenu } from "../../telegram/util/keybord";
// const TextMessage = require('viber-bot').Message.Text;

// import { withMenu } from "../viber._ts";

// export const getPaySlip = (bot: any, response: any, typePaySlip: ITypePaySlip, db: Date, de: Date, toDb?: Date, toDe?: Date): string | undefined => {
//   if (bot.chat) {
//     const chatId = bot.chat.id.toString();
//     const link = accountLink.read(chatId);
//     if (link?.customerId && link.employeeId) {
//       const {customerId, employeeId, currencyId = 0} = link;
//       const rate = getRateByCurrency(db, currencyId);
//       const currencyAbbreviation = getCurrencyAbbreviationById(currencyId);

//       if (rate === -1) {
//         return (`${'`'}${'`'}${'`'}ini
// Повторите действие через несколько минут.
// Выполняется загрузка курсов валют...
//         ${'`'}${'`'}${'`'}`)
//       }

//       let empls = employeesByCustomer[customerId];
//       if (!empls) {
//         empls = new FileDB<IEmployee>(path.resolve(process.cwd(), `data/employee.${customerId}.json`), {});
//         employeesByCustomer[customerId] = empls;
//       };

//       const passportId = empls.getMutable(false)[employeeId].passportId;

//       if (passportId) {

//         let accDed = customerAccDeds[customerId];
//         if (!accDed) {
//           accDed = new FileDB<IAccDed>(path.resolve(process.cwd(), `data/payslip.${customerId}/accdedref.json`), {});
//           customerAccDeds[customerId] = accDed;
//         };
//         const accDedObj = accDed.getMutable(false);


//         const lng = getLanguage(bot.from?.language_code);

//         let allTaxes = [0, 0];

//         let accrual = [0, 0], salary = [0, 0], tax = [0, 0], ded = [0, 0], saldo = [0, 0],
//         incomeTax = [0, 0], pensionTax = [0, 0], tradeUnionTax = [0, 0], advance = [0, 0], tax_ded = [0, 0], privilage = [0, 0];

//         let strAccruals = '', strAdvances = '', strDeductions = '', strTaxes = '', strPrivilages = '', strTaxDeds = '';

//         let deptName = '';
//         let posName = '';
//         const dbMonthName = db.toLocaleDateString(lng, { month: 'long', year: 'numeric' });

//         /** Получить информацию по расчетным листкам за период*/
//         const getAccDedsByPeriod = (fromDb : Date, fromDe: Date, i: number) => {
//           const years = getYears(fromDb, fromDe);
//           //пробегаемся по всем годам
//           for (let y = 0; y < years.length; y++) {
//             const year = years[y];
//             let paySlip = paySlips[passportId + '_' + year];

//             if (!paySlip) {
//               paySlip = new FileDB<IPaySlip>(path.resolve(process.cwd(), `data/payslip.${customerId}/${year}/payslip.${customerId}.${passportId}.${year}.json`), {});
//               paySlips[passportId + '_' + year] = paySlip;
//             };

//             const paySlipObj = paySlip.getMutable(false);

//             if (Object.keys(paySlipObj).length === 0) {
//               withMenu(bot, response,
//                 `Нет расчетного листка за период ${fromDb.toLocaleDateString()} - ${fromDe.toLocaleDateString()}!`,
//                 keyboardMenu);
//             } else {

//               deptName = getLName(paySlipObj.deptName as LName, [lng, 'ru']);
//               posName = getLName(paySlipObj.posName as LName, [lng, 'ru']);

//               for (const [key, value] of Object.entries(paySlipObj.data) as any) {
//                 if (new Date(value?.dateBegin) >= fromDb && new Date(value?.dateEnd) <= fromDe || new Date(value?.date) >= fromDb && new Date(value?.date) <= fromDe) {
//                   if (value.typeId === 'saldo') {
//                     saldo[i] = saldo[i] + value.s;
//                   } else if (value.typeId === 'salary') {
//                     salary[i] = value.s;
//                   } else if (accDedObj[value.typeId]) {

//                     let accDedName = getLName(accDedObj[value.typeId].name, [lng, 'ru']) ;

//                     switch (accDedObj[value.typeId].type) {
//                       case 'INCOME_TAX': {
//                         incomeTax[i] = incomeTax[i] + value.s;
//                         strTaxes = typePaySlip === 'DETAIL' ? getPaySlipString(strTaxes, accDedName, value.s) : ''
//                         break;
//                       }
//                       case 'PENSION_TAX': {
//                         pensionTax[i] = pensionTax[i] + value.s;
//                         strTaxes = typePaySlip === 'DETAIL' ? getPaySlipString(strTaxes, accDedName, value.s) : ''
//                         break;
//                       }
//                       case 'TRADE_UNION_TAX': {
//                         tradeUnionTax[i] = tradeUnionTax[i] + value.s;
//                         strTaxes = typePaySlip === 'DETAIL' ? getPaySlipString(strTaxes, accDedName, value.s) : ''
//                         break;
//                       }
//                       case 'ADVANCE': {
//                         advance[i] = advance[i] + value.s;
//                         strAdvances = typePaySlip === 'DETAIL' ? getPaySlipString(strAdvances, accDedName, value.s) : ''
//                         break;
//                       }
//                       case 'DEDUCTION': {
//                         ded[i] = ded[i] + value.s;
//                         strDeductions = typePaySlip === 'DETAIL' ? getPaySlipString(strDeductions, accDedName, value.s) : ''
//                         break;
//                       }
//                       case 'TAX': {
//                         tax[i] = tax[i] + value.s;
//                         break;
//                       }
//                       case 'ACCRUAL': {
//                         accrual[i] = accrual[i] + value.s;
//                         strAccruals = typePaySlip === 'DETAIL' ? getPaySlipString(strAccruals, accDedName, value.s) : ''
//                         break;
//                       }
//                       case 'TAX_DEDUCTION': {
//                         tax_ded[i] = tax_ded[i] + value.s;
//                         strTaxDeds = typePaySlip === 'DETAIL' ? getPaySlipString(strTaxDeds, accDedName, value.s) : ''
//                         break;
//                       }
//                       case 'PRIVILAGE': {
//                         privilage[i] = privilage[i] + value.s;
//                         strPrivilages = typePaySlip === 'DETAIL' ? getPaySlipString(strPrivilages, accDedName, value.s) : ''
//                         break;
//                       }
//                     }
//                   }
//                 }
//               };

//               allTaxes[i] = getSumByRate(incomeTax[i], rate) + getSumByRate(pensionTax[i], rate) + getSumByRate(tradeUnionTax[i], rate);
//             }
//           }//for
//         };

//         //Данные по листку заносятся в массивы с индектом = 0
//         getAccDedsByPeriod(db, de, 0);
//         const lenS = 8;


//         switch (typePaySlip) {
//           case 'DETAIL': {
//             const len = 37;
//             return (`${'`'}${'`'}${'`'}ini
//     Расчетный листок ${dbMonthName}
//     ${'Начисления:'.padEnd(len)}  ${getSumByRate(accrual[0], rate).toFixed(2).padStart(lenS)}
//     ===============================================
//     ${strAccruals}
//     ===============================================
//     ${'Аванс:'.padEnd(len)}  ${getSumByRate(advance[0], rate).toFixed(2).padStart(lenS)}
//     ===============================================
//     ${strAdvances}
//     ===============================================
//     ${'Удержания:'.padEnd(len)}  ${getSumByRate(ded[0], rate).toFixed(2).padStart(lenS)}
//     ===============================================
//     ${strDeductions}
//     ===============================================
//     ${'Налоги:'.padEnd(len)}  ${allTaxes[0].toFixed(2).padStart(lenS)}
//     ===============================================
//     ${strTaxes}
//     ===============================================
//     ${'Вычеты:'.padEnd(len)}  ${getSumByRate(tax_ded[0], rate).toFixed(2).padStart(lenS)}
//     ===============================================
//     ${strTaxDeds}
//     ===============================================
//     ${'Льготы:'.padEnd(len)}  ${getSumByRate(privilage[0], rate).toFixed(2).padStart(lenS)}
//     ===============================================
//     ${strPrivilages}
//     ${'Информация:'.padEnd(len)}
//       ${deptName}
//       ${posName}
//     ${'Оклад:'.padEnd(len + 2)}  ${getSumByRate(salary[0], rate).toFixed(2).padStart(lenS)}
//     ${'Валюта:'.padEnd(len + 2)}  ${currencyAbbreviation.padStart(lenS)}
//  ${'`'}${'`'}${'`'}`)
//           }
//           case 'CONCISE': {
//             const len = 30;
//             const m = de.getFullYear() !== db.getFullYear() || de.getMonth() !== db.getMonth() ? `с ${db.toLocaleDateString()} по ${de.toLocaleDateString()}` : `${dbMonthName}`;
//             return (`${'`'}${'`'}${'`'}ini
//   Расчетный листок ${m}
//   ${'Начислено:'.padEnd(len + 2)}  ${getSumByRate(accrual[0], rate).toFixed(2).padStart(lenS)}
//   ==========================================
//   ${'Зарплата (чистыми):'.padEnd(len + 2)}  ${(getSumByRate(accrual[0], rate) - allTaxes[0]).toFixed(2).padStart(lenS)}
//     ${'Аванс:'.padEnd(len)}  ${getSumByRate(advance[0], rate).toFixed(2).padStart(lenS)}
//     ${'К выдаче:'.padEnd(len)}  ${getSumByRate(saldo[0], rate).toFixed(2).padStart(lenS)}
//     ${'Удержания:'.padEnd(len)}  ${getSumByRate(ded[0], rate).toFixed(2).padStart(lenS)}
//   ==========================================
//   ${'Налоги:'.padEnd(len + 2)}  ${allTaxes[0].toFixed(2).padStart(lenS)}
//     ${'Подоходный:'.padEnd(len)}  ${getSumByRate(incomeTax[0], rate).toFixed(2).padStart(lenS)}
//     ${'Пенсионный:'.padEnd(len)}  ${getSumByRate(pensionTax[0], rate).toFixed(2).padStart(lenS)}
//     ${'Профсоюзный:'.padEnd(len)}  ${getSumByRate(tradeUnionTax[0], rate).toFixed(2).padStart(lenS)}
//   ==========================================
//   ${'Информация:'.padEnd(len)}
//     ${deptName}
//     ${posName}
//   ${'Оклад:'.padEnd(len + 2)}  ${getSumByRate(salary[0], rate).toFixed(2).padStart(lenS)}
//   ${'Валюта:'.padEnd(len + 2)}  ${currencyAbbreviation.padStart(lenS)}
// ${'`'}${'`'}${'`'}`);
//           }
//           case 'COMPARE': {
//             if (toDb && toDe) {
//               const len = 23;
//               //Данные по листку за второй период заносятся в массивы с индектом = 1
//               getAccDedsByPeriod(toDb, toDe, 1);

//               return (`${'`'}${'`'}${'`'}ini
//   ${'Сравнение расчетных листков'.padEnd(len + 2)}
//   Период I:  ${db.toLocaleDateString()} - ${de.toLocaleDateString()}
//   Период II: ${toDb.toLocaleDateString()} - ${toDe.toLocaleDateString()}
//                                     I       II
//   ${'Начислено:'.padEnd(len + 2)}  ${getSumByRate(accrual[0], rate).toFixed(2).padStart(lenS)} ${getSumByRate(accrual[1], rate).toFixed(2).padStart(lenS)} ${(getSumByRate(accrual[1], rate) - getSumByRate(accrual[0], rate)).toFixed(2).padStart(lenS)}
//   =====================================================
//   ${'Зарплата (чистыми):'.padEnd(len + 2)}  ${(getSumByRate(accrual[0], rate) - allTaxes[0]).toFixed(2).padStart(lenS)} ${(getSumByRate(accrual[1], rate) - allTaxes[1]).toFixed(2).padStart(lenS)} ${(getSumByRate(accrual[1], rate) - allTaxes[1] - (getSumByRate(accrual[0], rate) - allTaxes[0])).toFixed(2).padStart(lenS)}
//     ${'Аванс:'.padEnd(len)}  ${getSumByRate(advance[0], rate).toFixed(2).padStart(lenS)} ${getSumByRate(advance[1], rate).toFixed(2).padStart(lenS)} ${(getSumByRate(advance[1], rate) - getSumByRate(advance[0], rate)).toFixed(2).padStart(lenS)}
//     ${'К выдаче:'.padEnd(len)}  ${getSumByRate(saldo[0], rate).toFixed(2).padStart(lenS)} ${getSumByRate(saldo[1], rate).toFixed(2).padStart(lenS)} ${(getSumByRate(saldo[1], rate) - getSumByRate(saldo[0], rate)).toFixed(2).padStart(lenS)}
//     ${'Удержания:'.padEnd(len)}  ${getSumByRate(ded[0], rate).toFixed(2).padStart(lenS)} ${getSumByRate(ded[1], rate).toFixed(2).padStart(lenS)} ${(getSumByRate(ded[1], rate) - getSumByRate(ded[0], rate)).toFixed(2).padStart(lenS)}
//   =====================================================
//   ${'Налоги:'.padEnd(len + 2)}  ${allTaxes[0].toFixed(2).padStart(lenS)} ${allTaxes[1].toFixed(2).padStart(lenS)} ${(allTaxes[1] - allTaxes[0]).toFixed(2).padStart(lenS)}
//     ${'Подоходный:'.padEnd(len)}  ${getSumByRate(incomeTax[0], rate).toFixed(2).padStart(lenS)} ${getSumByRate(incomeTax[1], rate).toFixed(2).padStart(lenS)} ${(getSumByRate(incomeTax[1], rate) - getSumByRate(incomeTax[0], rate)).toFixed(2).padStart(lenS)}
//     ${'Пенсионный:'.padEnd(len)}  ${getSumByRate(pensionTax[0], rate).toFixed(2).padStart(lenS)} ${getSumByRate(pensionTax[1], rate).toFixed(2).padStart(lenS)} ${(getSumByRate(pensionTax[1], rate) - getSumByRate(pensionTax[0], rate)).toFixed(2).padStart(lenS)}
//     ${'Профсоюзный:'.padEnd(len)}  ${getSumByRate(tradeUnionTax[0], rate).toFixed(2).padStart(lenS)} ${getSumByRate(getSumByRate(tradeUnionTax[1], rate), rate).toFixed(2).padStart(lenS)} ${(getSumByRate(getSumByRate(tradeUnionTax[1], rate), rate) - getSumByRate(tradeUnionTax[0], rate)).toFixed(2).padStart(lenS)}
//   =====================================================
//   ${'Информация:'.padEnd(len)}
//     ${'Оклад:'.padEnd(len)}  ${getSumByRate(salary[0], rate).toFixed(2).padStart(lenS)} ${getSumByRate(salary[1], rate).toFixed(2).padStart(lenS)} ${(getSumByRate(salary[1], rate) - getSumByRate(salary[0], rate)).toFixed(2).padStart(lenS)}
//     ${'Валюта:'.padEnd(len + 2)}${currencyAbbreviation.padStart(lenS)}
//   ${'`'}${'`'}${'`'}`);
//             }
//           }
//         }
//       }
//     }
//   }

//   return undefined
// }

// export const getSumByRate = (s: number, rate: number) => {
//   return round(s/rate, 2)
// }

// function round(value: number, decimals: number) {
//   let r = 0.5 * Number.EPSILON * value;
//   let o = 1;
//   while(decimals-- > 0) o *= 10;
//   if(value < 0) o *= -1;
//   return Math.round((value + r) * o) / o;
// }

// const cListok =
// `${'`'}${'`'}${'`'}ini
// Начислено:           726.87
// ===========================
// Зарплата (чистыми):  617.84
//   К выдаче:          502.12
//   Удержания:         115.72
// ===========================
// Налоги:              109.03
//   Подоходный:         94.49
//   Пенсионный:          7.27
//   Профсоюзный:         7.27
// ===========================
// Информация:
//   Участок глубокой печати моф (угп моф)
//   Клеевар
//   Оклад:             450.24
// ${'`'}${'`'}${'`'}`;