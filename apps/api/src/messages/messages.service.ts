import { BadRequestException, Injectable } from "@nestjs/common";
import type {
    AttachmentInput,
    MessageDto,
    MessagePage,
} from "@team-workspace/shared";
import { PrismaService } from "../prisma/prisma.service.js";
import { ChannelsService } from "../channels/channels.service.js";
import { StorageService } from "../storage/storage.service.js";

@Injectable()
export class MessagesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly channels: ChannelsService,
        private readonly storage: StorageService,
    ) { }

    private async toDto(m: any, clientId?: string): Promise<MessageDto> {
        const attachments = await Promise.all(
            (m.attachments ?? []).map(async (a: any) => ({
                id: a.id,
                filename: a.filename,
                mimeType: a.mimeType,
                sizeBytes: a.sizeBytes,
                width: a.width,
                height: a.height,
                url: await this.storage.signDownload(a.storageKey, a.filename),
            })),
        );

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
            attachments: attachments.length ? attachments : undefined,
            clientId,
        };
    }

    async send(
        userId: string,
        channelId: string,
        body: string,
        clientId: string,
        attachment?: AttachmentInput,
    ): Promise<MessageDto> {
        await this.channels.assertMember(userId, channelId);

        if (attachment) {
            // Never trust the client's claim that the object exists.
            const head = await this.storage.exists(attachment.storageKey);
            if (!head) {
                throw new BadRequestException("Upload not found");
            }
            this.storage.validate(attachment.mimeType, head.size);

            // Key must belong to this channel — blocks attaching someone else's file.
            if (!attachment.storageKey.includes(`/${channelId}/`)) {
                throw new BadRequestException("Invalid storage key");
            }
        }

        const message = await this.prisma.message.create({
            data: {
                channelId,
                authorId: userId,
                kind: attachment ? "FILE" : "TEXT",
                body,
                ...(attachment
                    ? {
                        attachments: {
                            create: {
                                storageKey: attachment.storageKey,
                                filename: attachment.filename,
                                mimeType: attachment.mimeType,
                                sizeBytes: attachment.sizeBytes,
                                width: attachment.width,
                                height: attachment.height,
                            },
                        },
                    }
                    : {}),
            },
            include: {
                author: { select: { id: true, name: true, avatarUrl: true } },
                attachments: true,
            },
        });

        return this.toDto(message, clientId);
    }

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
                attachments: true,
            },
        });

        const hasMore = rows.length > limit;
        const page = hasMore ? rows.slice(0, limit) : rows;
        const messages = await Promise.all(page.map((m) => this.toDto(m)));

        return {
            messages: messages.reverse(),
            nextCursor: hasMore ? page[page.length - 1].id : null,
        };
    }
}