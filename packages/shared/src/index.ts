export interface AuthedUser {
    id: string;
    orgId: string;
    name: string;
    email: string;
    avatarUrl?: string;
}

export interface UserSummary {
    id: string;
    name: string;
    avatarUrl?: string;
}

export type ChannelKind = "STANDARD" | "DIRECT" | "DOCUMENT";

export interface ChannelDto {
    id: string;
    name: string;
    type: ChannelKind;
    laravelDocumentId?: string | null;
    memberCount: number;
    lastMessage?: {
        body: string;
        authorName: string | null;
        createdAt: string;
    } | null;
    unreadCount: number;
}

export interface MessageDto {
    id: string;
    channelId: string;
    kind: "TEXT" | "FILE" | "SYSTEM";
    body: string;
    createdAt: string;
    author: UserSummary | null;
    /** Echoed back so the sender can reconcile its optimistic copy. */
    clientId?: string;
}

export interface MessagePage {
    messages: MessageDto[];
    nextCursor: string | null;
}

export interface ServerToClientEvents {
    "message:new": (msg: MessageDto) => void;
    "channel:created": (channel: ChannelDto) => void;
    "typing:update": (p: {
        channelId: string;
        user: UserSummary;
        typing: boolean;
    }) => void;
    "presence:update": (p: { userId: string; online: boolean }) => void;
    "presence:snapshot": (p: { online: string[] }) => void;
}

export interface ClientToServerEvents {
    "channel:join": (
        channelId: string,
        ack: (res: { ok: boolean; error?: string }) => void,
    ) => void;
    "channel:leave": (channelId: string) => void;
    "message:send": (
        p: { channelId: string; body: string; clientId: string },
        ack: (res: { ok: boolean; message?: MessageDto; error?: string }) => void,
    ) => void;
    "typing:set": (p: { channelId: string; typing: boolean }) => void;
    "channel:read": (p: { channelId: string }) => void;
}