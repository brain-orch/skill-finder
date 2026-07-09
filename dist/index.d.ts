import type { Plugin } from "@opencode-ai/plugin";
import type { SkillFinderConfig } from "./config.js";
import { ProjectScanner } from "./scanner/project-scanner.js";
export declare function getConfig(): SkillFinderConfig;
export declare function getScanner(): ProjectScanner | null;
export declare const SkillFinderPlugin: Plugin;
export default SkillFinderPlugin;
//# sourceMappingURL=index.d.ts.map