export enum ErrorCode {
  NETWORK = "NETWORK",
  API = "API",
  VALIDATION = "VALIDATION",
  TIMEOUT = "TIMEOUT",
  NOT_FOUND = "NOT_FOUND",
  INSTALL_FAILED = "INSTALL_FAILED",
}

export class SkillFinderError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "SkillFinderError";
  }
}
