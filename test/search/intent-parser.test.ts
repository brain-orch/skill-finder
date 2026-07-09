import { describe, it, expect, beforeEach } from "vitest";
import { IntentParser } from "../../src/search/intent-parser.js";
import type { ParsedIntent } from "../../src/search/intent-parser.js";

describe("IntentParser", () => {
  let parser: IntentParser;

  beforeEach(() => {
    parser = new IntentParser();
  });

  // -------------------------------------------------------------------------
  // Core parsing
  // -------------------------------------------------------------------------

  describe("parse", () => {
    it("detects pdf-processing from 'pdf extract text'", () => {
      const result: ParsedIntent = parser.parse("pdf extract text");
      expect(result.categories).toContain("pdf-processing");
      expect(result.categories).toContain("document");
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.primaryIntent).toBe("pdf-processing");
    });

    it("detects spreadsheet category from 'edit this spreadsheet'", () => {
      const result = parser.parse("edit this spreadsheet");
      expect(result.categories).toContain("spreadsheet");
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it("detects multiple categories for mixed input", () => {
      const result = parser.parse("deploy the PDF generator");
      expect(result.categories).toContain("pdf-processing");
      expect(result.categories).toContain("deployment");
      expect(result.categories.length).toBeGreaterThanOrEqual(2);
    });

    it("expands query with synonyms for matched categories", () => {
      const result = parser.parse("pdf extract text");
      // Should include original query plus synonyms like "ocr", "document"
      expect(result.expandedQueries).toContain("pdf extract text");
      expect(result.expandedQueries.length).toBeGreaterThan(1);
      // Synonyms should include terms not in original query
      const hasExtraTerms = result.expandedQueries.some(
        (q) => q !== "pdf extract text",
      );
      expect(hasExtraTerms).toBe(true);
    });

    it("returns empty ParsedIntent for empty string", () => {
      const result = parser.parse("");
      expect(result.categories).toEqual([]);
      expect(result.expandedQueries).toEqual([]);
      expect(result.confidence).toBe(0);
      expect(result.primaryIntent).toBe("");
    });

    it("returns empty ParsedIntent for null/undefined input", () => {
      const result = parser.parse(null as unknown as string);
      expect(result.categories).toEqual([]);
      expect(result.confidence).toBe(0);
    });

    it("returns empty ParsedIntent for whitespace-only input", () => {
      const result = parser.parse("   \t\n  ");
      expect(result.categories).toEqual([]);
      expect(result.confidence).toBe(0);
      expect(result.expandedQueries).toEqual([]);
    });

    it("returns empty ParsedIntent for stop-words only", () => {
      const result = parser.parse("a an the is are was");
      expect(result.categories).toEqual([]);
      expect(result.confidence).toBe(0);
      expect(result.expandedQueries).toEqual([]);
    });

    it("returns empty categories for unmatched query", () => {
      const result = parser.parse("hello world");
      expect(result.categories).toEqual([]);
      expect(result.confidence).toBe(0);
      // Should still return original query as expansion
      expect(result.expandedQueries).toContain("hello world");
    });

    it("detects git-workflows from 'commit and push'", () => {
      const result = parser.parse("commit and push");
      expect(result.categories).toContain("git-workflows");
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("detects testing from 'write unit test'", () => {
      const result = parser.parse("write unit test");
      expect(result.categories).toContain("testing");
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("detects database from 'postgres query optimization'", () => {
      const result = parser.parse("postgres query optimization");
      expect(result.categories).toContain("database");
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("boosts confidence with multiple category matches", () => {
      const single = parser.parse("pdf");
      const multi = parser.parse("pdf extract text");
      // Multi-word should have >= confidence due to category overlap
      expect(multi.confidence).toBeGreaterThanOrEqual(single.confidence);
    });
  });
});
