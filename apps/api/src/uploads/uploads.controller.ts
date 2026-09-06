import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { IsInt, IsString, Length, Max, Min } from "class-validator";
import type { AuthedUser } from "@team-workspace/shared";
import { AuthGuard, CurrentUser } from "../auth/auth.guard.js";
import { ChannelsService } from "../channels/channels.service.js";
import { StorageService } from "../storage/storage.service.js";

class SignUploadDto {
    @IsString() channelId!: string;
    @IsString() @Length(1, 255) filename!: string;
    @IsString() @Length(1, 128) mimeType!: string;
    @IsInt() @Min(1) @Max(25 * 1024 * 1024) sizeBytes!: number;
}

@Controller("uploads")
@UseGuards(AuthGuard)
export class UploadsController {
    constructor(
        private readonly storage: StorageService,
        private readonly channels: ChannelsService,
    ) { }

    @Post("sign")
    async sign(@CurrentUser() user: AuthedUser, @Body() dto: SignUploadDto) {
        // Membership check first — no signed URL for a channel you can't post to.
        await this.channels.assertMember(user.id, dto.channelId);
        this.storage.validate(dto.mimeType, dto.sizeBytes);

        const storageKey = this.storage.buildKey(
            user.orgId,
            dto.channelId,
            dto.filename,
        );

        const { uploadUrl, expiresIn } = await this.storage.signUpload(
            storageKey,
            dto.mimeType,
        );

        return { uploadUrl, storageKey, expiresIn };
    }
}