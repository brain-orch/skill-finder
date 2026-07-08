import { describe, it, expect } from "vitest";
import { QualityScorer } from "../../src/scoring/quality.js";

describe("QualityScorer", () => {
  const scorer = new QualityScorer();

  it("should score lobehub skill with good metrics correctly", () => {
    const skill = {
      id: "lobehub:pdf-tools",
      name: "pdf-tools",
      description: "x".repeat(200),
      marketplace: "lobehub" as const,
      category: "pdf-processing",
      triggers: ["pdf"],
      installCount: 500,
      stars: 4,
      installCommand: "npm install pdf-tools",
      homepageUrl: "https://lobehub.com/skills/pdf-tools",
      verified: true,
    };
    // stars=4/5=0.8, installs=500/1000=0.5, desc=min(200/200,1)*(1)=1.0, source=1.0
    // 0.8*0.35 + 0.5*0.35 + 1.0*0.15 + 1.0*0.15 = 0.28+0.175+0.15+0.15 = 0.755 ≈ 0.76
    expect(scorer.score(skill)).toBe(0.76);
  });

  it("should normalize agentskillsh stars to 0-100 scale", () => {
    const skill = {
      id: "agentskillsh:git-helper",
      name: "git-helper",
      description: "x".repeat(100),
      marketplace: "agentskillsh" as const,
      category: "git",
      triggers: ["git"],
      installCount: 200,
      stars: 85,
      installCommand: "npm install git-helper",
      homepageUrl: "https://agentskill.sh/skills/git-helper",
      verified: false,
    };
    // stars=85/100=0.85, installs=200/1000=0.2, desc=min(100/200,1)*(1)=0.5, source=0.9
    // 0.85*0.35 + 0.2*0.35 + 0.5*0.15 + 0.9*0.15 = 0.2975+0.07+0.075+0.135 = 0.5775 ≈ 0.58
    expect(scorer.score(skill)).toBe(0.58);
  });

  it("should score empty skill with minimal values", () => {
    const skill = {
      id: "lobehub:empty",
      name: "empty",
      description: "",
      marketplace: "lobehub" as const,
      category: null,
      triggers: [],
      installCount: 0,
      stars: 0,
      installCommand: "",
      homepageUrl: "",
      verified: false,
    };
    // stars=0, installs=0, desc=min(0/200,1)*(0.7)=0, source=1.0
    // 0+0+0+0.15 = 0.15
    expect(scorer.score(skill)).toBe(0.15);
  });

  it("should score mcpservers skill with no stars/installs", () => {
    const skill = {
      id: "mcpservers:some-server",
      name: "some-server",
      description: "x".repeat(50),
      marketplace: "mcpservers" as const,
      category: null,
      triggers: [],
      installCount: 0,
      stars: 0,
      installCommand: "",
      homepageUrl: "",
      verified: false,
    };
    // sourceRep=0.7, descQuality=min(50/200,1)*(0.7)=0.175
    // 0+0+0.175*0.15+0.7*0.15 = 0+0+0.02625+0.105 = 0.13125 ≈ 0.13
    expect(scorer.score(skill)).toBe(0.13);
  });
});
