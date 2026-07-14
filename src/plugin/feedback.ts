import type { SkillSearchResult } from "../types.js";
import { QualityScorer } from "../scoring/quality.js";

const qualityScorer = new QualityScorer();

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface Recommendation {
  identifier: string;
  name: string;
  marketplace: string;
  description: string;
  score: number;
  trustGrade: "A" | "B" | "C" | "D" | "F";
  matchReasons: string[];
  fromCache: boolean;
  alreadyInstalled: boolean;
}

export interface RecommenderConfig {
  maxResults?: number;            // Default: 3
  localWeight?: number;           // Default: 0.6
  networkWeight?: number;         // Default: 0.4
  minScore?: number;              // Default: 0.3
  installedSkillNames?: string[]; // Names of already installed skills
  minTrustGrade?: "A" | "B" | "C" | "D" | "F";
}

// ---------------------------------------------------------------------------
// Feedback state
// ---------------------------------------------------------------------------

export class FeedbackManager {
  private dismissedSkills: Set<string> = new Set();
  private acceptedSkills: Set<string> = new Set();

  acceptSkill(identifier: string): void {
    this.acceptedSkills.add(identifier);
    this.dismissedSkills.delete(identifier);
  }

  dismissSkill(identifier: string): void {
    this.dismissedSkills.add(identifier);
    this.acceptedSkills.delete(identifier);
  }

  resetFeedback(): void {
    this.dismissedSkills.clear();
    this.acceptedSkills.clear();
  }

  isDismissed(identifier: string): boolean {
    return this.dismissedSkills.has(identifier);
  }
}

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

export function scoreByCategoryMatch(
  skill: SkillSearchResult,
  categories: string[],
): number {
  let score = 0;

  // Category match: +0.25
  if (skill.category) {
    const skillCat = skill.category.toLowerCase();
    for (const cat of categories) {
      if (skillCat === cat.toLowerCase()) {
        score += 0.25;
        break;
      }
    }
  }

  // Trigger match: +0.15 each (max 0.45)
  let triggerBonus = 0;
  for (const trigger of skill.triggers) {
    const tLower = trigger.toLowerCase();
    for (const cat of categories) {
      if (tLower.includes(cat.toLowerCase()) || cat.toLowerCase().includes(tLower)) {
        triggerBonus += 0.15;
        break;
      }
    }
  }
  score += Math.min(triggerBonus, 0.45);

  // Name/description keyword match: +0.1
  const nameLower = skill.name.toLowerCase();
  const descLower = skill.description.toLowerCase();
  for (const cat of categories) {
    const catLower = cat.toLowerCase();
    if (nameLower.includes(catLower) || descLower.includes(catLower)) {
      score += 0.1;
      break;
    }
  }

  // Quality score: 0–0.2 based on quality score
  const qualityBonus = qualityScorer.score(skill) * 0.2;  // max 0.2
  score += qualityBonus;

  // Cap at 1.0
  return Math.min(Math.round(score * 100) / 100, 1.0);
}

export function generateMatchReasons(
  skill: SkillSearchResult,
  categories: string[],
): string[] {
  const reasons: string[] = [];

  // Category match
  if (skill.category) {
    const skillCat = skill.category.toLowerCase();
    for (const cat of categories) {
      if (skillCat === cat.toLowerCase()) {
        reasons.push(`Matches '${cat}' task category`);
        break;
      }
    }
  }

  // Trigger matches
  for (const trigger of skill.triggers) {
    const tLower = trigger.toLowerCase();
    for (const cat of categories) {
      if (tLower.includes(cat.toLowerCase()) || cat.toLowerCase().includes(tLower)) {
        reasons.push(`Has trigger '${trigger}' matching your task`);
        break;
      }
    }
  }

  // Quality score
  const qScore = qualityScorer.score(skill);
  if (qScore > 0.7) {
    reasons.push(`Quality score: ${Math.round(qScore * 100)}%`);
  }

  // Verified
  if (skill.verified) {
    reasons.push(`Verified by ${skill.marketplace}`);
  }

  // Stars
  if (skill.stars > 0) {
    reasons.push(`Star rating: ${skill.stars}/5`);
  }

  // Cache status
  // (handled externally via fromCache field, not as a reason string)

  return reasons;
}

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

export function indexedToRecommendation(
  skill: { id: string; name: string; description: string; marketplace: string; category: string | null; triggers: string[]; installCount: number; stars: number },
  categories: string[],
  trustGrade: "A" | "B" | "C" | "D" | "F",
): Recommendation {
  const skillSearch: SkillSearchResult = {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    marketplace: skill.marketplace as SkillSearchResult["marketplace"],
    category: skill.category,
    triggers: skill.triggers,
    installCount: skill.installCount,
    stars: skill.stars,
    installCommand: "",
    homepageUrl: "",
    verified: false,
  };

  return {
    identifier: skill.id,
    name: skill.name,
    marketplace: skill.marketplace,
    description: skill.description,
    score: scoreByCategoryMatch(skillSearch, categories),
    trustGrade,
    matchReasons: generateMatchReasons(skillSearch, categories),
    fromCache: true,
    alreadyInstalled: false,
  };
}

export function toRecommendation(
  skill: SkillSearchResult,
  fromCache: boolean,
  categories: string[],
  trustGrade: "A" | "B" | "C" | "D" | "F",
): Recommendation {
  return {
    identifier: skill.id,
    name: skill.name,
    marketplace: skill.marketplace,
    description: skill.description,
    score: scoreByCategoryMatch(skill, categories),
    trustGrade,
    matchReasons: generateMatchReasons(skill, categories),
    fromCache,
    alreadyInstalled: false,
  };
}
