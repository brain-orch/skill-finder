export interface SkillSearchResult {
  id: string;                                       // Unique identifier (e.g. "lobehub:pdf-tools")
  name: string;                                     // Skill name (lowercase, hyphen-separated)
  description: string;                              // 1-1024 chars, third-person
  marketplace: "lobehub" | "skillssh" | "agentskillsh" | "skillsmp" | "mcpservers" | "awesomeskill" | "clawhub";
  category: string | null;                          // Category/tag (e.g. "pdf-processing")
  triggers: string[];                               // Keywords that trigger this skill
  installCount: number;                             // Number of installs (0 if unknown)
  stars: number;                                    // Rating/stars (0 if unknown)
  installCommand: string;                           // Exact command to install
  homepageUrl: string;                              // Marketplace page URL
  verified: boolean;                                // Marketplace-verified badge
}

export interface SkillMarketplace {
  name: string;
  search(query: string, options?: { category?: string; limit?: number; signal?: AbortSignal }): Promise<SkillSearchResult[]>;
  getSkillInfo(identifier: string): Promise<SkillSearchResult | null>;
  install(identifier: string, targetDir: string): Promise<{ path: string; files: string[] }>;
  isAvailable(): boolean;
}

export interface MarketplaceConfig {
  marketplaces: string[];          // Enabled marketplace names
  searchTimeoutMs: number;         // Default: 15000
  retryCount: number;              // Default: 2
  retryBackoffMs: number;          // Default: 1000 (exponential)
}

export interface CacheEntry {
  key: string;
  value: unknown;
  timestamp: number;
  ttl: number;
}
