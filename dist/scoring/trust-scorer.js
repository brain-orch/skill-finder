import { QualityScorer } from "./quality.js";
import { SOURCE_REPUTATION } from "./constants.js";
export class TrustScorer {
    qualityScorer = new QualityScorer();
    score(skill, securityScore) {
        const signals = [];
        // 1. Security audit score (40%)
        // Default to 50 (neutral) if security score not provided
        const secScore = securityScore ?? 50;
        signals.push({ name: "security", value: secScore, weight: 0.4, contribution: secScore * 0.4 });
        // 2. Quality score (30%)
        // QualityScorer returns 0-1, normalize to 0-100
        const qualScore = this.qualityScorer.score(skill) * 100;
        signals.push({ name: "quality", value: qualScore, weight: 0.3, contribution: qualScore * 0.3 });
        // 3. Source reputation (20%)
        // SOURCE_REPUTATION is 0-1, normalize to 0-100
        const repScore = (SOURCE_REPUTATION[skill.marketplace] ?? 0.5) * 100;
        signals.push({ name: "reputation", value: repScore, weight: 0.2, contribution: repScore * 0.2 });
        // 4. Verified badge (10%)
        const verifiedScore = skill.verified ? 100 : 0;
        signals.push({ name: "verified", value: verifiedScore, weight: 0.1, contribution: verifiedScore * 0.1 });
        const totalScore = Math.round(signals.reduce((sum, s) => sum + s.contribution, 0));
        let grade;
        let label;
        if (totalScore >= 90) {
            grade = "A";
            label = "Trusted";
        }
        else if (totalScore >= 75) {
            grade = "B";
            label = "Reliable";
        }
        else if (totalScore >= 60) {
            grade = "C";
            label = "Caution";
        }
        else if (totalScore >= 40) {
            grade = "D";
            label = "Review Required";
        }
        else {
            grade = "F";
            label = "Review Required";
        }
        return { score: totalScore, grade, label, signals };
    }
}
//# sourceMappingURL=trust-scorer.js.map