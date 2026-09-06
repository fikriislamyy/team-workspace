import { Injectable } from "@nestjs/common";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AuthedUser } from "@team-workspace/shared";
import { InvalidTokenError, type TokenVerifier } from "./token-verifier.js";

@Injectable()
export class JwksVerifier implements TokenVerifier {
    private readonly jwks = createRemoteJWKSet(
        new URL(process.env.LARAVEL_JWKS_URL ?? "http://localhost/jwks.json"),
        { cacheMaxAge: 10 * 60 * 1000 },
    );

    async verify(token: string): Promise<AuthedUser> {
        try {
            const { payload } = await jwtVerify(token, this.jwks, {
                issuer: process.env.LARAVEL_JWT_ISSUER,
                audience: process.env.LARAVEL_JWT_AUDIENCE,
            });

            return {
                id: String(payload.sub),
                orgId: String(payload.org_id),
                name: String(payload.name ?? "Unknown"),
                email: String(payload.email ?? ""),
                avatarUrl: payload.avatar_url as string | undefined,
            };
        } catch {
            throw new InvalidTokenError();
        }
    }
}