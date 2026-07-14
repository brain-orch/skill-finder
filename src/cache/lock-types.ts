export interface LockMetadata {
  installedAt: string; // ISO date
  version?: string; // version string if available
  marketplace: string;
  versionRange?: string; // Semver range (e.g., "^1.0.0", ">=2.0.0 <3.0.0")
  changelog?: string; // URL or "unknown"
  breaking?: boolean; // Whether latest update is breaking
  dependencies?: string[]; // Skill IDs this skill depends on
}

export interface LockedSkill {
  identifier: string;
  installedAt: string;
  contentHash: string; // "sha256-<hex>"
  version?: string;
  marketplace: string;
  lastChecked: string; // ISO date
  targets: string[]; // Relative paths where skill is installed (e.g., [".opencode/skills", ".claude/skills"])
  versionRange?: string; // Semver range (e.g., "^1.0.0", ">=2.0.0 <3.0.0")
  changelog?: string; // URL or "unknown"
  breaking?: boolean; // Whether latest update is breaking
  dependencies?: string[]; // Skill IDs this skill depends on
}

export interface UpdateCheckResult {
  identifier: string;
  hasUpdate: boolean;
  currentHash: string;
  newHash?: string;
  checkedAt: string;
  breaking?: boolean;
}

export interface LockfileData {
  version: number;
  skills: Record<string, LockedSkill>;
}