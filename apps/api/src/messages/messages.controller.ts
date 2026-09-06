import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { Type } from "class-transformer";
import type { AuthedUser } from "@team-workspace/shared";
import { AuthGuard, CurrentUser } from "../auth/auth.guard.js";
import { MessagesService } from "./messages.service.js";

class HistoryQuery {
    @IsOptional() @IsString() cursor?: string;

    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
    limit?: number;
}

@Controller("channels/:channelId/messages")
@UseGuards(AuthGuard)
export class MessagesController {
    constructor(private readonly messages: MessagesService) { }

    @Get()
    history(
        @CurrentUser() user: AuthedUser,
        @Param("channelId") channelId: string,
        @Query() query: HistoryQuery,
    ) {
        return this.messages.history(user.id, channelId, query.cursor, query.limit ?? 30);
    }
}