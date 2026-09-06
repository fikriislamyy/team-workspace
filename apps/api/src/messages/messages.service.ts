import { Injectable } from "@nestjs/common";
import type { MessageDto, MessagePage } from "@team-workspace/shared";
import { PrismaService } from "../prisma/prisma.service.js";
import { ChannelsService } from "../channels/channels.service.js";

type MessageWithAuthor = {
    id: string;
    channelId: string;
    kind: "TEXT" | "FILE" | "SYSTEM";
    body: string;
    createdAt: Date;
    author: { id: string; name: string; avatarUrl: string | null } | null;
};

@Injectable()
export class MessagesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly channels: ChannelsService,
    ) { }

    private toDto(m: MessageWithAuthor, clientId?: string): MessageDto {
        return {
            id: m.id,
            channelId: m.channelId,
            kind: m.kind,
            body: m.body,
            createdAt: m.createdAt.toISOString(),
            author: m.author
                ? {
                    id: m.author.id,
                    name: m.author.name,
                    avatarUrl: m.author.avatarUrl ?? undefined,
                }
                : null,
            clientId,
        };
    }

    async send(
        userId: string,
        channelId: string,
        body: string,
        clientId: string,
    ): Promise<MessageDto> {
        await this.channels.assertMember(userId, channelId);

        const message = await this.prisma.message.create({
            data: { channelId, authorId: userId, kind: "TEXT", body },
            include: {
                author: { select: { id: true, name: true, avatarUrl: true } },
            },
        });

        return this.toDto(message, clientId);
    }

    /** Cursor pagination — stable under inserts, unlike OFFSET. */
    async history(
        userId: string,
        channelId: string,
        cursor?: string,
        limit = 30,
    ): Promise<MessagePage> {
        await this.channels.assertMember(userId, channelId);

        const rows = await this.prisma.message.findMany({
            where: { channelId, deletedAt: null },
            orderBy: { createdAt: "desc" },
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            include: {
                author: { select: { id: true, name: true, avatarUrl: true } },
            },
        });

        const hasMore = rows.length > limit;
        const page = hasMore ? rows.slice(0, limit) : rows;

        return {
            // Reverse so the caller gets oldest-first for rendering.
            messages: page.map((m) => this.toDto(m)).reverse(),
            nextCursor: hasMore ? page[page.length - 1].id : null,
        };
    }
}