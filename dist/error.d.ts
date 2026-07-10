export declare enum ErrorCode {
    NETWORK = "NETWORK",
    API = "API",
    VALIDATION = "VALIDATION",
    TIMEOUT = "TIMEOUT",
    NOT_FOUND = "NOT_FOUND",
    INSTALL_FAILED = "INSTALL_FAILED"
}
export declare class SkillFinderError extends Error {
    code: ErrorCode;
    cause?: unknown;
    constructor(message: string, code: ErrorCode, cause?: unknown);
}
//# sourceMappingURL=error.d.ts.map