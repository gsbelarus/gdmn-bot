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

interface IFileDBParams<T extends Object> {
  fn: string;
  logger?: ILogger;
  initData?: IData<T>;
  restore?: (data: IData<T>) => IData<T>;
  check?: (data: IData<T>) => boolean;
  ignore?: boolean;
  watch?: boolean;
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
  private _watcher: fs.FSWatcher | undefined;
  private _watch?: boolean;
  private _needReload?: boolean;

  /**
   * Конструктор.
   * @param fn Имя файла с данными.
   * @param initData Начальные данные, если файла нет или в нем данные неверного формата.
   * @param check Функция для проверки считанных из файла данных на корректность.
   * @param ignore Если true, то при наличии в файле некорректных данных не будет выдаваться исключение.
   */
  constructor ({ fn, initData, check, ignore, logger, restore, watch }: IFileDBParams<T>)
  {
    this._fn = fn;
    this._initData = initData ?? {};
    this._check = check;
    this._ignore = ignore;
    this._logger = logger ?? console;
    this._restore = restore;
    this._watch = watch;
  }

  private _setWatcher() {
    if (this._watch) {
      this._watcher = fs.watch(this._fn, (event) => {
        /**
          * Если файл поменялся на диске, перечитаем его данные при следующем обращении.
          * Но, если данные были изменены в памяти, то не будем перечитывать и предупредим
          * пользователя, что он потеряет свои изменения, сделанные на диске.
          */
        if (!this._needReload && event === 'change' && this._data) {
          if (this._modified) {
            this._logger.warn(`Changes on the disk for file ${this._fn} will be overwritten.`);
          } else {
            this._needReload = true;
            this._logger.info(`File ${this._fn} has been changed on disk. Data will be re-read on next access.`);
          }
        }
      });
    }
  }

  private _load(): IData<T> {
    if (!this._data || this._needReload) {
      this._needReload = false;

      if (fs.existsSync(this._fn)) {
        let parsed;

        try {
          parsed = JSON.parse(fs.readFileSync(this._fn, { encoding: 'utf8' }));
          if (parsed.version === '1.0' && typeof parsed.data === 'object') {
            const data = this._restore?.(parsed.data) ?? parsed.data;

            if (!this._check || this._check(data)) {
              this._logger.info(`Data has been loaded from ${this._fn}. Keys: ${Object.keys(parsed.data).length}...`);
              this._data = data;
              this._setWatcher();
            }
          }
        }
        catch (e) {
          // ошибки парсинга JSON, мы просто выводим в лог
          // потому что может быть ситуация, когда пользователь
          // выполнил частичное редактирование JSON и сохранил
          // промежуточную версию
          if (this._watch || this._ignore) {
            this._logger.error(`File: ${this._fn}, error: ${e}`);
          } else {
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

      try {
        if (!fs.existsSync(dirName)) {
          // создадим папку, если она не существует
          fs.mkdirSync(dirName, { recursive: true });
        }

        this._watcher?.close();
        fs.writeFileSync(this._fn, JSON.stringify(envelope, undefined, 2), { encoding: 'utf8' });
        this._setWatcher();
        this._modified = false;
        this._logger.info(`Data has been written to ${this._fn}...`);
      } catch (e) {
        this._logger.error(`Error writting to file ${this._fn}. ${e}`);
      }
    }
  }
};