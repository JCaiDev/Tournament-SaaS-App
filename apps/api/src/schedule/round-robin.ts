export const roundRobinPairs = (
    teamIds: string[],
): { teamAId: string; teamBId: string }[] => {
    const pairs = [];

    for (let i = 0; i < teamIds.length; i++) {
        for (let j = i + 1; j < teamIds.length; j++) {
            pairs.push({ teamAId: teamIds[i], teamBId: teamIds[j] });
        }
    }
    return pairs;
};
