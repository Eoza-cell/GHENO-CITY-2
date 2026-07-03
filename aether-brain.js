/**
 * AetherBrain: The Procedural Logic Engine of Aetherys
 * Built from scratch to calculate realistic outcomes based on Rank and Stats.
 */
class AetherBrain {
    constructor() {
        this.powerScale = {
            'F': 10,
            'E': 30,
            'D': 60,
            'C': 100,
            'B': 200,
            'A': 500,
            'S': 1000,
            'GOD': 9999
        };
    }

    /**
     * Calculates the probability of success for an action.
     */
    evaluateAction(player, actionText, worldDifficulty = 50) {
        const rankPower = this.powerScale[player.rank] || 10;
        const playerStat = Math.max(player.strength, player.agility, player.intelligence);

        // Simple heuristic success calculation
        let successChance = (playerStat / worldDifficulty) * (rankPower / 50) * 100;

        // Cap chance between 5% and 95% unless GOD
        if (player.isGod) return { chance: 100, critical: true, rankValid: true };

        successChance = Math.max(5, Math.min(95, successChance));

        const roll = Math.random() * 100;
        const isSuccess = roll <= successChance;
        const isCritical = roll <= (successChance * 0.1);

        // Detect if action is too high for rank
        const isRankValid = this.checkRankValidity(player.rank, actionText);

        return {
            chance: Math.round(successChance),
            isSuccess: isSuccess && isRankValid,
            isCritical,
            rankValid: isRankValid,
            roll: Math.round(roll)
        };
    }

    /**
     * Strict rules based on rank keywords
     */
    checkRankValidity(rank, actionText) {
        const text = actionText.toLowerCase();
        const forbiddenForF = ["apôtre", "dieu", "tuer roi", "détruire ville", "voler", "dragon"];

        if (rank === 'F') {
            return !forbiddenForF.some(word => text.includes(word));
        }
        return true;
    }
}

module.exports = new AetherBrain();
