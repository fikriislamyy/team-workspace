import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import webpush from "web-push";
import { PrismaService } from "../prisma/prisma.service.js";

export interface PushPayload {
    title: string;
    body: string;
    /** Collapses repeat notifications in the tray — one per channel. */
    tag: string;
    url: string;
}

@Injectable()
export class PushService implements OnModuleInit {
    private readonly logger = new Logger(PushService.name);
    private enabled = false;

    constructor(private readonly prisma: PrismaService) { }

    onModuleInit(): void {
        const publicKey = process.env.VAPID_PUBLIC_KEY;
        const privateKey = process.env.VAPID_PRIVATE_KEY;

        if (!publicKey || !privateKey) {
            this.logger.warn("VAPID keys missing — push notifications disabled");
            return;
        }

        webpush.setVapidDetails(
            process.env.VAPID_SUBJECT ?? "mailto:admin@example.com",
            publicKey,
            privateKey,
        );
        this.enabled = true;
        this.logger.log("Push notifications enabled");
    }

    async sendToUser(userId: string, payload: PushPayload): Promise<void> {
        if (!this.enabled) return;

        const devices = await this.prisma.device.findMany({ where: { userId } });

        if (devices.length === 0) {
            this.logger.debug(`No subscriptions for user ${userId}`);
            return;
        }

        await Promise.all(
            devices.map(async (d) => {
                try {
                    await webpush.sendNotification(
                        {
                            endpoint: d.endpoint,
                            keys: { p256dh: d.p256dh, auth: d.auth },
                        },
                        JSON.stringify(payload),
                        { TTL: 3600, urgency: "high" },
                    );
                } catch (err) {
                    const e = err as { statusCode?: number; message?: string };

                    // 404/410 mean the browser dropped the subscription. Prune it,
                    // or the table fills with dead endpoints you retry forever.
                    if (e.statusCode === 404 || e.statusCode === 410) {
                        await this.prisma.device
                            .delete({ where: { id: d.id } })
                            .catch(() => { });
                        this.logger.log(`Pruned expired subscription for user ${userId}`);
                    } else {
                        this.logger.warn(
                            `Push failed for user ${userId}: ${e.statusCode} ${e.message}`,
                        );
                    }
                }
            }),
        );
    }
}