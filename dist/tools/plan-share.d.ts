import { z } from "zod";
export declare const exportPlanTool: {
    description: string;
    args: {
        planKey: z.ZodString;
    };
    execute(args: {
        planKey: string;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<import("@opencode-ai/plugin").ToolResult>;
};
export declare const importPlanTool: {
    description: string;
    args: {
        json: z.ZodString;
    };
    execute(args: {
        json: string;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<import("@opencode-ai/plugin").ToolResult>;
};
//# sourceMappingURL=plan-share.d.ts.map