import { promises } from 'fs';
//import log4js from 'log4js';
import path from "path";
import { Lang, LName } from './types';
/**
 * Удаляет из строки кавычки, двойные пробелы и т.п.
 * Приводит к нижнему регистру.
 * @param s Входящая строка
 */
export const normalizeStr = (s?: string) => s && s.trim()
  .toLowerCase()
  .split('')
  .filter( c => c !== '"' && c !== "'" && c !== '`' && c !== '\n' && c !== '\t')
  .join('')
  .split(' ')
  .filter( ss => ss.trim() )
  .filter( ss => ss !== 'ооо' && ss !== 'оао' )
  .join(' ');

  export const readFile = async (filename: string) => {
    try {
      const result = await promises.readFile(filename, { encoding: 'utf8', flag: 'r' });
      const data = JSON.parse(result);
     // logger.info(`Successful reading: ${filename}`);
      if(Array.isArray(data) && data.length) {
        return data;
      } else {
        return data;
      }
    }
    catch (e) {
     // logger.trace(`Error reading data to file ${filename} - ${e}`);
      console.log(`Error reading data to file ${filename} - ${e}`);
      return undefined;
    }
  }

  export const writeFile = async (filename: string, data: string) => {
    try {
      await promises.mkdir(path.dirname(filename), { recursive: true });
      await promises.writeFile(filename, data, { encoding: 'utf8', flag: 'w' });
     // logger.info(`Successful writing: ${filename}`);
    }
    catch (e) {
     // logger.trace(`Error writing data to file ${filename} - ${e}`);
      console.log(`Error writing data to file ${filename} - ${e}`);
    }
  }

export function getLName(n: LName, langPref: Lang[] = [], getFullName: boolean = false): string {
  for (let i = 0; i < langPref.length; i++) {
    const tn = n[langPref[i]];
    if (tn) {
      return (getFullName && tn.fullName) ? tn.fullName : tn.name;
    }
  }

  if (!n.en) return '';

  return (getFullName && n.en.fullName) ? n.en.fullName : n.en.name;
};

export const getLanguage = (lang_code?: string): Lang => {
    if (!lang_code) {
      return 'ru'
    }
    if (lang_code.indexOf('-')) {
      lang_code = lang_code.split('-')[0]
    }
    if (lang_code === 'ru') {
      return 'ru'
    } else if (lang_code === 'by') {
        return 'by'
      } else {
      return 'en'
    }
}

export const getPaySlipString = (prevStr: string, name: string, s: number): string => {
  let name_1 = '';
  const len = 36;
  if (name.length > len) {
    name_1 = name.length > len ? name.slice(0, len) : name;
    name = name.slice(len).padEnd(len);
    return `${prevStr}${prevStr !== '' ? '\r\n    ' : ''}  ${name_1} \r\n      ${name} ${s.toFixed(2).padStart(8)}`;
  } else {
    return `${prevStr}${prevStr !== '' ? '\r\n    ' : ''}  ${name.padEnd(len)} ${s.toFixed(2).padStart(8)}`;
  }

}



