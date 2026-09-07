import { Inject, Injectable } from "@nestjs/common";
import type { Redis } from "ioredis";
import { REDIS_MAIN } from "../redis/redis.module.js";

@Injectable()
export class PresenceService {
    constructor(@Inject(REDIS_MAIN) private readonly redis: Redis) { }

    private key(orgId: string): string {
        return `presence:${orgId}`;
    }

    /** Returns true if this is the user's first connection. */
    async connect(orgId: string, userId: string): Promise<boolean> {
        const count = await this.redis.hincrby(this.key(orgId), userId, 1);
        return count === 1;
    }

    /** Returns true if this was the user's last connection. */
    async disconnect(orgId: string, userId: string): Promise<boolean> {
        const count = await this.redis.hincrby(this.key(orgId), userId, -1);
        if (count <= 0) {
            await this.redis.hdel(this.key(orgId), userId);
            return true;
        }
        return false;
    }

    async online(orgId: string): Promise<string[]> {
        return Object.keys(await this.redis.hgetall(this.key(orgId)));
    }

    private focusKey(userId: string): string {
        return `focus:${userId}`;
    }

    /** channelId, or null when the tab is hidden or no channel is open. */
    async setFocus(userId: string, channelId: string | null): Promise<void> {
        if (channelId) {
            // TTL guards against a client that disconnects without clearing.
            await this.redis.set(this.focusKey(userId), channelId, "EX", 300);
        } else {
            await this.redis.del(this.focusKey(userId));
        }
    }

    async getFocus(userId: string): Promise<string | null> {
        return this.redis.get(this.focusKey(userId));
    }

    async isOnline(orgId: string, userId: string): Promise<boolean> {
        const count = await this.redis.hget(this.key(orgId), userId);
        return Number(count ?? 0) > 0;
    }
}