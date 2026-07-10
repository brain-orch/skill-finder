import { describe, it, expect } from "vitest";
import { validateSlug, validateOwner } from "../src/safe-slug.js";

describe("validateSlug", () => {
  /* 1 */
  it("accepts valid slug: pdf-tools", () => {
    expect(validateSlug("pdf-tools")).toBe("pdf-tools");
  });

  /* 2 */
  it("accepts valid slug: my_skill", () => {
    expect(validateSlug("my_skill")).toBe("my_skill");
  });

  /* 3 */
  it("accepts valid slug: v1.0.0", () => {
    expect(validateSlug("v1.0.0")).toBe("v1.0.0");
  });

  /* 4 */
  it("throws on empty string", () => {
    expect(() => validateSlug("")).toThrow("Invalid slug: ");
  });

  /* 5 */
  it("throws on shell char semicolon", () => {
    expect(() => validateSlug("; rm -rf /")).toThrow("Invalid slug: ");
  });

  /* 6 */
  it("throws on shell char dollar sign", () => {
    expect(() => validateSlug("skill$danger")).toThrow("Invalid slug: ");
  });

  /* 7 */
  it("throws on shell char backtick", () => {
    expect(() => validateSlug("skill`id`")).toThrow("Invalid slug: ");
  });

  /* 8 */
  it("throws on shell char pipe", () => {
    expect(() => validateSlug("skill|cat")).toThrow("Invalid slug: ");
  });

  /* 9 */
  it("throws on shell char &&", () => {
    expect(() => validateSlug("skill&&ls")).toThrow("Invalid slug: ");
  });

  /* 10 */
  it("throws on path traversal forward slash", () => {
    expect(() => validateSlug("../../etc")).toThrow("Invalid slug: ");
  });

  /* 11 */
  it("throws on path traversal backslash", () => {
    expect(() => validateSlug("..\\win")).toThrow("Invalid slug: ");
  });

  /* 12 */
  it("throws on spaces", () => {
    expect(() => validateSlug("my skill")).toThrow("Invalid slug: ");
  });

  /* 13 */
  it("throws on null byte", () => {
    expect(() => validateSlug("skill\0name")).toThrow("Invalid slug: ");
  });

  /* 14 */
  it("throws on max length overflow (201 chars)", () => {
    const long = "a".repeat(201);
    expect(() => validateSlug(long)).toThrow("Invalid slug: ");
  });

  /* 15 */
  it("accepts max length (200 chars)", () => {
    const max = "a".repeat(200);
    expect(validateSlug(max)).toBe(max);
  });
});

describe("validateOwner", () => {
  /* 1 */
  it("accepts valid owner: alice", () => {
    expect(validateOwner("alice")).toBe("alice");
  });

  /* 2 */
  it("accepts valid owner: bot-99", () => {
    expect(validateOwner("bot-99")).toBe("bot-99");
  });

  /* 3 */
  it("accepts valid owner: user_name", () => {
    expect(validateOwner("user_name")).toBe("user_name");
  });

  /* 4 */
  it("throws on empty string", () => {
    expect(() => validateOwner("")).toThrow("Invalid owner: ");
  });

  /* 5 */
  it("throws on dots", () => {
    expect(() => validateOwner("user.name")).toThrow("Invalid owner: ");
  });

  /* 6 */
  it("throws on forward slash", () => {
    expect(() => validateOwner("user/name")).toThrow("Invalid owner: ");
  });

  /* 7 */
  it("throws on spaces", () => {
    expect(() => validateOwner("user name")).toThrow("Invalid owner: ");
  });

  /* 8 */
  it("throws on max length overflow (101 chars)", () => {
    const long = "a".repeat(101);
    expect(() => validateOwner(long)).toThrow("Invalid owner: ");
  });

  /* 9 */
  it("accepts max length (100 chars)", () => {
    const max = "a".repeat(100);
    expect(validateOwner(max)).toBe(max);
  });
});
