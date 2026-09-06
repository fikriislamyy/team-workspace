import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { ChannelsModule } from "../channels/channels.module.js";
import { UploadsController } from "./uploads.controller.js";

@Module({
    imports: [AuthModule, ChannelsModule],
    controllers: [UploadsController],
})
export class UploadsModule { }