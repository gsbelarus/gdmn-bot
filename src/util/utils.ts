import { Lang, LName } from '../types';

const toIgnore = 'ооо,оао,зао,таа,зат,аат,ип,іп,уп,куп'.split(',');

/**
 * Удаляет из строки кавычки, двойные пробелы и т.п.
 * Приводит к нижнему регистру.
 * @param s Входящая строка
 */
export const normalizeStr = (s?: string) => s && s.trim()
  .toLowerCase()
  .split('')
  .filter( c => c !== '"' && c !== "'" && c !== '`' && c !== '-' && c !== '\n' && c !== '\t' )
  .join('')
  .split(' ')
  .map( ss => ss.trim() )
  .filter( ss => ss && !toIgnore.find( ig => ig === ss ) )
  .join(' ');

export const testNormalizeStr = (a: string, b: string) => normalizeStr(a) === normalizeStr(b);

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

/**
 * Формат кода языка
 * @param lang_code
 */
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

/** Возвращает массив лет за период*/
export function getYears(fromDate: Date, toDate: Date): number[] {
  let years = [];
  let fromYear = fromDate.getFullYear();
  let toYear = toDate.getFullYear();
  while (fromYear <= toYear) {
    years.push(fromYear);
    fromYear = fromYear + 1;
  }
  return years;
};

export const getSumByRate = (s: number, rate: number) => {
  return round(s/rate, 2)
}

function round(value: number, decimals: number) {
  let r = 0.5 * Number.EPSILON * value;
  let o = 1;
  while(decimals-- > 0) o *= 10;
  if(value < 0) o *= -1;
  return Math.round((value + r) * o) / o;
}

/**
 * Преобразует дату в строку вида YYYY.MM.DD. или DD.MM.YYYY
 * @param date Дата.
 */
export const date2str = (date: Date, yearFirst = false) =>
  yearFirst
    ? `${date.getFullYear()}.${('00' + (date.getMonth() + 1).toString()).slice(-2)}.${('00' + date.getDate().toString()).slice(-2)}`
    : `${('00' + date.getDate().toString()).slice(-2)}.${('00' + (date.getMonth() + 1).toString()).slice(-2)}.${date.getFullYear()}`;


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

export const replaceIdentLetters = (s: string | undefined) => s && [...s.toUpperCase()].map( c => lmap[c] ?? c ).join('');

export const testIdentStr = (a: string, b: string) => replaceIdentLetters(a) === replaceIdentLetters(b);
