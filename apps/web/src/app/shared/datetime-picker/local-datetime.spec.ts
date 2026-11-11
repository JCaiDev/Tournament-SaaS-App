import { addHours, toUtcIso } from './local-datetime';

describe('toUtcIso', () => {
  it('returns a full UTC timestamp (ends in Z)', () => {
    expect(toUtcIso('2026-11-15T09:00')).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  // Written so it passes in any timezone: whatever the UTC text says, reading
  // it back on this machine must give the same wall-clock time that was typed.
  it('keeps the local wall-clock time (9:00 AM stays 9:00 AM here)', () => {
    const back = new Date(toUtcIso('2026-11-15T09:00'));

    expect(back.getFullYear()).toBe(2026);
    expect(back.getMonth()).toBe(10); // November (months start at 0)
    expect(back.getDate()).toBe(15);
    expect(back.getHours()).toBe(9);
    expect(back.getMinutes()).toBe(0);
  });

  it('shifts by this machine’s UTC offset', () => {
    const local = '2026-11-15T09:00';
    const offsetMinutes = new Date(local).getTimezoneOffset(); // e.g. 300 in Toronto (UTC−5)
    const utcHour = new Date(toUtcIso(local)).getUTCHours() * 60 + new Date(toUtcIso(local)).getUTCMinutes();

    expect(utcHour).toBe((9 * 60 + offsetMinutes + 24 * 60) % (24 * 60));
  });

  it('leaves an invalid value unchanged', () => {
    expect(toUtcIso('')).toBe('');
    expect(toUtcIso('not a date')).toBe('not a date');
  });
});

describe('addHours', () => {
  it('adds hours on the same day', () => {
    expect(addHours('2026-10-24T09:00', 6)).toBe('2026-10-24T15:00');
  });

  it('keeps the minutes', () => {
    expect(addHours('2026-10-24T18:45', 2)).toBe('2026-10-24T20:45');
  });

  it('rolls over to the next day (and month) past midnight', () => {
    expect(addHours('2026-10-31T23:00', 2)).toBe('2026-11-01T01:00');
  });

  it('returns an empty string for an invalid value', () => {
    expect(addHours('', 2)).toBe('');
    expect(addHours('not a date', 2)).toBe('');
  });
});
