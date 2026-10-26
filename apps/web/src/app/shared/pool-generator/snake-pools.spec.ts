import { poolName, snakePools } from './snake-pools';

// Always picks index 0, so a shuffle with it is predictable.
const firstPick = () => 0;

function ids(prefix: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);
}

describe('poolName', () => {
  it('uses letters A to Z', () => {
    expect(poolName(0)).toBe('Pool A');
    expect(poolName(25)).toBe('Pool Z');
  });

  it('switches to numbers after Z so names stay unique', () => {
    expect(poolName(26)).toBe('Pool 27');
  });
});

describe('snakePools', () => {
  it('snakes seeds so the top and bottom seeds share a pool', () => {
    expect(snakePools(ids('s', 6), [], 3)).toEqual([
      ['s1', 's6'],
      ['s2', 's5'],
      ['s3', 's4'],
    ]);
  });

  it('keeps snaking past the second round', () => {
    expect(snakePools(ids('s', 8), [], 2)).toEqual([
      ['s1', 's4', 's5', 's8'],
      ['s2', 's3', 's6', 's7'],
    ]);
  });

  it('places unseeded teams after the seeds, continuing the snake', () => {
    // firstPick shuffles [u1, u2] into [u2, u1]. Round 1 is the seeds (A, B);
    // round 2 comes back (B, A) with the unseeded teams.
    expect(snakePools(['s1', 's2'], ['u1', 'u2'], 2, firstPick)).toEqual([
      ['s1', 'u1'],
      ['s2', 'u2'],
    ]);
  });

  it('shuffles the unseeded teams with the given random', () => {
    const unseeded = ids('u', 6);
    const a = snakePools([], unseeded, 2, () => 0);
    const b = snakePools([], unseeded, 2, () => 0.99);
    expect(a).not.toEqual(b);
  });

  it('keeps pool sizes within 1 of each other', () => {
    const pools = snakePools(ids('s', 3), ids('u', 8), 4);
    const sizes = pools.map((p) => p.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    expect(sizes.reduce((sum, n) => sum + n, 0)).toBe(11);
  });

  it('does not change the input arrays', () => {
    const unseeded = ids('u', 5);
    snakePools([], unseeded, 2, firstPick);
    expect(unseeded).toEqual(ids('u', 5));
  });

  it('treats a pool count below 1 as one pool', () => {
    expect(snakePools(['s1', 's2'], [], 0)).toEqual([['s1', 's2']]);
  });

  it('returns empty pools when there are more pools than teams', () => {
    expect(snakePools(['s1'], [], 3)).toEqual([['s1'], [], []]);
  });
});
