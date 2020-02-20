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
