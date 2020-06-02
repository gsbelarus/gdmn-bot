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

/*
function round(value: number, decimals: number) {
  let r = 0.5 * Number.EPSILON * value;
  let o = 1;
  while(decimals-- > 0) o *= 10;
  if(value < 0) o *= -1;
  return Math.round((value + r) * o) / o;
}
*/

/**
 * Преобразует дату в строку вида YYYY.MM.DD. или DD.MM.YYYY
 * @param date Дата.
 */
export const date2str = (date: Date, format: 'YYYY.MM.DD' | 'DD.MM.YYYY' | 'DD.MM.YY' = 'YYYY.MM.DD') =>
  format === 'YYYY.MM.DD'
    ? `${date.getFullYear()}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getDate().toString().padStart(2, '0')}`
    : format === 'DD.MM.YY'
    ? `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${(date.getFullYear() / 100).toFixed(0)}`
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

export const replaceIdentLetters = (s: string | undefined) => s && [...s.toUpperCase()].map( c => lmap[c] ?? c ).join('');

export const testIdentStr = (a: string, b: string) => replaceIdentLetters(a) === replaceIdentLetters(b);
