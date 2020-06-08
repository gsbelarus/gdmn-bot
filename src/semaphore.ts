type Unlock = () => void;

export class Semaphore {
  private _permits: number;
  private _queue: Unlock[] = [];

  constructor(count = 1) {
    this._permits = count;
  }

  get permits() {
    return this._permits;
  }

  public async acquire(): Promise<void> {
    if (this._permits > 0) {
      this._permits -= 1;
      return;
    }

    return new Promise( resolve  => this._queue.push(resolve) );
  }

  public release() {
    this._permits += 1;

    if (this._permits > 1 && this._queue.length > 0) {
      console.warn('Should never be');
    } else if (this._permits === 1 && this._queue.length > 0) {
      this._permits -= 1;
      this._queue.shift()?.();
    }
  }
};