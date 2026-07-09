import { SOURCE_REPUTATION } from "./constants.js";
export class QualityScorer {
    score(skill) {
        // Stars normalization: agentskillsh uses 0-100, others 0-5
        const starsNorm = skill.marketplace === 'agentskillsh'
            ? Math.min(skill.stars / 100, 1)
            : Math.min(skill.stars / 5, 1);
        // Installs: clamp at 1000
        const installsNorm = Math.min(skill.installCount / 1000, 1);
        // Desc quality: length + triggers heuristic
        const descLen = (skill.description || '').length;
        const descQuality = Math.min(descLen / 200, 1) * (skill.triggers.length > 0 ? 1 : 0.7);
        // Source reputation
        const sourceRep = SOURCE_REPUTATION[skill.marketplace] ?? 0.5;
        // Weighted sum
        const score = starsNorm * 0.35 + installsNorm * 0.35 + descQuality * 0.15 + sourceRep * 0.15;
        return Math.round(Math.min(score, 1) * 100) / 100;
    }
}
//# sourceMappingURL=quality.js.map