export const packMatches = <T extends { teamAId: string; teamBId: string }>(
    pairs: T[],
    numberOfCourts: number,
    // courtFor: pins a match to one court (one-court-per-pool mode).
    // Left out: a match takes the next open court.
    options: { courtFor?: (match: T) => number } = {},
): (T & { slot: number; court: number })[] => {
    if (numberOfCourts < 1)
        throw new Error('Court numbers cannot be less than 1');
    let remaining = [...pairs];
    const schedule = [];
    let slot = 0;
    while (remaining.length > 0) {
        let busy = new Set<string>();
        // Courts already holding a match in this slot (one match per court).
        let usedCourts = new Set<number>();
        let leftover = [];
        for (let i = 0; i < remaining.length; i++) {
            const match = remaining[i];
            // Pinned court if courtFor is given, otherwise the next open one.
            // Without courtFor, courts fill 1, 2, 3… so "next open" is size + 1.
            const court = options.courtFor
                ? options.courtFor(match)
                : usedCourts.size + 1;
            // A pinned court that doesn't exist could never be filled: the while
            // loop would spin forever, so fail loudly instead.
            if (options.courtFor && (court < 1 || court > numberOfCourts))
                throw new Error(`Court ${court} does not exist`);
            if (
                court <= numberOfCourts &&
                !usedCourts.has(court) &&
                !busy.has(match.teamAId) &&
                !busy.has(match.teamBId)
            ) {
                schedule.push({
                    ...match,
                    slot,
                    court,
                });
                busy.add(match.teamAId);
                busy.add(match.teamBId);
                usedCourts.add(court);
            } else {
                leftover.push(match);
            }
        }
        remaining = leftover;
        slot++;
    }
    return schedule;
};
