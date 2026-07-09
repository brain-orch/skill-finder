import type { SkillSearchResult } from "../types.js";
export interface TrustSignal {
    name: string;
    value: number;
    weight: number;
    contribution: number;
}
export interface TrustGrade {
    score: number;
    grade: "A" | "B" | "C" | "D" | "F";
    label: string;
    signals: TrustSignal[];
}
export declare class TrustScorer {
    private qualityScorer;
    score(skill: SkillSearchResult, securityScore?: number): TrustGrade;
}
//# sourceMappingURL=trust-scorer.d.ts.map