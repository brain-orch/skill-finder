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
export declare class SkillIndexer {
    private db;
    private dbPath;
    constructor(dbPath: string);
    init(): void;
    indexSkill(skill: IndexedSkill): void;
    searchLocal(query: string, limit?: number): IndexedSkill[];
    markUsed(identifier: string): void;
    getFreshness(identifiers: string[]): Map<string, string>;
    removeFromIndex(identifier: string): void;
    getStats(): Array<{
        marketplace: string;
        count: number;
        lastRefresh: string | null;
    }>;
    sanitizeFTS5(query: string): string;
    close(): void;
    refreshFromCache(cachedSkills: Array<{
        id: string;
        name: string;
        marketplace: string;
        filePath: string;
        installedAt: string;
        skillHash: string;
    }>): void;
    private prepareDb;
}
export declare const INSERT_OR_REPLACE_SKILL = "\n  INSERT OR REPLACE INTO skills (\n    id, name, description, marketplace, category, triggers,\n    install_count, stars, file_path, installed_at, last_used,\n    use_count, skill_hash\n  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n";
export declare const SEARCH_SKILLS_WITH_FTS = "\n  SELECT s.* FROM skills s\n  JOIN skills_fts fts ON s.rowid = fts.rowid\n  WHERE skills_fts MATCH ?\n  ORDER BY rank\n  LIMIT ?\n";
export declare const MARK_SKILL_USED = "UPDATE skills SET last_used = datetime('now'), use_count = use_count + 1 WHERE id = ?";
export declare const GET_SKILL_FRESHNESS = "SELECT id, last_used FROM skills WHERE id = ?";
export declare const REMOVE_SKILL_FROM_INDEX = "DELETE FROM skills WHERE id = ?";
export declare const GET_SKILL_STATS = "\n  SELECT marketplace, COUNT(*) as count, MAX(installed_at) as last_refresh\n  FROM skills\n  GROUP BY marketplace\n";
export declare const CREATE_SKILLS_TABLE_SQL = "\n  CREATE TABLE IF NOT EXISTS skills (\n    id          TEXT PRIMARY KEY,\n    name        TEXT NOT NULL,\n    description TEXT NOT NULL,\n    marketplace TEXT NOT NULL,\n    category    TEXT,\n    triggers    TEXT,\n    install_count INTEGER DEFAULT 0,\n    stars       REAL DEFAULT 0,\n    file_path   TEXT NOT NULL,\n    installed_at TEXT NOT NULL,\n    last_used   TEXT,\n    use_count   INTEGER DEFAULT 0,\n    skill_hash  TEXT NOT NULL\n  )\n";
export declare const CREATE_SKILLS_FTS_TABLE_SQL = "\n  CREATE VIRTUAL TABLE IF NOT EXISTS skills_fts USING fts5(\n    name, description, triggers,\n    content='skills',\n    content_rowid='rowid',\n    tokenize='porter unicode61'\n  )\n";
export declare const CREATE_SKILLS_AI_TRIGGER_SQL = "\n  CREATE TRIGGER IF NOT EXISTS skills_ai AFTER INSERT ON skills BEGIN\n    INSERT INTO skills_fts(rowid, name, description, triggers)\n    VALUES (new.rowid, new.name, new.description, new.triggers);\n  END;\n";
export declare const CREATE_SKILLS_AD_TRIGGER_SQL = "\n  CREATE TRIGGER IF NOT EXISTS skills_ad AFTER DELETE ON skills BEGIN\n    INSERT INTO skills_fts(skills_fts, rowid, name, description, triggers)\n    VALUES ('delete', old.rowid, old.name, old.description, old.triggers);\n  END;\n";
export declare const CREATE_SKILLS_AU_TRIGGER_SQL = "\n  CREATE TRIGGER IF NOT EXISTS skills_au AFTER UPDATE ON skills BEGIN\n    INSERT INTO skills_fts(skills_fts, rowid, name, description, triggers)\n    VALUES ('delete', old.rowid, old.name, old.description, old.triggers);\n    INSERT INTO skills_fts(rowid, name, description, triggers)\n    VALUES (new.rowid, new.name, new.description, new.triggers);\n  END;\n";
//# sourceMappingURL=indexer-sql.d.ts.map