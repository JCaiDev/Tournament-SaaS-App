export const assignRefs = <
    T extends {
        teamAId: string;
        teamBId: string;
        poolId: string;
        slot: number;
    },
>(
    matches: T[],
    teams: { id: string; poolId: string }[],
    options: { samePoolOnly?: boolean } = {},
): (T & { refTeamId: string | null })[] => {
    const busyInSlot = new Map<number, Set<string>>();

    for (const match of matches) {
        let drawer = busyInSlot.get(match.slot);
        if (!drawer) {
            drawer = new Set<string>();
            busyInSlot.set(match.slot, drawer);
        }
        drawer.add(match.teamAId);
        drawer.add(match.teamBId);
    }

    const dutyCounter = new Map<string, number>();
    for (const team of teams) {
        dutyCounter.set(team.id, 0);
    }

    return matches.map((match) => {
        const busy = busyInSlot.get(match.slot)!;
        const candidates = teams.filter(
            (team) =>
                !busy.has(team.id) &&
                (!options.samePoolOnly || team.poolId === match.poolId),
        );

        if (candidates.length === 0) {
            return { ...match, refTeamId: null };
        }
        let ref = candidates[0];
        for (const team of candidates) {
            if (dutyCounter.get(team.id)! < dutyCounter.get(ref.id)!) {
                ref = team;
            }
        }
        busy.add(ref.id);
        dutyCounter.set(ref.id, dutyCounter.get(ref.id)! + 1);

        return { ...match, refTeamId: ref.id };
    });
};
