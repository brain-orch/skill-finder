import { z } from "zod";
export declare const infoTool: {
    description: string;
    args: {
        identifier: z.ZodString;
    };
    execute(args: {
        identifier: string;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<import("@opencode-ai/plugin").ToolResult>;
};
//# sourceMappingURL=info.d.ts.map