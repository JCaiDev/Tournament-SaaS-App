// Circle method: each round, every team plays at most once, so the packer can fill slots evenly.
// An odd pool gets a null "BYE" seat; whoever faces it sits out that round.
export const roundRobinPairs = (
    teamIds: string[],
): { teamAId: string; teamBId: string; round: number }[] => {
    const pairs = [];

    let seats: (string | null)[] = [...teamIds];

    if (seats.length % 2 !== 0) seats.push(null);
    const rounds = seats.length - 1;

    const half = seats.length / 2;
    for (let round = 0; round < rounds; round++) {
        for (let i = 0; i < half; i++) {
            const a = seats[i];
            const b = seats[seats.length - 1 - i];

            if (a !== null && b !== null) {
                pairs.push({ teamAId: a, teamBId: b, round });
            }
        }
        // Keep seat 0 fixed and move the last seat to position 1.
        seats = [seats[0], seats[seats.length - 1], ...seats.slice(1, -1)];
    }
    return pairs;
};
