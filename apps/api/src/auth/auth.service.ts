import { Injectable, Logger } from "@nestjs/common";
import type { AuthedUser } from "@team-workspace/shared";
import { PrismaService } from "../prisma/prisma.service.js";
import { DevVerifier } from "./dev.verifier.js";
import { JwksVerifier } from "./jwks.verifier.js";
import type { TokenVerifier } from "./token-verifier.js";

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);
    private readonly verifier: TokenVerifier;

    constructor(
        private readonly prisma: PrismaService,
        private readonly dev: DevVerifier,
        private readonly jwks: JwksVerifier,
    ) {
        const mode = process.env.AUTH_MODE ?? "dev";
        this.verifier = mode === "jwks" ? this.jwks : this.dev;
        this.logger.log(`Auth mode: ${mode}`);
    }

    /**
     * Verify a token and provision the user just-in-time.
     * The id comes from the identity provider and is never generated here.
     */
    async authenticate(token: string): Promise<AuthedUser> {
        const claims = await this.verifier.verify(token);

        await this.prisma.user.upsert({
            where: { id: claims.id },
            create: {
                id: claims.id,
                orgId: claims.orgId,
                name: claims.name,
                email: claims.email,
                avatarUrl: claims.avatarUrl,
            },
            update: {
                name: claims.name,
                email: claims.email,
                avatarUrl: claims.avatarUrl,
            },
        });

        return claims;
    }
}