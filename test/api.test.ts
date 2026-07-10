import { describe, it, expect, vi, beforeEach } from "vitest";
import { SkillFinderAPI } from "../src/api.js";
import type { SkillSearchResult } from "../src/types.js";
import type { LockedSkill } from "../src/cache/skill-lock.js";
import type { SkillFinderConfig } from "../src/config.js";

/* ------------------------------------------------------------------ */
/*  Mock Data                                                          */
/* ------------------------------------------------------------------ */

const mockSearchResult: SkillSearchResult = {
  id: "lobehub:pdf-tools",
  name: "pdf-tools",
  description: "PDF processing toolkit",
  marketplace: "lobehub",
  category: "pdf-processing",
  triggers: ["pdf", "document"],
  installCount: 500,
  stars: 4.5,
  installCommand: "skill install lobehub:pdf-tools",
  homepageUrl: "https://example.com/pdf-tools",
  verified: true,
};

const mockLockedSkill: LockedSkill = {
  identifier: "lobehub:pdf-tools",
  installedAt: "2026-01-01T00:00:00.000Z",
  contentHash: "sha256-abc123",
  version: "1.0.0",
  marketplace: "lobehub",
  lastChecked: "2026-01-01T00:00:00.000Z",
  targets: [".opencode/skills"],
};

const mockPlanMeta = {
  key: "nextjs-prisma",
  name: "Next.js + Prisma",
  description: "Full-stack Next.js application with Prisma ORM",
  matchCategories: ["next", "react", "frontend", "prisma", "database"],
};

/* ------------------------------------------------------------------ */
/*  Mock Instances                                                     */
/* ------------------------------------------------------------------ */

const mockLockManager = {
  getLockedSkills: vi.fn(),
  lockSkill: vi.fn(),
  unlockSkill: vi.fn(),
};

const mockChangelogTracker = {
  hasBreakingChanges: vi.fn(),
  getChangelog: vi.fn(),
};

const mockPlanComposer = {
  getAvailablePlans: vi.fn(),
  composePlan: vi.fn(),
};

/* ------------------------------------------------------------------ */
/*  Mock Modules                                                       */
/* ------------------------------------------------------------------ */

vi.mock("../src/registry/instance.js", () => ({
  marketplaceRegistry: {
    searchAll: vi.fn(),
    getMarketplace: vi.fn(),
    listAvailable: vi.fn(),
  },
}));

vi.mock("../src/cache/skill-lock.js", () => ({
  SkillLockManager: class {
    getLockedSkills = mockLockManager.getLockedSkills;
    lockSkill = mockLockManager.lockSkill;
    unlockSkill = mockLockManager.unlockSkill;
  },
}));

vi.mock("../src/cache/changelog-tracker.js", () => ({
  ChangelogTracker: class {
    hasBreakingChanges = mockChangelogTracker.hasBreakingChanges;
    getChangelog = mockChangelogTracker.getChangelog;
  },
}));

