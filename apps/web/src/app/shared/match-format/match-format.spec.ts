import { PoolFormat } from '../../models/team';
import { allowedSets, describeFormat, isValidFormat, stepSets, switchMode } from './match-format';

const playAll = (poolSets: number): PoolFormat => ({ poolSets, poolSetMode: 'PLAY_ALL' });
const bestOf = (poolSets: number): PoolFormat => ({ poolSets, poolSetMode: 'BEST_OF' });

describe('isValidFormat (mirrors the API schema)', () => {
  it('accepts any count from 1 to 5 when playing all sets', () => {
    for (const n of [1, 2, 3, 4, 5]) expect(isValidFormat(playAll(n))).toBeTrue();
  });

  it('accepts only odd counts for best of', () => {
    expect(isValidFormat(bestOf(1))).toBeTrue();
    expect(isValidFormat(bestOf(3))).toBeTrue();
    expect(isValidFormat(bestOf(2))).toBeFalse();
    expect(isValidFormat(bestOf(4))).toBeFalse();
  });

  it('rejects counts outside 1–5 and non-whole numbers', () => {
    expect(isValidFormat(playAll(0))).toBeFalse();
    expect(isValidFormat(playAll(6))).toBeFalse();
    expect(isValidFormat(playAll(2.5))).toBeFalse();
  });
});

describe('allowedSets', () => {
  it('offers 1–5 for play all and 1, 3, 5 for best of', () => {
    expect(allowedSets('PLAY_ALL')).toEqual([1, 2, 3, 4, 5]);
    expect(allowedSets('BEST_OF')).toEqual([1, 3, 5]);
  });
});

describe('stepSets', () => {
  it('moves by one when playing all sets', () => {
    expect(stepSets(playAll(2), 1)).toBe(3);
    expect(stepSets(playAll(2), -1)).toBe(1);
  });

  it('moves by two for best of', () => {
    expect(stepSets(bestOf(1), 1)).toBe(3);
    expect(stepSets(bestOf(5), -1)).toBe(3);
  });

  it('stops at the limits', () => {
    expect(stepSets(playAll(5), 1)).toBe(5);
    expect(stepSets(bestOf(1), -1)).toBe(1);
  });
});

describe('switchMode', () => {
  it('keeps a count that still fits', () => {
    expect(switchMode(playAll(3), 'BEST_OF')).toEqual(bestOf(3));
    expect(switchMode(bestOf(5), 'PLAY_ALL')).toEqual(playAll(5));
  });

  it('rounds an even count up to the next odd one for best of', () => {
    expect(switchMode(playAll(2), 'BEST_OF')).toEqual(bestOf(3));
    expect(switchMode(playAll(4), 'BEST_OF')).toEqual(bestOf(5));
  });

  it('always produces a format the API accepts', () => {
    for (const n of [1, 2, 3, 4, 5]) {
      expect(isValidFormat(switchMode(playAll(n), 'BEST_OF'))).toBeTrue();
    }
  });
});

describe('describeFormat', () => {
  it('names each format the way organizers say it', () => {
    expect(describeFormat(playAll(1)).title).toBe('1 set');
    expect(describeFormat(bestOf(1)).title).toBe('1 set');
    expect(describeFormat(bestOf(3)).title).toBe('Best of 3');
    expect(describeFormat(playAll(2)).title).toBe('2 sets');
  });

  it('says how many sets win a best of', () => {
    expect(describeFormat(bestOf(3)).detail).toContain('wins 2 sets');
    expect(describeFormat(bestOf(5)).detail).toContain('wins 3 sets');
  });

  it('warns that an even number of sets can end tied', () => {
    expect(describeFormat(playAll(2)).detail).toContain('1–1');
  });
});
