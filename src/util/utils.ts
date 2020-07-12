/**
 * эти слова просто выкидываем из текста.
 */
const wordsToIgnore = 'ооо,оао,зао,таа,зат,аат,ип,іп,уп,куп,упп,г'.split(',');

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
  const pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
    '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
    '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
    '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
  return !!pattern.test(str);
};