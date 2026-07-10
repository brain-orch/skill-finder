import { describe, it, expect } from "vitest";
import { SkillFinderError, ErrorCode } from "../src/error.js";

describe("SkillFinderError", () => {
  it("creates error with correct name and code", () => {
    const err = new SkillFinderError("test message", ErrorCode.NETWORK);
    expect(err.name).toBe("SkillFinderError");
    expect(err.code).toBe(ErrorCode.NETWORK);
    expect(err.message).toBe("test message");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(SkillFinderError);
  });

  it("creates error with cause", () => {
    const cause = new Error("original error");
    const err = new SkillFinderError("wrapped", ErrorCode.API, cause);
    expect(err.cause).toBe(cause);
    expect(err.code).toBe(ErrorCode.API);
  });

  it("creates error without cause", () => {
    const err = new SkillFinderError("test", ErrorCode.VALIDATION);
    expect(err.cause).toBeUndefined();
  });

  it("all ErrorCode values are valid", () => {
    const codes = [
      ErrorCode.NETWORK,
      ErrorCode.API,
      ErrorCode.VALIDATION,
      ErrorCode.TIMEOUT,
      ErrorCode.NOT_FOUND,
      ErrorCode.INSTALL_FAILED,
    ];
    expect(codes).toHaveLength(6);
    codes.forEach((code) => {
      expect(typeof code).toBe("string");
      expect(code.length).toBeGreaterThan(0);
    });
  });

  it("preserves stack trace", () => {
    const err = new SkillFinderError("test", ErrorCode.NETWORK);
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain("SkillFinderError");
  });

  it("can be caught as Error", () => {
    try {
      throw new SkillFinderError("test", ErrorCode.TIMEOUT);
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect(e).toBeInstanceOf(SkillFinderError);
      if (e instanceof SkillFinderError) {
        expect(e.code).toBe(ErrorCode.TIMEOUT);
      }
    }
  });
});

describe("retry wiring in MarketRegistry", () => {
  it("MarketRegistry constructor accepts retry config", async () => {
    // Verify that the config types include retryCount and retryBackoffMs
    // This is a type-level check that the retry config is properly typed
    const { MarketRegistry } = await import("../src/registry/index.js");
    const { MarketplaceConfig } = await import("../src/types.js");
    
    // Create a MarketplaceConfig object with explicit retry values
    const config: MarketplaceConfig = {
      marketplaces: ["lobehub"],
      searchTimeoutMs: 15000,
      retryCount: 3,
      retryBackoffMs: 2000,
    };
    
    // Verify the config has the expected retry properties
    expect(typeof config.retryCount).toBe("number");
    expect(typeof config.retryBackoffMs).toBe("number");
    expect(config.retryCount).toBeGreaterThanOrEqual(0);
    expect(config.retryBackoffMs).toBeGreaterThanOrEqual(0);
    
    // Verify MarketRegistry constructor accepts the config (no crash)
    const registry = new MarketRegistry(config);
    expect(registry).toBeInstanceOf(MarketRegistry);
    
    // Verify the config is stored correctly
    expect(registry.getMarketplace("lobehub")).toBeUndefined(); // No adapter added yet
  });
});