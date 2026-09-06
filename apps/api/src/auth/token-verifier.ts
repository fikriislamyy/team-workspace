import type { AuthedUser } from "@team-workspace/shared";

export interface TokenVerifier {
    verify(token: string): Promise<AuthedUser>;
}

export class InvalidTokenError extends Error {
    constructor(message = "Invalid token") {
        super(message);
        this.name = "InvalidTokenError";
    }
}