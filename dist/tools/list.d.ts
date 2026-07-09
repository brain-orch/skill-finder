import { z } from "zod";
export declare const listTool: {
    description: string;
    args: {
        marketplace: z.ZodOptional<z.ZodString>;
        category: z.ZodOptional<z.ZodString>;
    };
    execute(args: {
        marketplace?: string | undefined;
        category?: string | undefined;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<import("@opencode-ai/plugin").ToolResult>;
};
//# sourceMappingURL=list.d.ts.map