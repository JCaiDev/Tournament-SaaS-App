import { LobbyPlayer } from '../../models/lobby';

// Positions are free text, so " Setter", "setter" and "SETTER" must group together.
// Blank sorts last ('~' comes after every letter).
export function positionKey(position: string): string {
  return position.trim().toLowerCase() || '~';
}

// Pure: same players + teamCount + random always give the same result, and nothing
// outside this function is changed. Returns playerId -> team index.
export function generateTeams(
  players: LobbyPlayer[],
  teamCount: number,
  fixed: Record<string, number>,
  random: () => number = Math.random,
): Record<string, number> {
  const count = Math.max(1, teamCount);
  // Free = not fixed, or "fixed" to a team that doesn't exist (bench is -1).
  const pool = players.filter((p) => {
    const t = fixed[p.id];
    return t === undefined || t < 0 || t >= count;
  });
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  // Group by position so players with the same role are placed back to back.
  pool.sort((a, b) => positionKey(a.position).localeCompare(positionKey(b.position)));
  const map: Record<string, number> = { ...fixed };

  // How many players each team has right now, starting with the fixed ones.
  const sizes: number[] = Array(count).fill(0);
  for (const t of Object.values(fixed)) {
    if (t >= 0 && t < count) sizes[t]++;
  }

  // Each free player joins whichever team is currently smallest.
  for (const p of pool) {
    const smallest = sizes.indexOf(Math.min(...sizes));
    map[p.id] = smallest;
    sizes[smallest]++;
  }
  return map;
}
