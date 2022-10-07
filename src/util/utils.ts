import { IDate } from "../types";

/**
 * эти слова просто выкидываем из текста.
 */
const wordsToIgnore = 'ооо,иооо,одо,оао,зао,таа,ітаа,ада,зат,аат,ип,іп,уп,куп,упп,г'.split(',');

/**
 * alias организаций, которые не должны попадать в список организаций в подсказке
 */
export const companyToIgnore = 'test,ampersant,gs'.split(',');

/**
 * эти символы заменяем на пробелы
 */
const charsToIgnore = '.,"\'`:\n\t«»#'.split('');

/**
 * Удаляет из строки кавычки, двойные пробелы и т.п.
 * Приводит к нижнему регистру.
 * @param s Входящая строка
 */
export const normalizeStr = (s?: string) => s && s.trim()
  .toLowerCase()
  .split('')
  .filter( c => c !== '-' )
  .map( c => charsToIgnore.includes(c)
    ? ' '
    : c === 'ё'
    ? 'е'
    : c
  )
  .join('')
  .split(' ')
  .map( ss => ss.trim() )
  .filter( ss => ss && !wordsToIgnore.includes(ss) )
  .join(' ');

export const testNormalizeStr = (a: string, b: string) => normalizeStr(a) === normalizeStr(b);

/**
 * Преобразует дату в строку вида YYYY.MM.DD. или DD.MM.YYYY
 * @param date Дата.
 */
export const date2str = (date: Date, format: 'YYYY.MM.DD' | 'DD.MM.YYYY' | 'DD.MM.YY' = 'YYYY.MM.DD') =>
  format === 'YYYY.MM.DD'
    ? `${date.getFullYear()}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getDate().toString().padStart(2, '0')}`
    : format === 'DD.MM.YY'
    ? `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear().toString().slice(-2)}`
    : `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;

const lmap: { [letter: string]: string } = {
  'А': 'A',
  'В': 'B',
  'Е': 'E',
  'К': 'K',
  'М': 'M',
  'Н': 'H',
  'О': 'O',
  'Р': 'P',
  'С': 'C',
  'Т': 'T',
  'Х': 'X'
};

const replaceIdentLetters = (s: string | undefined) => s && [...s.toUpperCase()].map( c => lmap[c] ?? c ).join('');

export const testIdentStr = (a: string, b: string) => replaceIdentLetters(a) === replaceIdentLetters(b);

export const str2Date = (date: Date | string) => {
  if (typeof date === 'string') {
    const [y, m, d] = date.split('.').map( s => Number(s) );
    if (y && m && d) {
      return new Date(y, m - 1, d);
    } else {
      throw new Error(`Invalid date format ${date}`)
    }
  } else {
    return date;
  }
};

/**
 * Возвращает true, если d1 больше либо равна d2.
 * @param d1
 * @param d2
 */
export const isIDateGrOrEq = (d1: IDate, d2: IDate) =>
  (d1.year > d2.year)
  ||
  (d1.year === d2.year && d1.month >= d2.month);

export const isEq = (d1: Date | string, d2: Date | string) => {
  if (typeof d1 === 'string' && typeof d2 === 'string') {
    return d1 === d2;
  }
  else if (d1 instanceof Date && d2 instanceof Date) {
    return d1.getTime() === d2.getTime();
  } else {
    throw new Error('Invalid date params');
  }
};

/**
 * Возвращает true, если d1 больше d2.
 * @param d1
 * @param d2
 */
export const isGr = (d1: Date, d2: Date) => {
  return d1.getTime() > d2.getTime();
};

export const isLs = (d1: Date, d2: Date) => {
  return d1.getTime() < d2.getTime();
};

export const isGrOrEq = (d1: Date, d2: Date) => {
  return d1.getTime() >= d2.getTime();
};

export const pause = (ms: number) => new Promise( resolve => setTimeout( resolve, ms ));

export const validURL = (str: string) => {
  return /^(?:(?:(?:https?|ftp):)?\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:[/?#]\S*)?$/i.test(str);
};

export const format2 = new Intl.NumberFormat('en-US', { style: 'decimal', useGrouping: true, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format;
export const format = new Intl.NumberFormat('en-US', { style: 'decimal', useGrouping: true, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format;