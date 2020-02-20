import fs from 'fs';

interface IData<T> {
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

  constructor (fn: string, initData: IData<T>) {
    this._fn = fn;
    this._initData = initData;
  }

  private _load(): IData<T> {
    if (!this._data) {
      if (fs.existsSync(this._fn)) {
        const parsed = JSON.parse(fs.readFileSync(this._fn, { encoding: 'utf8' }).toString());
        if (parsed.version === '1.0' && typeof parsed.data === 'object') {
          this._data = parsed.data;
        }
        if (!this._data) {
          throw new Error(`Invalid data in file ${this._fn}`);
        }
      } else {
        this._data = this._initData;
      }
    }

    return this._data;
  }

  public getMutable(forWrite: boolean) {
    if (forWrite) {
      this._modified = true;
    }
    return this._load();
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

  public merge(key: string, data: Partial<T>, omit?: string[]) {
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
      const envelope: IDataEnvelope<T> = {
        version: '1.0',
        data: this._data
      };
      fs.writeFileSync(this._fn, JSON.stringify(envelope, undefined, 2), { encoding: 'utf8' });
      this._modified = false;
      console.log(`Data has been written to ${this._fn}...`);
    }
  }
};