type Unlock = () => void;

let id = 1;

export class Semaphore {
  private _id: number = id++;
  private _name: string;
  private _permits: number;
  private _queue: Unlock[] = [];

  //TODO: имя нам надо было только в отладочных целях
  constructor(name: string, count = 1) {
    this._name = name;
    this._permits = count;
  }

  get id() {
    return this._id;
  }

  get name() {
    return this._name;
  }

  get permits() {
    return this._permits;
  }

  public async acquire(): Promise<void> {
    if (this._permits > 0) {
      this._permits -= 1;
      //console.log(`Semaphore is free: ${this._name}, #${this._id}`)
      return;
    }

    //console.log(`Semaphore is locked: ${this._name}, #${this._id}`)
    return new Promise( resolve  => this._queue.push(resolve) );
  }

  public release() {
    this._permits += 1;

    if (this._permits > 1 && this._queue.length > 0) {
      throw new Error('Internal semaphore error');
    } else if (this._permits === 1 && this._queue.length > 0) {
      this._permits -= 1;
      this._queue.shift()?.();
      //console.log(`Semaphore has been released: ${this._name}, #${this._id}`);
    }
  }
};