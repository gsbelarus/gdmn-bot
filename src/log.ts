import { promises as fsPromises, Stats } from 'fs';

type Level = 'INFO' | 'DEBUG' | 'WARNING' | 'ERROR';

export interface ILoggerParams {
  fileName?: string;
  maxSize?: number;
  useConsole?: boolean;
  level?: Level;
};

export class Logger {
  private _fileName?: string;
  private _maxSize?: number;
  private _fileHandle?: fsPromises.FileHandle;
  private _useConsole?: boolean;
  private _level?: Level;

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

  private async _closeFile() {
    if (this._fileHandle) {
      await this._fileHandle.close();
      this._fileHandle = undefined;
    }
  }

  private _formatMsg(level: Level, data: any, chatId?: string, userId?: string) {
    const d = new Date();
    const date = `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;
    const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds()}`;
    const chat = chatId ? `, chatId: ${chatId}` : '';
    const user = userId ? `, userId: ${userId}` : '';
    return `[${level}] ${date} ${time}${user}${chat}: ${data}\n`;
  }

  private async _log(level: Level, data: any, chatId?: string, userId?: string) {
    const msg = this._formatMsg(level, data, chatId, userId);

    await this._openFile();

    if (this._fileHandle) {
      try {
        await this._fileHandle.write(msg);
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

  public async info(data: any, chatId?: string, userId?: string) {
    if (!this._level || (this._level  !== 'ERROR' && this._level !== 'WARNING' && this._level !== 'DEBUG')) {
      await this._log('INFO', data, chatId, userId);
    }
  }

  public async debug(data: any, chatId?: string, userId?: string) {
    if (!this._level || (this._level  !== 'ERROR' && this._level !== 'WARNING')) {
      await this._log('DEBUG', data, chatId, userId);
    }
  }

  public async warn(data: any, chatId?: string, userId?: string) {
    if (!this._level || (this._level  !== 'ERROR')) {
      await this._log('WARNING', data, chatId, userId);
    }
  }

  public async error(data: any, chatId?: string, userId?: string) {
    await this._log('ERROR', data, chatId, userId);
  }

  public async shutdown() {
    await this._closeFile();
  }
}
