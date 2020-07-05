type Unlock = () => void;

let id = 1;

export class Semaphore {
  private _id: number = id++;
  private _name: string;
  private _permits: number;
  private _queue: Unlock[] = [];

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
      //TODO: temporarily
      console.log(`Semaphore ${this._name} is free.`)
      return;
    }

    console.log(`Semaphore ${this._name} is locked.`)
    return new Promise( resolve  => this._queue.push(resolve) );
  }

  public release() {
    this._permits += 1;

    if (this._permits > 1 && this._queue.length > 0) {
      throw new Error('Release is called without prior acquire');
    } else if (this._permits === 1 && this._queue.length > 0) {
      this._permits -= 1;
      this._queue.shift()?.();
    }

    console.log(`Semaphore ${this._name} has been released.`);
  }
};