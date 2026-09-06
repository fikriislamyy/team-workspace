import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { PresenceModule } from "../presence/presence.module.js";
import { EventsGateway } from "./events.gateway.js";

@Module({
    imports: [AuthModule, PresenceModule],
    providers: [EventsGateway],
})
export class EventsModule { }