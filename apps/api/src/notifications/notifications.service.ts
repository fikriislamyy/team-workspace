import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Redis } from "ioredis";
import type { MessageDto } from "@team-workspace/shared";
import { REDIS_MAIN } from "../redis/redis.module.js";
import { ChannelsService } from "../channels/channels.service.js";
import { PresenceService } from "../presence/presence.service.js";
import { PushService } from "./push.service.js";

/** Seconds between pushes for the same user + channel. */
const COOLDOWN = 20;

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);

    constructor(
        @Inject(REDIS_MAIN) private readonly redis: Redis,
        private readonly channels: ChannelsService,
        private readonly presence: PresenceService,
        private readonly push: PushService,
    ) { }

    async notifyNewMessage(
        orgId: string,
        channelName: string,
        message: MessageDto,
    ): Promise<void> {
        const memberIds = await this.channels.members(message.channelId);
        const authorId = message.author?.id;

        this.logger.debug(
            `notify channel=${message.channelId} author=${authorId ?? "none"} members=[${memberIds.join(",")}]`,
        );

        const preview =
            message.body?.trim() ||
            (message.attachments?.[0]?.mimeType.startsWith("image/")
                ? "📷 Photo"
                : "📄 Attachment");

        await Promise.all(
            memberIds.map(async (userId) => {
                if (userId === authorId) {
                    this.logger.debug(`skip ${userId}: is author`);
                    return;
                }

                if (!(await this.shouldNotify(userId, message.channelId))) return;

                this.logger.debug(`push -> ${userId}`);
                await this.push.sendToUser(userId, {
                    title: channelName,
                    body: `${message.author?.name ?? "Someone"}: ${preview}`,
                    tag: message.channelId,
                    url: `/?channel=${message.channelId}`,
                });
            }),
        );
    }

    private async shouldNotify(
        userId: string,
        channelId: string,
    ): Promise<boolean> {
        // Already looking at this exact channel with the tab visible.
        const focus = await this.presence.getFocus(userId);
        if (focus === channelId) {
            this.logger.debug(`skip ${userId}: focused on this channel`);
            return false;
        }

        // Rate limit per user + channel. SET NX EX is atomic, so two messages
        // arriving simultaneously can't both win.
        const key = `pushed:${userId}:${channelId}`;
        const won = await this.redis.set(key, "1", "EX", COOLDOWN, "NX");
        if (!won) {
            this.logger.debug(`skip ${userId}: cooldown active`);
            return false;
        }

        return true;
    }
}