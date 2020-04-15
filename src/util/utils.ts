import { Lang, LName } from '../types';

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