vi.mock("../src/composer/skill-plan.js", () => ({
  SkillPlanComposer: class {
    getAvailablePlans = mockPlanComposer.getAvailablePlans;
    composePlan = mockPlanComposer.composePlan;
  },
}));

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("SkillFinderAPI", () => {
  let api: SkillFinderAPI;
  let mockRegistry: {
    searchAll: ReturnType<typeof vi.fn>;
    getMarketplace: ReturnType<typeof vi.fn>;
    listAvailable: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const registryModule = await import("../src/registry/instance.js");
    mockRegistry = registryModule.marketplaceRegistry as unknown as typeof mockRegistry;

    api = new SkillFinderAPI();
  });

  /* -------------------------------------------------------------- */
  /*  Constructor / Config                                           */
  /* -------------------------------------------------------------- */

  describe("constructor", () => {
    it("creates instance with default config", () => {
      const instance = new SkillFinderAPI();
      expect(instance).toBeInstanceOf(SkillFinderAPI);
    });

    it("creates instance with custom config", () => {
      const config: Partial<SkillFinderConfig> = {
        enabled: false,
        maxRecommendations: 5,
      };
      const instance = new SkillFinderAPI(config);
      expect(instance).toBeInstanceOf(SkillFinderAPI);
    });
  });

  /* -------------------------------------------------------------- */
  /*  search()                                                       */
  /* -------------------------------------------------------------- */

  describe("search", () => {
    it("returns search results for valid query", async () => {
      mockRegistry.searchAll.mockResolvedValue([mockSearchResult]);

      const results = await api.search("pdf tools");

      expect(results).toEqual([mockSearchResult]);
      expect(mockRegistry.searchAll).toHaveBeenCalledWith("pdf tools", {
        category: undefined,
        limit: 5,
      });
    });

    it("passes category and limit options", async () => {
      mockRegistry.searchAll.mockResolvedValue([mockSearchResult]);

      const results = await api.search("pdf", { category: "pdf-processing", limit: 10 });

      expect(results).toEqual([mockSearchResult]);
      expect(mockRegistry.searchAll).toHaveBeenCalledWith("pdf", {
        category: "pdf-processing",
        limit: 10,
      });
    });

    it("throws on empty query", async () => {
      await expect(api.search("")).rejects.toThrow("query is required");
      await expect(api.search("   ")).rejects.toThrow("query is required");
    });

    it("throws on invalid limit", async () => {
      await expect(api.search("test", { limit: 0 })).rejects.toThrow("limit must be between 1 and 50");
      await expect(api.search("test", { limit: 51 })).rejects.toThrow("limit must be between 1 and 50");
    });

    it("returns empty array when no results found", async () => {
      mockRegistry.searchAll.mockResolvedValue([]);

      const results = await api.search("nonexistent");

      expect(results).toEqual([]);
    });
  });

  /* -------------------------------------------------------------- */
  /*  install()                                                      */
  /* -------------------------------------------------------------- */

  describe("install", () => {
    it("installs skill successfully", async () => {
      const mockAdapter = {
        install: vi.fn().mockResolvedValue({
          path: "/tmp/skill-install",
          files: ["SKILL.md"],
        }),
      };
      mockRegistry.getMarketplace.mockReturnValue(mockAdapter);

      const result = await api.install("lobehub:pdf-tools", "lobehub");

      expect(result).toEqual({
        path: "/tmp/skill-install",
        files: ["SKILL.md"],
        targets: ["opencode"],
      });
      expect(mockAdapter.install).toHaveBeenCalled();
      expect(mockLockManager.lockSkill).toHaveBeenCalled();
    });

    it("uses custom target when provided", async () => {
      const mockAdapter = {
        install: vi.fn().mockResolvedValue({
          path: "/tmp/skill-install",
          files: ["SKILL.md"],
        }),
      };
      mockRegistry.getMarketplace.mockReturnValue(mockAdapter);

      const result = await api.install("lobehub:pdf-tools", "lobehub", "claude");

      expect(result.targets).toEqual(["claude"]);
    });

    it("throws on empty identifier", async () => {
      await expect(api.install("", "lobehub")).rejects.toThrow("identifier is required");
    });

    it("throws on empty marketplace", async () => {
      await expect(api.install("lobehub:pdf-tools", "")).rejects.toThrow("marketplace is required");
    });

    it("throws on unknown marketplace", async () => {
      mockRegistry.getMarketplace.mockReturnValue(undefined);
      mockRegistry.listAvailable.mockReturnValue(["lobehub", "skillssh"]);

      await expect(api.install("test:skill", "unknown")).rejects.toThrow("not available");
    });
  });

  /* -------------------------------------------------------------- */
  /*  list()                                                         */
  /* -------------------------------------------------------------- */

  describe("list", () => {
    it("returns locked skills", async () => {
      mockLockManager.getLockedSkills.mockReturnValue([mockLockedSkill]);

      const result = await api.list();

      expect(result).toEqual([mockLockedSkill]);
      expect(mockLockManager.getLockedSkills).toHaveBeenCalled();
    });

    it("returns empty array when no skills locked", async () => {
      mockLockManager.getLockedSkills.mockReturnValue([]);

      const result = await api.list();

      expect(result).toEqual([]);
    });
  });

  /* -------------------------------------------------------------- */
  /*  info()                                                         */
  /* -------------------------------------------------------------- */

  describe("info", () => {
    it("returns skill info for identifier with marketplace prefix", async () => {
      const mockAdapter = {
        getSkillInfo: vi.fn().mockResolvedValue(mockSearchResult),
      };
      mockRegistry.getMarketplace.mockReturnValue(mockAdapter);

      const result = await api.info("lobehub:pdf-tools");

      expect(result).toEqual(mockSearchResult);
      expect(mockAdapter.getSkillInfo).toHaveBeenCalledWith("pdf-tools");
    });

    it("falls back to search when adapter returns null", async () => {
      const mockAdapter = {
        getSkillInfo: vi.fn().mockResolvedValue(null),
      };
      mockRegistry.getMarketplace.mockReturnValue(mockAdapter);
      mockRegistry.searchAll.mockResolvedValue([mockSearchResult]);

      const result = await api.info("lobehub:pdf-tools");

      expect(result).toEqual(mockSearchResult);
    });

    it("returns null for nonexistent skill", async () => {
      const mockAdapter = {
        getSkillInfo: vi.fn().mockResolvedValue(null),
      };
      mockRegistry.getMarketplace.mockReturnValue(mockAdapter);
      mockRegistry.searchAll.mockResolvedValue([]);

      const result = await api.info("nonexistent:skill");

      expect(result).toBeNull();
    });

    it("throws on empty identifier", async () => {
      await expect(api.info("")).rejects.toThrow("identifier is required");
    });

    it("searches all marketplaces when no marketplace prefix", async () => {
      mockRegistry.searchAll.mockResolvedValue([mockSearchResult]);

      const result = await api.info("pdf-tools");

      expect(result).toEqual(mockSearchResult);
    });
  });

  /* -------------------------------------------------------------- */
  /*  remove()                                                       */
  /* -------------------------------------------------------------- */

  describe("remove", () => {
    it("removes skill successfully", async () => {
      mockLockManager.unlockSkill.mockImplementation(() => {});

      const result = await api.remove("lobehub:pdf-tools");

      expect(result).toBe(true);
      expect(mockLockManager.unlockSkill).toHaveBeenCalledWith("lobehub:pdf-tools");
    });

    it("returns false when removal fails", async () => {
      mockLockManager.unlockSkill.mockImplementation(() => {
        throw new Error("Not found");
      });

      const result = await api.remove("nonexistent:skill");

      expect(result).toBe(false);
    });

    it("throws on empty identifier", async () => {
      await expect(api.remove("")).rejects.toThrow("identifier is required");
    });
  });

  /* -------------------------------------------------------------- */
  /*  checkUpdates()                                                 */
  /* -------------------------------------------------------------- */

  describe("checkUpdates", () => {
    it("returns updates for locked skills", async () => {
      mockLockManager.getLockedSkills.mockReturnValue([mockLockedSkill]);
      mockChangelogTracker.hasBreakingChanges.mockReturnValue(false);

      const mockAdapter = {
        getSkillInfo: vi.fn().mockResolvedValue(mockSearchResult),
      };
      mockRegistry.getMarketplace.mockReturnValue(mockAdapter);

      const result = await api.checkUpdates();

      expect(result).toHaveLength(1);
      expect(result[0].identifier).toBe("lobehub:pdf-tools");
      expect(result[0].breaking).toBe(false);
    });

    it("returns empty array when no skills locked", async () => {
      mockLockManager.getLockedSkills.mockReturnValue([]);

      const result = await api.checkUpdates();

      expect(result).toEqual([]);
    });

    it("skips skills with unavailable marketplace", async () => {
      mockLockManager.getLockedSkills.mockReturnValue([mockLockedSkill]);
      mockRegistry.getMarketplace.mockReturnValue(undefined);

      const result = await api.checkUpdates();

      expect(result).toEqual([]);
    });

    it("detects breaking changes", async () => {
      mockLockManager.getLockedSkills.mockReturnValue([mockLockedSkill]);
      mockChangelogTracker.hasBreakingChanges.mockReturnValue(true);

      const mockAdapter = {
        getSkillInfo: vi.fn().mockResolvedValue(mockSearchResult),
      };
      mockRegistry.getMarketplace.mockReturnValue(mockAdapter);

      const result = await api.checkUpdates();

      expect(result[0].breaking).toBe(true);
    });
  });

  /* -------------------------------------------------------------- */
  /*  plan()                                                         */
  /* -------------------------------------------------------------- */

  describe("plan", () => {
    it("returns all plans when no stack specified", async () => {
      mockPlanComposer.getAvailablePlans.mockReturnValue([mockPlanMeta]);

      const result = await api.plan();

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe("nextjs-prisma");
      expect(result[0].name).toBe("Next.js + Prisma");
    });

    it("filters plans by stack", async () => {
      const mockPlan = {
        ...mockPlanMeta,
        skills: [{ query: "next.js", reason: "React/Next.js", category: "frontend" }],
      };
      mockPlanComposer.composePlan.mockReturnValue([mockPlan]);

      const result = await api.plan("nextjs");

      expect(result).toHaveLength(1);
      expect(result[0].skills).toContain("next.js");
    });

    it("returns empty array when no plans match", async () => {
      mockPlanComposer.composePlan.mockReturnValue([]);

      const result = await api.plan("nonexistent-stack");

      expect(result).toEqual([]);
    });
  });
});
