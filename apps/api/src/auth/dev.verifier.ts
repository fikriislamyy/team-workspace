import { Injectable } from "@nestjs/common";
import { SignJWT, jwtVerify } from "jose";
import type { AuthedUser } from "@team-workspace/shared";
import { InvalidTokenError, type TokenVerifier } from "./token-verifier.js";

@Injectable()
export class DevVerifier implements TokenVerifier {
    private readonly secret = new TextEncoder().encode(
        process.env.DEV_JWT_SECRET ?? "insecure-dev-secret",
    );

    async sign(user: AuthedUser): Promise<string> {
        return new SignJWT({
            org_id: user.orgId,
            name: user.name,
            email: user.email,
            avatar_url: user.avatarUrl,
        })
            .setProtectedHeader({ alg: "HS256" })
            .setSubject(user.id)
            .setIssuedAt()
            .setExpirationTime("7d")
            .sign(this.secret);
    }

    async verify(token: string): Promise<AuthedUser> {
        try {
            const { payload } = await jwtVerify(token, this.secret);

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