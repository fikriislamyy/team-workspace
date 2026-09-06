import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ArrayMaxSize, IsArray, IsOptional, IsString, Length } from "class-validator";
import type { AuthedUser } from "@team-workspace/shared";
import { AuthGuard, CurrentUser } from "../auth/auth.guard.js";
import { ChannelsService } from "./channels.service.js";

class CreateChannelDto {
    @IsString() @Length(1, 80) name!: string;

    @IsOptional() @IsArray() @ArrayMaxSize(100)
    @IsString({ each: true })
    memberIds?: string[];
}

@Controller("channels")
@UseGuards(AuthGuard)
export class ChannelsController {
    constructor(private readonly channels: ChannelsService) { }

    @Get()
    list(@CurrentUser() user: AuthedUser) {
        return this.channels.list(user);
    }

    @Post()
    create(@CurrentUser() user: AuthedUser, @Body() dto: CreateChannelDto) {
        return this.channels.create(user, dto.name, dto.memberIds ?? []);
    }
}