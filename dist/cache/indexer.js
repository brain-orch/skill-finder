import Database from "better-sqlite3";
import * as fs from "node:fs";
import * as path from "node:path";
import { INSERT_OR_REPLACE_SKILL, SEARCH_SKILLS_WITH_FTS, MARK_SKILL_USED, GET_SKILL_FRESHNESS, REMOVE_SKILL_FROM_INDEX, GET_SKILL_STATS, CREATE_SKILLS_TABLE_SQL, CREATE_SKILLS_FTS_TABLE_SQL, CREATE_SKILLS_AI_TRIGGER_SQL, CREATE_SKILLS_AD_TRIGGER_SQL, CREATE_SKILLS_AU_TRIGGER_SQL, } from "./indexer-sql.js";
import { sanitizeFTS5 } from "./fts5-utils.js";
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
        const stmt = this.db.prepare(INSERT_OR_REPLACE_SKILL);
        stmt.run(skill.id, skill.name, skill.description, skill.marketplace, skill.category, JSON.stringify(skill.triggers), skill.installCount, skill.stars, skill.filePath, skill.installedAt, skill.lastUsed, skill.useCount, skill.skillHash);
    }
    searchLocal(query, limit = 10) {
        if (!this.db) {
            throw new Error("Database not initialized. Call init() first.");
        }
        const sanitizedQuery = sanitizeFTS5(query);
        if (!sanitizedQuery) {
            return [];
        }
        const stmt = this.db.prepare(SEARCH_SKILLS_WITH_FTS);
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
        const stmt = this.db.prepare(MARK_SKILL_USED);
        stmt.run(identifier);
    }
    getFreshness(identifiers) {
        if (!this.db) {
            throw new Error("Database not initialized. Call init() first.");
        }
        const map = new Map();
        if (identifiers.length === 0)
            return map;
        const stmt = this.db.prepare(GET_SKILL_FRESHNESS);
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
        const stmt = this.db.prepare(REMOVE_SKILL_FROM_INDEX);
        stmt.run(identifier);
    }
    getStats() {
        if (!this.db) {
            throw new Error("Database not initialized. Call init() first.");
        }
        const stmt = this.db.prepare(GET_SKILL_STATS);
        return stmt.all();
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
        this.db.exec(CREATE_SKILLS_TABLE_SQL);
        // Create FTS5 virtual table
        this.db.exec(CREATE_SKILLS_FTS_TABLE_SQL);
        // Create sync triggers
        this.db.exec(CREATE_SKILLS_AI_TRIGGER_SQL);
        this.db.exec(CREATE_SKILLS_AD_TRIGGER_SQL);
        this.db.exec(CREATE_SKILLS_AU_TRIGGER_SQL);
    }
}
//# sourceMappingURL=indexer.js.map