import { LobbyPlayer } from '../../models/lobby';
import { generateTeams, positionKey } from './team-generator';

function player(id: string, position = ''): LobbyPlayer {
  return {
    id,
    lobbyId: 'lobby-1',
    userId: null,
    guestName: id,
    position,
    approved: true,
    paid: false,
    joinedAt: '2026-01-01T00:00:00.000Z',
    user: null,
  };
}

function players(n: number): LobbyPlayer[] {
  return Array.from({ length: n }, (_, i) => player(`p${i}`));
}

// Team sizes from an assignment map, e.g. { a: 0, b: 1, c: 0 } -> [2, 1].
function sizesOf(map: Record<string, number>, teamCount: number): number[] {
  const sizes = Array(teamCount).fill(0);
  for (const t of Object.values(map)) sizes[t]++;
  return sizes;
}

describe('positionKey', () => {
  it('ignores case and surrounding spaces', () => {
    expect(positionKey(' Setter ')).toBe('setter');
    expect(positionKey('SETTER')).toBe('setter');
  });

  it('sorts blank positions last', () => {
    expect(positionKey('   ')).toBe('~');
    expect(positionKey('')).toBe('~');
  });
});

describe('generateTeams', () => {
  it('puts every player on exactly one valid team', () => {
    const roster = players(10);
    const map = generateTeams(roster, 3, {});

    expect(Object.keys(map).sort()).toEqual(roster.map((p) => p.id).sort());
    for (const t of Object.values(map)) {
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(3);
    }
  });

  it('keeps team sizes within 1 of each other', () => {
    for (let n = 0; n <= 13; n++) {
      const sizes = sizesOf(generateTeams(players(n), 4, {}), 4);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    }
  });

  it('leaves fixed players on their team', () => {
    const map = generateTeams(players(6), 3, { p0: 2, p1: 2 });

    expect(map['p0']).toBe(2);
    expect(map['p1']).toBe(2);
  });

  it('counts fixed players when balancing sizes', () => {
    // Three friends already on Team 0: the six free players go to Teams 1 and 2.
    const map = generateTeams(players(9), 3, { p0: 0, p1: 0, p2: 0 });

    expect(sizesOf(map, 3)).toEqual([3, 3, 3]);
  });

  it('places benched (-1) and out-of-range players', () => {
    const map = generateTeams(players(4), 2, { p0: -1, p1: 5 });

    expect(map['p0']).toBeGreaterThanOrEqual(0);
    expect(map['p0']).toBeLessThan(2);
    expect(map['p1']).toBeGreaterThanOrEqual(0);
    expect(map['p1']).toBeLessThan(2);
    expect(sizesOf(map, 2)).toEqual([2, 2]);
  });

  it('spreads a position across teams, even with messy spelling', () => {
    const roster = [
      player('s1', 'Setter'),
      player('s2', ' setter'),
      player('s3', 'SETTER '),
      player('h1', 'Hitter'),
      player('h2', 'hitter'),
      player('h3', 'Hitter'),
    ];
    const map = generateTeams(roster, 3, {});
    const setterTeams = ['s1', 's2', 's3'].map((id) => map[id]).sort();

    expect(setterTeams).toEqual([0, 1, 2]);
  });

  it('gives the same result for the same random numbers', () => {
    const roster = players(8);
    const a = generateTeams(roster, 3, {}, () => 0.42);
    const b = generateTeams(roster, 3, {}, () => 0.42);

    expect(a).toEqual(b);
  });

  it('does not change its inputs', () => {
    const roster = players(5);
    const order = roster.map((p) => p.id);
    const fixed = { p0: 1 };

    generateTeams(roster, 2, fixed);

    expect(roster.map((p) => p.id)).toEqual(order);
    expect(fixed).toEqual({ p0: 1 });
  });
});
