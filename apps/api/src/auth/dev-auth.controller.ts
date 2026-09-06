import { Body, Controller, ForbiddenException, Post } from "@nestjs/common";
import { IsEmail, IsOptional, IsString } from "class-validator";
import { DevVerifier } from "./dev.verifier.js";

class DevLoginDto {
    @IsString() id!: string;
    @IsString() name!: string;
    @IsEmail() email!: string;
    @IsOptional() @IsString() orgId?: string;
}

@Controller("auth/dev")
export class DevAuthController {
    constructor(private readonly dev: DevVerifier) { }

    @Post("login")
    async login(@Body() dto: DevLoginDto) {
        if (process.env.NODE_ENV === "production" || process.env.AUTH_MODE !== "dev") {
            throw new ForbiddenException("Dev login is disabled");
        }

        const token = await this.dev.sign({
            id: dto.id,
            orgId: dto.orgId ?? "org_dev",
            name: dto.name,
            email: dto.email,
        });

        return { token };
    }
}