import { promises as fsPromises, Stats } from 'fs';
import { Semaphore } from './semaphore';

type Level = 'INFO' | 'DEBUG' | 'WARNING' | 'ERROR';

export interface ILoggerParams {
  fileName?: string;
  maxSize?: number;
  useConsole?: boolean;
  level?: Level;
};

export type LoggerFunc = typeof console.log;

export type ILogger = Pick<Console, 'info' | 'debug' | 'warn' | 'error'>;

export class Logger {
  private _fileName?: string;
  private _maxSize?: number;
  private _fileHandle?: fsPromises.FileHandle;
  private _useConsole?: boolean;
  private _level?: Level;
  private _semaphore: Semaphore = new Semaphore();

  constructor(params: ILoggerParams) {
    this._fileName = params.fileName;
    this._maxSize = params.maxSize;
    this._useConsole = params.useConsole;
    this._level = params.level;
  }

  get level() {
    return this._level;
  }

  set level(level) {
    this._level = level;
  }

  private async _openFile() {
    if (!this._fileHandle && this._fileName) {
      await this._semaphore.acquire();
      try {
        if (!this._fileHandle) {
          if (this._maxSize) {
            let stat: Stats | undefined = undefined;

            try {
              const h = await fsPromises.open(this._fileName, 'r');
              await h.close();
              stat = await fsPromises.stat(this._fileName);
            } catch(e) {
              // file doesn't exist
            }

            if (stat && stat.size > this._maxSize) {
              try {
                await fsPromises.unlink(this._fileName);
              } catch(e) {
                console.error(e);
              }
            }
          }

          try {
            this._fileHandle = await fsPromises.open(this._fileName, 'a');
          } catch(e) {
            console.error(e);
          }
        }
      }
      finally {
        this._semaphore.release();
      }
    }
  }

  private _closeFile() {
    this._fileHandle?.close();
    this._fileHandle = undefined;
  }

  private _formatMsg(level: Level, chatId: string | undefined, userId: string | undefined, ...data: any[]) {
    const d = new Date();
    const date = `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;
    const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
    const chat = chatId ? `, chatId: ${chatId}` : '';
    const user = userId ? `, userId: ${userId}` : '';
    return `[${level}] ${date} ${time}${user}${chat}: ${data.length === 1 ? data[0] : data}`;
  }

  private async _log(level: Level, chatId: string | undefined, userId: string | undefined, ...data: any[]) {
    const msg = this._formatMsg(level, chatId, userId, data);

    await this._openFile();

    if (this._fileHandle) {
      try {
        await this._fileHandle.write(msg + '\n');
      } catch(e) {
        console.error(e);
      }
    }

    if (this._useConsole) {
      console.log(msg);
    }
  }

  public useFile(fileName: string, maxSize?: number) {
    this._closeFile();
    this._fileName = fileName;
    this._maxSize = maxSize;
  }

  public async info(chatId: string | undefined, userId: string | undefined, ...data: any[]) {
    if (!this._level || (this._level  !== 'ERROR' && this._level !== 'WARNING' && this._level !== 'DEBUG')) {
      await this._log('INFO', chatId, userId, data);
    }
  }

  public async debug(chatId: string | undefined, userId: string | undefined, ...data: any[]) {
    if (!this._level || (this._level  !== 'ERROR' && this._level !== 'WARNING')) {
      await this._log('DEBUG', chatId, userId, data);
    }
  }

  public async warn(chatId: string | undefined, userId: string | undefined, ...data: any[]) {
    if (!this._level || (this._level  !== 'ERROR')) {
      await this._log('WARNING', chatId, userId, data);
    }
  }

  public async error(chatId: string | undefined, userId: string | undefined, ...data: any[]) {
    await this._log('ERROR', chatId, userId, data);
  }

  public async shutdown() {
    await this._closeFile();
  }

  public getLogger(chatId?: string, userId?: string): ILogger {
    return {
      info: (...args: any[]) => this.info(chatId, userId, ...args),
      debug: (...args: any[]) => this.debug(chatId, userId, ...args),
      warn: (...args: any[]) => this.warn(chatId, userId, ...args),
      error: (...args: any[]) => this.error(chatId, userId, ...args)
    };
  }
}
