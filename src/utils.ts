import { promises } from 'fs';
//import log4js from 'log4js';
import path from "path";
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

