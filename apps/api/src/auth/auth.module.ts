import { Module } from "@nestjs/common";
import { AuthService } from "./auth.service.js";
import { DevAuthController } from "./dev-auth.controller.js";
import { DevVerifier } from "./dev.verifier.js";
import { JwksVerifier } from "./jwks.verifier.js";

@Module({
    controllers: [DevAuthController],
    providers: [AuthService, DevVerifier, JwksVerifier],
    exports: [AuthService],
})
export class AuthModule { }