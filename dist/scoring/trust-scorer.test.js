import { describe, it, expect } from "vitest";
import { TrustScorer } from "./trust-scorer.js";
describe("TrustScorer", () => {
    const scorer = new TrustScorer();
    const baseSkill = {
        id: "test:skill",
        name: "test-skill",
        description: "A test skill",
        marketplace: "lobehub",
        category: "testing",
        triggers: ["test"],
        installCount: 100,
        stars: 4,
        installCommand: "npm install test",
        homepageUrl: "https://example.com",
        verified: false,
    };
    it("should return grade A for perfect scores", () => {
        const skill = { ...baseSkill, verified: true, stars: 5, installCount: 1000 };
        const result = scorer.score(skill, 100);
        expect(result.grade).toBe("A");
        expect(result.label).toBe("Trusted");
        expect(result.score).toBeGreaterThanOrEqual(90);
    });
    it("should return grade B for good scores", () => {
        const skill = { ...baseSkill, verified: true, stars: 5, installCount: 500 };
        const result = scorer.score(skill, 90);
        expect(result.grade).toBe("B");
        expect(result.label).toBe("Reliable");
        expect(result.score).toBeGreaterThanOrEqual(75);
        expect(result.score).toBeLessThan(90);
    });
    it("should return grade C for average scores", () => {
        const skill = { ...baseSkill, verified: false, stars: 4, installCount: 100 };
        const result = scorer.score(skill, 70);
        expect(result.grade).toBe("C");
        expect(result.label).toBe("Caution");
        expect(result.score).toBeGreaterThanOrEqual(60);
        expect(result.score).toBeLessThan(75);
    });
    it("should return grade D for poor scores", () => {
        const skill = { ...baseSkill, verified: false, stars: 2, installCount: 10 };
        const result = scorer.score(skill, 40);
        expect(result.grade).toBe("D");
        expect(result.label).toBe("Review Required");
        expect(result.score).toBeGreaterThanOrEqual(40);
        expect(result.score).toBeLessThan(60);
    });
    it("should return grade F for failing scores", () => {
        const skill = { ...baseSkill, verified: false, stars: 0, installCount: 0 };
        const result = scorer.score(skill, 0);
        expect(result.grade).toBe("F");
        expect(result.label).toBe("Review Required");
        expect(result.score).toBeLessThan(40);
    });
    it("should handle missing security score with default", () => {
        const skill = { ...baseSkill, verified: true, stars: 5, installCount: 1000 };
        const result = scorer.score(skill);
        // Default security score is 50, so total should be high but not necessarily A
        expect(result.score).toBeGreaterThan(50);
        expect(result.signals.length).toBe(4);
    });
});
//# sourceMappingURL=trust-scorer.test.js.map