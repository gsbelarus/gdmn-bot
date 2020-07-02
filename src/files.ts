import path from 'path';
import { Platform } from './types';

export const getAccountLinkFN = (platform: Platform) => platform === 'TELEGRAM'
  ? path.resolve(process.cwd(), 'data/telegram/accountlink.json')
  : path.resolve(process.cwd(), 'data/viber/accountlink.json');
export const getCurrenciesFN = () => path.resolve(process.cwd(), `data/nbrbcurrencies.json`);
export const getRatesFN = () => path.resolve(process.cwd(), `data/nbrbrates.json`);
export const getAnnouncementsFN = () => path.resolve(process.cwd(), `data/announcements.json`);
export const getCustomersFN = () => path.resolve(process.cwd(), 'data/customers.json');
export const getPayslipFN = (customerId: string, employeeId: string) => path.resolve(process.cwd(), `data/payslip/${customerId}/${employeeId}.json`);
export const getAccDedFN = (customerId: string) => path.resolve(process.cwd(), `data/payslip/${customerId}/accdedref.json`);
export const getEmployeeFN = (customerId: string) => path.resolve(process.cwd(), `data/payslip/${customerId}/employee.json`);
export const getTimeSheetFN = (customerId: string, employeeId: string) => path.resolve(process.cwd(), `data/timesheet/${customerId}/${employeeId}.json`);
export const getDepartmentFN = (customerId: string) => path.resolve(process.cwd(), `data/timesheet/${customerId}/departments.json`);
export const getScheduleFN = (customerId: string) => path.resolve(process.cwd(), `data/timesheet/${customerId}/schedules.json`);

/*
export const DATA_ROOT = `data/`;
export const customersFile = `${DATA_ROOT}customers.json`;
export const payslipRoot = `${DATA_ROOT}/payslip`;
export const employeeFileName = 'employee.json';
export const accDedRefFileName = 'accdedref.json';
*/
