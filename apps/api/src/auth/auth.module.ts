import { Module } from "@nestjs/common";
import { AuthGuard } from "./auth.guard.js";
import { AuthService } from "./auth.service.js";
import { DevAuthController } from "./dev-auth.controller.js";
import { DevVerifier } from "./dev.verifier.js";
import { JwksVerifier } from "./jwks.verifier.js";

@Module({
    controllers: [DevAuthController],
    providers: [AuthGuard, AuthService, DevVerifier, JwksVerifier],
    exports: [AuthService, AuthGuard],
})
export class AuthModule { }