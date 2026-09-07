import { Injectable } from "@nestjs/common";
import { EventEmitter } from "node:events";
import type { ChannelDto } from "@team-workspace/shared";

export interface ChannelCreatedEvent {
    channel: ChannelDto;
    memberIds: string[];
}

@Injectable()
export class ChannelEventsService {
    private readonly emitter = new EventEmitter();

    emitChannelCreated(event: ChannelCreatedEvent): void {
        this.emitter.emit("channel.created", event);
    }

    onChannelCreated(handler: (event: ChannelCreatedEvent) => void): void {
        this.emitter.on("channel.created", handler);
    }
}