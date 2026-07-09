import { z } from "zod";
export declare const removeTool: {
    description: string;
    args: {
        identifier: z.ZodString;
    };
    execute(args: {
        identifier: string;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<import("@opencode-ai/plugin").ToolResult>;
};
//# sourceMappingURL=remove.d.ts.map