import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { ChannelsModule } from "../channels/channels.module.js";
import { PresenceModule } from "../presence/presence.module.js";
import { NotificationsController } from "./notifications.controller.js";
import { NotificationsService } from "./notifications.service.js";
import { PushService } from "./push.service.js";

@Module({
    imports: [AuthModule, ChannelsModule, PresenceModule],
    controllers: [NotificationsController],
    providers: [NotificationsService, PushService],
    exports: [NotificationsService],
})
export class NotificationsModule { }