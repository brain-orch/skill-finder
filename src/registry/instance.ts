import { MarketRegistry } from "./index.js";
import { LobeHubMarketplace } from "./adapters/lobehub-adapter.js";
import { SkillShMarketplace } from "./adapters/skillssh-adapter.js";
import { AgentSkillsMarketplace } from "./adapters/agentskillsh-adapter.js";
import { SkillsMPMarketplace } from "./adapters/skillsmp-adapter.js";
import { ClawHubMarketplace } from "./adapters/clawhub-adapter.js";
import { MCPServersMarketplace } from "./adapters/mcpservers-adapter.js";
import { AwesomeSkillMarketplace } from "./adapters/awesomeskill-adapter.js";
import { HuggingFaceMarketplace } from "./adapters/huggingface-adapter.js";
import type { MarketplaceConfig } from "../types.js";

const config: MarketplaceConfig = {
  marketplaces: ["lobehub", "skillssh", "agentskillsh", "skillsmp", "clawhub", "mcpservers", "awesomeskill", "huggingface"],
  searchTimeoutMs: 15_000,
  retryCount: 2,
  retryBackoffMs: 1_000,
};

const registry = new MarketRegistry(config);
registry.addAdapter(new LobeHubMarketplace());
registry.addAdapter(new SkillShMarketplace());
registry.addAdapter(new AgentSkillsMarketplace());
registry.addAdapter(new SkillsMPMarketplace());
registry.addAdapter(new ClawHubMarketplace());
registry.addAdapter(new MCPServersMarketplace());
registry.addAdapter(new AwesomeSkillMarketplace());
registry.addAdapter(new HuggingFaceMarketplace());

export { registry as marketplaceRegistry };
export { config as defaultMarketplaceConfig };
