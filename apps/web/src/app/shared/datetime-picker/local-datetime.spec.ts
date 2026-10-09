import { addHours } from './local-datetime';

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
