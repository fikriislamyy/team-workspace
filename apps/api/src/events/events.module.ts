import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { ChannelsModule } from "../channels/channels.module.js";
import { MessagesModule } from "../messages/messages.module.js";
import { PresenceModule } from "../presence/presence.module.js";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { EventsGateway } from "./events.gateway.js";

@Module({
    imports: [AuthModule, PresenceModule, ChannelsModule, MessagesModule, NotificationsModule],
    providers: [EventsGateway],
})
export class EventsModule { }