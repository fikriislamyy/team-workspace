import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { ChannelsModule } from "../channels/channels.module.js";
import { MessagesController } from "./messages.controller.js";
import { MessagesService } from "./messages.service.js";

@Module({
    imports: [AuthModule, ChannelsModule, StorageModule],
    controllers: [MessagesController],
    providers: [MessagesService],
    exports: [MessagesService],
})
export class MessagesModule { }