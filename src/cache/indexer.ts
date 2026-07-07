import Database from "better-sqlite3";
import * as fs from "node:fs";
import * as path from "node:path";

export interface IndexedSkill {
  id: string;
  name: string;
  description: string;
  marketplace: string;
  category: string | null;
  triggers: string[];
  installCount: number;
  stars: number;
  filePath: string;
  installedAt: string;
  lastUsed: string | null;
  useCount: number;
  skillHash: string;
}

export class SkillIndexer {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  init(): void {
    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.prepareDb();
  }

  indexSkill(skill: IndexedSkill): void {
    if (!this.db) {
      throw new Error("Database not initialized. Call init() first.");
    }

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO skills (
        id, name, description, marketplace, category, triggers,
        install_count, stars, file_path, installed_at, last_used,
        use_count, skill_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      skill.id,
      skill.name,
      skill.description,
      skill.marketplace,
      skill.category,
      JSON.stringify(skill.triggers),
      skill.installCount,
      skill.stars,
      skill.filePath,
      skill.installedAt,
      skill.lastUsed,
      skill.useCount,
      skill.skillHash,
    );
  }

  searchLocal(query: string, limit: number = 10): IndexedSkill[] {
    if (!this.db) {
      throw new Error("Database not initialized. Call init() first.");
    }

    const sanitizedQuery = this.sanitizeFTS5(query);
    if (!sanitizedQuery) {
      return [];
    }

    const stmt = this.db.prepare(`
      SELECT s.* FROM skills s
      JOIN skills_fts fts ON s.rowid = fts.rowid
      WHERE skills_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `);

    const rows = stmt.all(sanitizedQuery, limit) as Array<{
      id: string;
      name: string;
      description: string;
      marketplace: string;
      category: string | null;
      triggers: string;
      install_count: number;
      stars: number;
      file_path: string;
      installed_at: string;
      last_used: string | null;
      use_count: number;
      skill_hash: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      marketplace: row.marketplace,
      category: row.category,
      triggers: JSON.parse(row.triggers || "[]"),
      installCount: row.install_count,
      stars: row.stars,
      filePath: row.file_path,
      installedAt: row.installed_at,
      lastUsed: row.last_used,
      useCount: row.use_count,
      skillHash: row.skill_hash,
    }));
  }

  removeFromIndex(identifier: string): void {
    if (!this.db) {
      throw new Error("Database not initialized. Call init() first.");
    }

    const stmt = this.db.prepare("DELETE FROM skills WHERE id = ?");
    stmt.run(identifier);
  }

  getStats(): Array<{
    marketplace: string;
    count: number;
    lastRefresh: string | null;
  }> {
    if (!this.db) {
      throw new Error("Database not initialized. Call init() first.");
    }

    const stmt = this.db.prepare(`
      SELECT marketplace, COUNT(*) as count, MAX(installed_at) as last_refresh
      FROM skills
      GROUP BY marketplace
    `);

    return stmt.all() as Array<{
      marketplace: string;
      count: number;
      lastRefresh: string | null;
    }>;
  }

  sanitizeFTS5(query: string): string {
    // FTS5 operators to reject/remove
    const fts5Operators = ["AND", "OR", "NOT", "NEAR"];

    // Split on whitespace
    const tokens = query.split(/\s+/).filter((t) => t.length > 0);

    const sanitized: string[] = [];
    for (const token of tokens) {
      const upper = token.toUpperCase();

      // Skip FTS5 operators
      if (fts5Operators.includes(upper)) {
        continue;
      }

      // Skip single * (wildcard) but keep word*
      if (token === "*") {
        continue;
      }

      // Skip parentheses
      if (token === "(" || token === ")") {
        continue;
      }

      // Escape inner " to "" then wrap in double quotes
      const escaped = token.replace(/"/g, '""');
      sanitized.push(`"${escaped}"`);
    }

    // Join with space (implicit AND in FTS5)
    return sanitized.join(" ");
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  refreshFromCache(cachedSkills: Array<{
    id: string;
    name: string;
    marketplace: string;
    filePath: string;
    installedAt: string;
    skillHash: string;
  }>): void {
    if (!this.db) {
      throw new Error("Database not initialized. Call init() first.");
    }

    // Clear existing data and re-index
    this.db.exec("DELETE FROM skills");

    for (const skill of cachedSkills) {
      this.indexSkill({
        id: skill.id,
        name: skill.name,
        description: "", // Will be populated from SKILL.md later
        marketplace: skill.marketplace,
        category: null,
        triggers: [],
        installCount: 0,
        stars: 0,
        filePath: skill.filePath,
        installedAt: skill.installedAt,
        lastUsed: null,
        useCount: 0,
        skillHash: skill.skillHash,
      });
    }
  }

  private prepareDb(): void {
    if (!this.db) {
      throw new Error("Database not initialized.");
    }

    // Enable WAL mode for better concurrent read performance
    this.db.pragma("journal_mode = WAL");

    // Enable foreign keys
    this.db.pragma("foreign_keys = ON");

    // Create main skills table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS skills (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT NOT NULL,
        marketplace TEXT NOT NULL,
        category    TEXT,
        triggers    TEXT,
        install_count INTEGER DEFAULT 0,
        stars       REAL DEFAULT 0,
        file_path   TEXT NOT NULL,
        installed_at TEXT NOT NULL,
        last_used   TEXT,
        use_count   INTEGER DEFAULT 0,
        skill_hash  TEXT NOT NULL
      )
    `);

    // Create FTS5 virtual table
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS skills_fts USING fts5(
        name, description, triggers,
        content='skills',
        content_rowid='rowid',
        tokenize='porter unicode61'
      )
    `);

    // Create sync triggers
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS skills_ai AFTER INSERT ON skills BEGIN
        INSERT INTO skills_fts(rowid, name, description, triggers)
        VALUES (new.rowid, new.name, new.description, new.triggers);
      END;
    `);

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS skills_ad AFTER DELETE ON skills BEGIN
        INSERT INTO skills_fts(skills_fts, rowid, name, description, triggers)
        VALUES ('delete', old.rowid, old.name, old.description, old.triggers);
      END;
    `);

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS skills_au AFTER UPDATE ON skills BEGIN
        INSERT INTO skills_fts(skills_fts, rowid, name, description, triggers)
        VALUES ('delete', old.rowid, old.name, old.description, old.triggers);
        INSERT INTO skills_fts(rowid, name, description, triggers)
        VALUES (new.rowid, new.name, new.description, new.triggers);
      END;
    `);
  }
}
