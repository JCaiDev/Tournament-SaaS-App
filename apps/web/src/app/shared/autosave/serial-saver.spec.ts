import { Subject, throwError } from 'rxjs';
import { SerialSaver } from './serial-saver';

describe('SerialSaver', () => {
  // Each send() returns a Subject the test finishes by hand, so we control
  // exactly when a "request" comes back.
  let requests: Subject<void>[];
  let sentValues: number[];
  let current: number;
  let saver: SerialSaver;

  function respond(i: number): void {
    requests[i].next();
    requests[i].complete();
  }

  beforeEach(() => {
    jasmine.clock().install();
    requests = [];
    sentValues = [];
    current = 0;
    saver = new SerialSaver(() => {
      sentValues.push(current); // what the PUT body would contain right now
      const req = new Subject<void>();
      requests.push(req);
      return req;
    }, 1000);
  });

  afterEach(() => jasmine.clock().uninstall());

  it('waits for changes to stop, then sends once', () => {
    current = 1;
    saver.schedule();
    jasmine.clock().tick(500);
    current = 2;
    saver.schedule();
    jasmine.clock().tick(999);
    expect(sentValues).toEqual([]);
    expect(saver.status()).toBe('pending');

    jasmine.clock().tick(1);
    expect(sentValues).toEqual([2]);
    expect(saver.status()).toBe('saving');

    respond(0);
    expect(saver.status()).toBe('saved');
  });

  it('never sends while a save is in flight, then sends the latest state', () => {
    current = 1;
    saver.schedule();
    jasmine.clock().tick(1000); // request 0 in flight

    current = 2;
    saver.schedule();
    current = 3;
    saver.schedule();
    jasmine.clock().tick(1000);
    expect(sentValues).toEqual([1]); // still waiting on request 0

    respond(0);
    expect(sentValues).toEqual([1, 3]); // follow-up carries the newest state
    respond(1);
    expect(saver.status()).toBe('saved');
  });

  it('keeps the change after an error so flush() can retry it', () => {
    const failing = new SerialSaver(() => throwError(() => new Error('offline')), 1000);
    failing.schedule();
    jasmine.clock().tick(1000);
    expect(failing.status()).toBe('error');

    current = 7;
    saver.schedule();
    jasmine.clock().tick(1000);
    requests[0].error(new Error('500'));
    expect(saver.status()).toBe('error');

    saver.flush();
    expect(sentValues).toEqual([7, 7]);
    respond(1);
    expect(saver.status()).toBe('saved');
  });
});
