import type { SkillPlan, SkillPlanSkill } from "./skill-plan.js";

// ── Export Format ──────────────────────────────────────────

const CURRENT_VERSION = 1;
const EXPORTER = "skill-finder";

export interface PlanExportFormat {
  version: number;
  key: string;
  name: string;
  description: string;
  matchCategories: string[];
  skills: SkillPlanSkill[];
  exportedAt: string;
  exporter: string;
}

// ── Validation Helpers ─────────────────────────────────────

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isSkillArray(value: unknown): value is SkillPlanSkill[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      isString((item as Record<string, unknown>).query) &&
      isString((item as Record<string, unknown>).reason),
  );
}

// ── Serializer Class ───────────────────────────────────────

export class PlanSerializer {
  /**
   * Export a SkillPlan to a JSON string with metadata.
   */
  exportPlan(plan: SkillPlan): string {
    const exportData: PlanExportFormat = {
      version: CURRENT_VERSION,
      key: plan.key,
      name: plan.name,
      description: plan.description,
      matchCategories: plan.matchCategories,
      skills: plan.skills.map((s) => ({
        query: s.query,
        reason: s.reason,
        ...(s.category !== undefined ? { category: s.category } : {}),
      })),
      exportedAt: new Date().toISOString(),
      exporter: EXPORTER,
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import a SkillPlan from a JSON string.
   * Validates required fields and version compatibility.
   * Throws if JSON is invalid, version is unsupported, or required fields are missing.
   */
  importPlan(json: string): SkillPlan {
    let parsed: unknown;

    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error("Invalid JSON: could not parse plan data");
    }

    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("Invalid plan: root must be an object");
    }

    const data = parsed as Record<string, unknown>;

    // Version check
    if (!("version" in data)) {
      throw new Error("Invalid plan: missing required field 'version'");
    }
    if (data.version !== CURRENT_VERSION) {
      throw new Error(`Unsupported plan version: ${data.version} (expected ${CURRENT_VERSION})`);
    }

    // Required fields
    if (!isString(data.key)) {
      throw new Error("Invalid plan: missing or invalid required field 'key'");
    }
    if (!isString(data.name)) {
      throw new Error("Invalid plan: missing or invalid required field 'name'");
    }
    if (!isString(data.description)) {
      throw new Error("Invalid plan: missing or invalid required field 'description'");
    }
    if (!isStringArray(data.matchCategories)) {
      throw new Error("Invalid plan: missing or invalid required field 'matchCategories'");
    }
    if (!isSkillArray(data.skills)) {
      throw new Error("Invalid plan: missing or invalid required field 'skills'");
    }

    return {
      key: data.key,
      name: data.name,
      description: data.description,
      matchCategories: data.matchCategories,
      skills: data.skills,
    };
  }
}
