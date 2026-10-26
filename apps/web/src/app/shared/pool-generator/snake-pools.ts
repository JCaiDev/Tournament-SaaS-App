// "Pool A", "Pool B", … "Pool Z", then "Pool 27" so names never repeat.
export function poolName(index: number): string {
  return index < 26 ? `Pool ${String.fromCharCode(65 + index)}` : `Pool ${index + 1}`;
}

// Pure: same inputs + random always give the same pools, and the input arrays
// are not changed. Returns one list of team ids per pool.
//
// Snake draft: seeds go 1→N across the pools, then back N→1, and so on, so the
// top seed and the weakest seed share a pool:
//   3 pools, 6 seeds → A: 1 6, B: 2 5, C: 3 4
// Unseeded teams continue the same snake after the last seed, in random order
// (so the API's alphabetical order never acts as a hidden seed). Pool sizes
// differ by at most 1.
export function snakePools(
  seededIds: string[],
  unseededIds: string[],
  poolCount: number,
  random: () => number = Math.random,
): string[][] {
  const count = Math.max(1, Math.floor(poolCount));
  const pools: string[][] = Array.from({ length: count }, () => []);

  const order = [...seededIds, ...shuffle(unseededIds, random)];
  order.forEach((id, i) => {
    const round = Math.floor(i / count);
    const step = i % count;
    // Even rounds go left to right, odd rounds come back right to left.
    const pool = round % 2 === 0 ? step : count - 1 - step;
    pools[pool].push(id);
  });
  return pools;
}

// Fisher–Yates on a copy (same as team-generator.ts).
function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
