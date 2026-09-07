import { Global, Module } from "@nestjs/common";
import { Redis } from "ioredis";

export const REDIS_PUB = Symbol("REDIS_PUB");
export const REDIS_SUB = Symbol("REDIS_SUB");
export const REDIS_MAIN = Symbol("REDIS_MAIN");

const url = () => process.env.REDIS_URL ?? "redis://localhost:6380";

const makeClient = () => {
    const client = new Redis(url(), {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => Math.min(times * 200, 3000),
    });
    client.on("error", (err) => {
        console.warn(`[redis] ${err.message}`);
    });
    return client;
};

@Global()
@Module({
    providers: [
        { provide: REDIS_PUB, useFactory: makeClient },
        { provide: REDIS_SUB, useFactory: makeClient },
        { provide: REDIS_MAIN, useFactory: makeClient },
    ],
    exports: [REDIS_PUB, REDIS_SUB, REDIS_MAIN],
})
export class RedisModule { }