import { Body, Controller, Delete, Get, Post, UseGuards } from "@nestjs/common";
import { IsOptional, IsString } from "class-validator";
import type { AuthedUser } from "@team-workspace/shared";
import { AuthGuard, CurrentUser } from "../auth/auth.guard.js";
import { PrismaService } from "../prisma/prisma.service.js";

class SubscribeDto {
    @IsString() endpoint!: string;
    @IsString() p256dh!: string;
    @IsString() auth!: string;
    @IsOptional() @IsString() userAgent?: string;
}

class UnsubscribeDto {
    @IsString() endpoint!: string;
}

@Controller("notifications")
export class NotificationsController {
    constructor(private readonly prisma: PrismaService) { }

    @Get("vapid-key")
    vapidKey() {
        return { publicKey: process.env.VAPID_PUBLIC_KEY ?? null };
    }

    @Post("subscribe")
    @UseGuards(AuthGuard)
    async subscribe(@CurrentUser() user: AuthedUser, @Body() dto: SubscribeDto) {
        await this.prisma.device.upsert({
            where: { endpoint: dto.endpoint },
            create: {
                userId: user.id,
                endpoint: dto.endpoint,
                p256dh: dto.p256dh,
                auth: dto.auth,
                userAgent: dto.userAgent,
            },
            // Endpoints can be reassigned between users on shared devices.
            update: { userId: user.id, p256dh: dto.p256dh, auth: dto.auth },
        });

        return { ok: true };
    }

    @Delete("subscribe")
    @UseGuards(AuthGuard)
    async unsubscribe(@Body() dto: UnsubscribeDto) {
        await this.prisma.device
            .delete({ where: { endpoint: dto.endpoint } })
            .catch(() => { });
        return { ok: true };
    }
}
