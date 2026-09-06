import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import type { INestApplicationContext } from "@nestjs/common";
import { Redis } from "ioredis";
import type { Server, ServerOptions } from "socket.io";

export class RedisIoAdapter extends IoAdapter {
    private adapterConstructor?: ReturnType<typeof createAdapter>;

    constructor(app: INestApplicationContext) {
        super(app);
    }

    async connectToRedis(): Promise<void> {
        const url = process.env.REDIS_URL ?? "redis://localhost:6380";
        const pubClient = new Redis(url);
        const subClient = pubClient.duplicate();
        this.adapterConstructor = createAdapter(pubClient, subClient);
    }

    createIOServer(port: number, options?: ServerOptions): Server {
        const server = super.createIOServer(port, {
            ...options,
            cors: {
                origin: process.env.CORS_ORIGIN?.split(",") ?? true,
                credentials: true,
            },
            // Skip HTTP long-polling so no sticky sessions are needed at the LB.
            transports: ["websocket"],
        } as ServerOptions) as Server;

        if (this.adapterConstructor) {
            server.adapter(this.adapterConstructor);
        }

        return server;
    }
}