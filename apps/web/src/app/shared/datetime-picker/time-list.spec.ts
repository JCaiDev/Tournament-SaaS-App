import { anchorIndex, nextIndex } from './time-list';

describe('anchorIndex', () => {
  const values = ['16:30', '16:45', '17:00', '17:15', '19:30'];

  it('opens at the selected time when there is one', () => {
    expect(anchorIndex(values, '19:30')).toBe(4);
  });

  it('opens at 5 PM when nothing is selected', () => {
    expect(anchorIndex(values, '')).toBe(2);
  });

  it('falls back to the first option if the default is missing', () => {
    expect(anchorIndex(['09:00', '10:00'], '')).toBe(0);
  });

  it('returns -1 for an empty list', () => {
    expect(anchorIndex([], '')).toBe(-1);
  });
});

describe('nextIndex', () => {
  it('moves one row with the arrow keys', () => {
    expect(nextIndex(5, 'ArrowDown', 96, 8)).toBe(6);
    expect(nextIndex(5, 'ArrowUp', 96, 8)).toBe(4);
  });

  it('stops at the ends instead of wrapping', () => {
    expect(nextIndex(95, 'ArrowDown', 96, 8)).toBe(95);
    expect(nextIndex(0, 'ArrowUp', 96, 8)).toBe(0);
  });

  it('jumps a page and clamps at the ends', () => {
    expect(nextIndex(10, 'PageDown', 96, 8)).toBe(18);
    expect(nextIndex(92, 'PageDown', 96, 8)).toBe(95);
    expect(nextIndex(3, 'PageUp', 96, 8)).toBe(0);
  });

  it('goes to the first and last rows with Home and End', () => {
    expect(nextIndex(40, 'Home', 96, 8)).toBe(0);
    expect(nextIndex(40, 'End', 96, 8)).toBe(95);
  });

  it('ignores keys that are not navigation keys', () => {
    expect(nextIndex(40, 'a', 96, 8)).toBeNull();
  });
});
