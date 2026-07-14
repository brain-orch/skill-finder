import { SkillPlanComposer } from "../../composer/skill-plan.js";
import { BOLD, RESET, SEP } from "../format.js";
export async function handlePlan() {
    const composer = new SkillPlanComposer();
    const plans = composer.getAvailablePlans();
    if (plans.length === 0) {
        process.stdout.write("No skill plans available.\n");
        return;
    }
    process.stdout.write(`${BOLD}Available Skill Plans${RESET}\n`);
    process.stdout.write(`${SEP}\n\n`);
    for (const plan of plans) {
        process.stdout.write(`${BOLD}${plan.key}${RESET} \u2014 ${plan.name}\n`);
        process.stdout.write(`  ${plan.description}\n`);
        process.stdout.write(`  Categories: ${plan.matchCategories.join(", ")}\n`);
        process.stdout.write(`\n`);
    }
    process.stdout.write(`${BOLD}Total: ${plans.length} plan(s)${RESET}\n`);
}
//# sourceMappingURL=plan.js.map