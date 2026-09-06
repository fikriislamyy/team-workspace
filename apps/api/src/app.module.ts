import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller.js";
import { StorageModule } from "./storage/storage.module.js";
import { UploadsModule } from "./uploads/uploads.module.js";
import { AppService } from "./app.service.js";
import { AuthModule } from "./auth/auth.module.js";
import { EventsModule } from "./events/events.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { PresenceModule } from "./presence/presence.module.js";
import { RedisModule } from "./redis/redis.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    AuthModule,
    PresenceModule,
    EventsModule,
    StorageModule,
    UploadsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }