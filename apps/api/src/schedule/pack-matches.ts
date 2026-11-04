export const packMatches = (
    pairs: { teamAId: string; teamBId: string }[],
    numberOfCourts: number,
): { teamAId: string; teamBId: string; slot: number; court: number }[] => {
    if (numberOfCourts < 1)
        throw new Error('Court numbers cannot be less than 1');
    let remaining = [...pairs];
    const schedule = [];
    let slot = 0;
    while (remaining.length > 0) {
        let busy = new Set<string>();
        let court = 1;
        let leftover = [];
        for (let i = 0; i < remaining.length; i++) {
            const match = remaining[i];
            if (
                court <= numberOfCourts &&
                !busy.has(match.teamAId) &&
                !busy.has(match.teamBId)
            ) {
                schedule.push({
                    teamAId: match.teamAId,
                    teamBId: match.teamBId,
                    slot,
                    court,
                });
                busy.add(match.teamAId);
                busy.add(match.teamBId);
                court++;
            } else {
                leftover.push(match);
            }
        }
        remaining = leftover;
        slot++;
    }
    return schedule;
};
