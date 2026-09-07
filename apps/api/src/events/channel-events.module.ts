import { Global, Module } from "@nestjs/common";
import { ChannelEventsService } from "./channel-events.service.js";

@Global()
@Module({
    providers: [ChannelEventsService],
    exports: [ChannelEventsService],
})
export class ChannelEventsModule { }