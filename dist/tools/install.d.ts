import { z } from "zod";
export declare const installTool: {
    description: string;
    args: {
        identifier: z.ZodString;
        marketplace: z.ZodString;
        confirm: z.ZodDefault<z.ZodBoolean>;
        target: z.ZodDefault<z.ZodString>;
    };
    execute(args: {
        identifier: string;
        marketplace: string;
        confirm: boolean;
        target: string;
    }, context: import("@opencode-ai/plugin").ToolContext): Promise<import("@opencode-ai/plugin").ToolResult>;
};
//# sourceMappingURL=install.d.ts.map