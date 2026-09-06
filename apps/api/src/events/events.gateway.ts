import { Logger } from "@nestjs/common";
import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import type { AuthedUser } from "@team-workspace/shared";
import { AuthService } from "../auth/auth.service.js";
import { PresenceService } from "../presence/presence.service.js";

interface SocketData {
    user: AuthedUser;
}

type AppSocket = Socket & { data: SocketData };

@WebSocketGateway()
export class EventsGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger = new Logger(EventsGateway.name);

    @WebSocketServer()
    server!: Server;

    constructor(
        private readonly auth: AuthService,
        private readonly presence: PresenceService,
    ) { }

    afterInit(server: Server): void {
        server.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth?.token as string | undefined;
                if (!token) {
                    throw new Error("Missing token");
                }

                const user = await this.auth.authenticate(token);
                socket.data.user = user;
                next();
            } catch (err) {
                this.logger.warn(`Rejected connection: ${(err as Error).message}`);
                next(new Error("unauthorized"));
            }
        });
    }

    async handleConnection(socket: AppSocket): Promise<void> {
        const { user } = socket.data;

        await socket.join(`org:${user.orgId}`);
        await socket.join(`user:${user.id}`);

        const becameOnline = await this.presence.connect(user.orgId, user.id);
        if (becameOnline) {
            this.server
                .to(`org:${user.orgId}`)
                .emit("presence:update", { userId: user.id, online: true });
        }

        const online = await this.presence.online(user.orgId);
        socket.emit("presence:snapshot", { online });

        this.logger.log(`Connected: ${user.name} (${user.id})`);
    }

    async handleDisconnect(socket: AppSocket): Promise<void> {
        const user = socket.data?.user;
        if (!user) return;

        const wentOffline = await this.presence.disconnect(user.orgId, user.id);
        if (wentOffline) {
            this.server
                .to(`org:${user.orgId}`)
                .emit("presence:update", { userId: user.id, online: false });
        }

        this.logger.log(`Disconnected: ${user.name}`);
    }

    @SubscribeMessage("ping")
    handlePing(): { pong: true; at: string } {
        return { pong: true, at: new Date().toISOString() };
    }
}