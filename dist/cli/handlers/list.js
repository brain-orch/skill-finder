import * as fs from "node:fs";
import * as path from "node:path";
import { detectActiveAgents, AGENT_TARGETS } from "../../installer/agent-targets.js";
import { BOLD, RESET } from "../format.js";
import { readSkillsFromDir } from "../utils.js";
export async function handleList(positional) {
    const marketplace = positional[0]?.trim() || undefined;
    const projectRoot = process.cwd();
    const activeAgents = detectActiveAgents(projectRoot);
    if (activeAgents.length === 0) {
        activeAgents.push("opencode");
    }
    let total = 0;
    const lines = [];
    for (const agent of activeAgents) {
        const agentInfo = AGENT_TARGETS[agent];
        const agentDir = path.join(projectRoot, agentInfo.dir);
        if (!fs.existsSync(agentDir))
            continue;
        const skills = readSkillsFromDir(agentDir, marketplace);
        if (skills.length === 0)
            continue;
        lines.push(`${BOLD}${agent} (${agentInfo.dir}) \u2014 ${skills.length} installed${RESET}`);
        for (const skill of skills) {
            const desc = skill.description ? ` \u2014 ${skill.description}` : "";
            lines.push(`  ${skill.name}${desc}`);
            total++;
        }
        lines.push("");
    }
    if (total === 0) {
        process.stdout.write("No skills installed. Use 'skill-finder install' to add one.\n");
        return;
    }
    lines.push(`${BOLD}Total: ${total} skills installed${RESET}`);
    process.stdout.write(lines.join("\n") + "\n");
}
//# sourceMappingURL=list.js.map