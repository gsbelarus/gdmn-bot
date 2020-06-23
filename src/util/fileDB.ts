import fs from 'fs';
import path from 'path';
import { ILogger } from '../log';

export interface IData<T> {
  [key: string]: T;
};

interface IDataEnvelope<T> {
  version: string;
  data: IData<T>;
};

export class FileDB<T extends Object> {
  private _data: IData<T> | undefined;
  private _fn: string;
  private _modified: boolean = false;
  private _initData: IData<T>;
  private _restore?: (data: IData<T>) => IData<T>;
  private _check?: (data: IData<T>) => boolean;
  private _ignore?: boolean;
  private _logger: ILogger;

  /**
   * Конструктор.
   * @param fn Имя файла с данными.
   * @param initData Начальные данные, если файла нет или в нем данные неверного формата.
   * @param check Функция для проверки считанных из файла данных на корректность.
   * @param ignore Если true, то при наличии в файле некорректных данных не будет выдаваться сообщение об ошибке.
   */
  constructor (fn: string, logger?: ILogger, initData: IData<T> = {}, restore?: (data: IData<T>) => IData<T>,
    check?: (data: IData<T>) => boolean, ignore?: boolean)
  {
    this._fn = fn;
    this._initData = initData;
    this._check = check;
    this._ignore = ignore;
    this._logger = logger ?? console;
    this._restore = restore;
  }

  private _load(): IData<T> {
    if (!this._data) {
      if (fs.existsSync(this._fn)) {
        let parsed;

        try {
          parsed = JSON.parse(fs.readFileSync(this._fn, { encoding: 'utf8' }));
          if (parsed.version === '1.0' && typeof parsed.data === 'object') {
            const data = this._restore?.(parsed.data) ?? parsed.data;

            if (!this._check || this._check(data)) {
              this._logger.info(`Data has been loaded from ${this._fn}. Keys: ${Object.keys(parsed.data).length}...`);
              this._data = parsed.data;
            }
          }
        }
        catch (e) {
          if (!this._ignore) {
            throw e;
          }
        }

        if (!this._data && !this._ignore) {
          throw new Error(`Invalid data in file: ${this._fn}`);
        }
      }

      if (!this._data) {
        this._data = this._initData;
      }
    }

    return this._data;
  }

  public isEmpty() {
    return !Object.keys(this.getMutable(false)).length;
  }

  public getMutable(forWrite: boolean) {
    if (forWrite) {
      this._modified = true;
    }
    return this._load();
  }

  public clear() {
    this._data = {};
    this._modified = true;
  }

  public read(key: string): T | undefined {
    return this._load()[key];
  }

  public write(key: string, data: T) {
    this._load()[key] = data;
    this._modified = true;
  }

  public delete(key: string) {
    this._load();

    if (this._data && this._data[key]) {
      delete this._data[key];
      this._modified = true;
    }
  }

  public has(key: string) {
    this._load();
    return this._data && key in this._data;
  }

  public put(data: IData<T>) {
    this._data = data;
    this._modified = true;
  }

  public merge(key: string, data: Partial<T>, omit?: (keyof T)[]) {
    const prev = this._load()[key];
    this._data![key] = {...prev, ...data};
    if (omit) {
      const obj = this._data![key] as any;
      for (const omitProp of omit) {
        delete obj[omitProp];
      }
    }
    this._modified = true;
  }

  public flush(force = false) {
    if (this._data && (force || this._modified)) {
      const envelope: IDataEnvelope<T> =
      {
        version: '1.0',
        data: this._data
      };

      const dirName = path.dirname(this._fn);

      if (!fs.existsSync(dirName)) {
        // создадим папку, если она не существует
        fs.mkdirSync(dirName, { recursive: true });
      }

      fs.writeFileSync(this._fn, JSON.stringify(envelope, undefined, 2), { encoding: 'utf8' });
      this._modified = false;
      this._logger.info(`Data has been written to ${this._fn}...`);
    }
  }
};