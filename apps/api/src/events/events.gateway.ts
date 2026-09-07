import { Logger } from "@nestjs/common";
import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    MessageBody,
    ConnectedSocket,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import type { AuthedUser, MessageDto, AttachmentInput, } from "@team-workspace/shared";
import { AuthService } from "../auth/auth.service.js";
import { PresenceService } from "../presence/presence.service.js";
import { ChannelsService } from "../channels/channels.service.js";
import { MessagesService } from "../messages/messages.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { ChannelEventsService } from "./channel-events.service.js";

type AppSocket = Socket & { data: { user: AuthedUser } };

@WebSocketGateway()
export class EventsGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger = new Logger(EventsGateway.name);

    @WebSocketServer()
    server!: Server;

    constructor(
        private readonly auth: AuthService,
        private readonly presence: PresenceService,
        private readonly channels: ChannelsService,
        private readonly messages: MessagesService,
        private readonly notifications: NotificationsService,
        private readonly prisma: PrismaService,
        private readonly channelEvents: ChannelEventsService,
    ) { }

    afterInit(server: Server): void {
        server.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth?.token as string | undefined;
                if (!token) throw new Error("Missing token");
                socket.data.user = await this.auth.authenticate(token);
                next();
            } catch (err) {
                this.logger.warn(`Rejected: ${(err as Error).message}`);
                next(new Error("unauthorized"));
            }
        });

        this.channelEvents.onChannelCreated(({ channel, memberIds }) => {
            void (async () => {
                for (const userId of memberIds) {
                    const sockets = await server.in(`user:${userId}`).fetchSockets();
                    for (const s of sockets) {
                        await s.join(`channel:${channel.id}`);
                    }
                    server.to(`user:${userId}`).emit("channel:created", channel);
                }
            })();
        });
    }

    async handleConnection(socket: AppSocket): Promise<void> {
        const { user } = socket.data;

        await socket.join(`org:${user.orgId}`);
        await socket.join(`user:${user.id}`);

        const channelIds = await this.channels.memberChannelIds(user.id);
        await Promise.all(channelIds.map((id) => socket.join(`channel:${id}`)));

        if (await this.presence.connect(user.orgId, user.id)) {
            this.server
                .to(`org:${user.orgId}`)
                .emit("presence:update", { userId: user.id, online: true });
        }

        socket.emit("presence:snapshot", {
            online: await this.presence.online(user.orgId),
        });

        this.logger.log(`Connected: ${user.name} (${user.id})`);
    }

    async handleDisconnect(socket: AppSocket): Promise<void> {
        const user = socket.data?.user;
        if (!user) return;

        await this.presence.setFocus(user.id, null);

        if (await this.presence.disconnect(user.orgId, user.id)) {
            this.server
                .to(`org:${user.orgId}`)
                .emit("presence:update", { userId: user.id, online: false });
        }
    }

    @SubscribeMessage("channel:join")
    async join(
        @ConnectedSocket() socket: AppSocket,
        @MessageBody() channelId: string,
    ): Promise<{ ok: boolean; error?: string }> {
        try {
            await this.channels.assertMember(socket.data.user.id, channelId);
            await socket.join(`channel:${channelId}`);
            return { ok: true };
        } catch {
            return { ok: false, error: "forbidden" };
        }
    }

    @SubscribeMessage("channel:leave")
    async leave(
        @ConnectedSocket() socket: AppSocket,
        @MessageBody() channelId: string,
    ): Promise<void> {
        await socket.leave(`channel:${channelId}`);
    }

    @SubscribeMessage("message:send")
    async send(
        @ConnectedSocket() socket: AppSocket,
        @MessageBody()
        body: {
            channelId: string;
            body: string;
            clientId: string;
            attachment?: AttachmentInput;
        },
    ): Promise<{ ok: boolean; message?: MessageDto; error?: string }> {
        const text = body.body?.trim() ?? "";
        if (!text && !body.attachment) return { ok: false, error: "empty" };
        if (text.length > 4000) return { ok: false, error: "too_long" };

        try {
            const message = await this.messages.send(
                socket.data.user.id,
                body.channelId,
                text,
                body.clientId,
                body.attachment,
            );

            // Broadcast to everyone in the room except the sender — the sender
            // already has it via the acknowledgement below.
            socket.to(`channel:${body.channelId}`).emit("message:new", {
                ...message,
                clientId: undefined,
            });

            const channel = await this.prisma.channel.findUnique({
                where: { id: body.channelId },
                select: { name: true },
            });

            void this.notifications
                .notifyNewMessage(
                    socket.data.user.orgId,
                    channel?.name ?? "New message",
                    message,
                )
                .catch((e) => this.logger.warn(`notify failed: ${e.message}`));

            return { ok: true, message };
        } catch (err) {
            const e = err as Error;
            this.logger.error(`message:send failed: ${e.message}`, e.stack);
            return { ok: false, error: e.message || "send_failed" };
        }
    }

    @SubscribeMessage("typing:set")
    async typing(
        @ConnectedSocket() socket: AppSocket,
        @MessageBody() body: { channelId: string; typing: boolean },
    ): Promise<void> {
        const { user } = socket.data;

        socket.to(`channel:${body.channelId}`).emit("typing:update", {
            channelId: body.channelId,
            user: { id: user.id, name: user.name, avatarUrl: user.avatarUrl },
            typing: body.typing,
        });
    }

    @SubscribeMessage("channel:read")
    async read(
        @ConnectedSocket() socket: AppSocket,
        @MessageBody() body: { channelId: string },
    ): Promise<void> {
        await this.channels.markRead(socket.data.user.id, body.channelId);
    }

    @SubscribeMessage("focus:set")
    async focus(
        @ConnectedSocket() socket: AppSocket,
        @MessageBody() body: { channelId: string | null },
    ): Promise<void> {
        this.logger.debug(
            `focus:set ${socket.data.user.id} -> ${body.channelId ?? "none"}`,
        );
        await this.presence.setFocus(socket.data.user.id, body.channelId);
    }
}