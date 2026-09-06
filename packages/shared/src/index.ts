export interface AuthedUser {
    id: string;
    orgId: string;
    name: string;
    email: string;
    avatarUrl?: string;
}

export interface MessageDto {
    id: string;
    channelId: string;
    authorId: string | null;
    kind: "TEXT" | "FILE" | "SYSTEM";
    body: string;
    createdAt: string;
}

export interface ServerToClientEvents {
    "message:new": (msg: MessageDto) => void;
    "channel:created": (channel: { id: string; name: string }) => void;
    "typing:update": (p: { channelId: string; userId: string; typing: boolean }) => void;
    "presence:update": (p: { userId: string; online: boolean }) => void;
}

export interface ClientToServerEvents {
    "channel:join": (channelId: string, ack: (ok: boolean) => void) => void;
    "message:send": (
        p: { channelId: string; body: string; clientId: string },
        ack: (msg: MessageDto) => void,
    ) => void;
    "typing:set": (p: { channelId: string; typing: boolean }) => void;
}

// Events published by the Laravel e-sign app onto the Redis stream.
export type LaravelEventType =
    | "document.sent_for_approval"
    | "document.approved"
    | "document.rejected"
    | "document.signed"
    | "document.completed";

export interface LaravelEvent {
    type: LaravelEventType;
    orgId: string;
    documentId: string;
    documentTitle: string;
    actorId: string;
    participantIds: string[];
    occurredAt: string;
}