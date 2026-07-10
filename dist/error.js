export var ErrorCode;
(function (ErrorCode) {
    ErrorCode["NETWORK"] = "NETWORK";
    ErrorCode["API"] = "API";
    ErrorCode["VALIDATION"] = "VALIDATION";
    ErrorCode["TIMEOUT"] = "TIMEOUT";
    ErrorCode["NOT_FOUND"] = "NOT_FOUND";
    ErrorCode["INSTALL_FAILED"] = "INSTALL_FAILED";
})(ErrorCode || (ErrorCode = {}));
export class SkillFinderError extends Error {
    code;
    cause;
    constructor(message, code, cause) {
        super(message);
        this.code = code;
        this.cause = cause;
        this.name = "SkillFinderError";
    }
}
//# sourceMappingURL=error.js.map