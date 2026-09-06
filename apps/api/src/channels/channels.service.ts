import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { AuthedUser, ChannelDto } from "@team-workspace/shared";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class ChannelsService {
    constructor(private readonly prisma: PrismaService) { }

    /** Throws unless the user is a member. Every channel operation goes through this. */
    async assertMember(userId: string, channelId: string): Promise<void> {
        const membership = await this.prisma.membership.findUnique({
            where: { userId_channelId: { userId, channelId } },
        });

        if (!membership) {
            throw new ForbiddenException("Not a member of this channel");
        }
    }

    async list(user: AuthedUser): Promise<ChannelDto[]> {
        const memberships = await this.prisma.membership.findMany({
            where: { userId: user.id, channel: { archivedAt: null } },
            include: {
                channel: {
                    include: {
                        _count: { select: { members: true } },
                        messages: {
                            where: { deletedAt: null },
                            orderBy: { createdAt: "desc" },
                            take: 1,
                            include: { author: { select: { name: true } } },
                        },
                    },
                },
            },
        });

        const result = await Promise.all(
            memberships.map(async (m) => {
                const unreadCount = await this.prisma.message.count({
                    where: {
                        channelId: m.channelId,
                        deletedAt: null,
                        authorId: { not: user.id },
                        ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
                    },
                });

                const last = m.channel.messages[0];

                return {
                    id: m.channel.id,
                    name: m.channel.name,
                    type: m.channel.type,
                    laravelDocumentId: m.channel.laravelDocumentId,
                    memberCount: m.channel._count.members,
                    lastMessage: last
                        ? {
                            body: last.body,
                            authorName: last.author?.name ?? null,
                            createdAt: last.createdAt.toISOString(),
                        }
                        : null,
                    unreadCount,
                } satisfies ChannelDto;
            }),
        );

        return result.sort((a, b) => {
            const at = a.lastMessage?.createdAt ?? "";
            const bt = b.lastMessage?.createdAt ?? "";
            return bt.localeCompare(at);
        });
    }

    async create(
        user: AuthedUser,
        name: string,
        memberIds: string[] = [],
    ): Promise<ChannelDto> {
        const ids = [...new Set([user.id, ...memberIds])];

        const channel = await this.prisma.channel.create({
            data: {
                orgId: user.orgId,
                name,
                type: "STANDARD",
                members: { create: ids.map((userId) => ({ userId })) },
            },
            include: { _count: { select: { members: true } } },
        });

        return {
            id: channel.id,
            name: channel.name,
            type: channel.type,
            laravelDocumentId: channel.laravelDocumentId,
            memberCount: channel._count.members,
            lastMessage: null,
            unreadCount: 0,
        };
    }

    async markRead(userId: string, channelId: string): Promise<void> {
        await this.prisma.membership.updateMany({
            where: { userId, channelId },
            data: { lastReadAt: new Date() },
        });
    }

    async members(channelId: string): Promise<string[]> {
        const rows = await this.prisma.membership.findMany({
            where: { channelId },
            select: { userId: true },
        });
        return rows.map((r) => r.userId);
    }
}