import { z } from "zod";
export declare const planTool: {
    description: string;
    args: {
        stacks: z.ZodOptional<z.ZodString>;
        planKey: z.ZodOptional<z.ZodString>;
    };
    execute(args: {
        stacks?: string | undefined;
        planKey?: string | undefined;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<import("@opencode-ai/plugin").ToolResult>;
};
export declare const listPlansTool: {
    description: string;
    args: {};
    execute(args: Record<string, never>, context: import("@opencode-ai/plugin").ToolContext): Promise<import("@opencode-ai/plugin").ToolResult>;
};
//# sourceMappingURL=plan.d.ts.map