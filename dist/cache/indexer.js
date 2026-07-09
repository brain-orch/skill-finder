import Database from "better-sqlite3";
import * as fs from "node:fs";
import * as path from "node:path";
export class SkillIndexer {
    db = null;
    dbPath;
    constructor(dbPath) {
        this.dbPath = dbPath;
    }
    init() {
        // Ensure directory exists
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        this.db = new Database(this.dbPath);
        this.prepareDb();
    }
    indexSkill(skill) {
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
        stmt.run(skill.id, skill.name, skill.description, skill.marketplace, skill.category, JSON.stringify(skill.triggers), skill.installCount, skill.stars, skill.filePath, skill.installedAt, skill.lastUsed, skill.useCount, skill.skillHash);
    }
    searchLocal(query, limit = 10) {
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
        const rows = stmt.all(sanitizedQuery, limit);
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
    markUsed(identifier) {
        if (!this.db) {
            throw new Error("Database not initialized. Call init() first.");
        }
        const stmt = this.db.prepare("UPDATE skills SET last_used = datetime('now'), use_count = use_count + 1 WHERE id = ?");
        stmt.run(identifier);
    }
    getFreshness(identifiers) {
        if (!this.db) {
            throw new Error("Database not initialized. Call init() first.");
        }
        const map = new Map();
        if (identifiers.length === 0)
            return map;
        const stmt = this.db.prepare("SELECT id, last_used FROM skills WHERE id = ?");
        for (const id of identifiers) {
            const row = stmt.get(id);
            if (row?.last_used) {
                map.set(id, row.last_used);
            }
        }
        return map;
    }
    removeFromIndex(identifier) {
        if (!this.db) {
            throw new Error("Database not initialized. Call init() first.");
        }
        const stmt = this.db.prepare("DELETE FROM skills WHERE id = ?");
        stmt.run(identifier);
    }
    getStats() {
        if (!this.db) {
            throw new Error("Database not initialized. Call init() first.");
        }
        const stmt = this.db.prepare(`
      SELECT marketplace, COUNT(*) as count, MAX(installed_at) as last_refresh
      FROM skills
      GROUP BY marketplace
    `);
        return stmt.all();
    }
    sanitizeFTS5(query) {
        // FTS5 operators to reject/remove
        const fts5Operators = ["AND", "OR", "NOT", "NEAR"];
        // Split on whitespace
        const tokens = query.split(/\s+/).filter((t) => t.length > 0);
        const sanitized = [];
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
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
    refreshFromCache(cachedSkills) {
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
    prepareDb() {
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
//# sourceMappingURL=indexer.js.map