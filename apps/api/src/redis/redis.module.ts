import { Global, Module } from "@nestjs/common";
import { Redis } from "ioredis";

export const REDIS_PUB = Symbol("REDIS_PUB");
export const REDIS_SUB = Symbol("REDIS_SUB");
export const REDIS_MAIN = Symbol("REDIS_MAIN");

const url = () => process.env.REDIS_URL ?? "redis://localhost:6380";

@Global()
@Module({
    providers: [
        { provide: REDIS_PUB, useFactory: () => new Redis(url()) },
        { provide: REDIS_SUB, useFactory: () => new Redis(url()) },
        { provide: REDIS_MAIN, useFactory: () => new Redis(url()) },
    ],
    exports: [REDIS_PUB, REDIS_SUB, REDIS_MAIN],
})
export class RedisModule { }