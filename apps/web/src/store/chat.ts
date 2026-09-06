import { create } from "zustand";
import type { ChannelDto, MessageDto, UserSummary } from "@team-workspace/shared";

interface ChatState {
    token: string | null;
    me: { id: string; name: string } | null;

    channels: ChannelDto[];
    activeChannelId: string | null;

    messages: Record<string, MessageDto[]>;
    cursors: Record<string, string | null>;
    typing: Record<string, UserSummary[]>;
    online: Set<string>;

    setAuth: (token: string, me: { id: string; name: string }) => void;
    setChannels: (channels: ChannelDto[]) => void;
    setActive: (id: string | null) => void;
    prependMessages: (channelId: string, msgs: MessageDto[], cursor: string | null) => void;
    addMessage: (msg: MessageDto) => void;
    reconcile: (channelId: string, clientId: string, real: MessageDto) => void;
    setTyping: (channelId: string, user: UserSummary, typing: boolean) => void;
    setOnline: (ids: string[]) => void;
    updateOnline: (id: string, online: boolean) => void;
    clearUnread: (channelId: string) => void;
}

export const useChat = create<ChatState>((set) => ({
    token: null,
    me: null,
    channels: [],
    activeChannelId: null,
    messages: {},
    cursors: {},
    typing: {},
    online: new Set(),

    setAuth: (token, me) => set({ token, me }),
    setChannels: (channels) => set({ channels }),
    setActive: (activeChannelId) => set({ activeChannelId }),

    prependMessages: (channelId, msgs, cursor) =>
        set((s) => ({
            messages: {
                ...s.messages,
                [channelId]: [...msgs, ...(s.messages[channelId] ?? [])],
            },
            cursors: { ...s.cursors, [channelId]: cursor },
        })),

    addMessage: (msg) =>
        set((s) => {
            const existing = s.messages[msg.channelId] ?? [];
            if (existing.some((m) => m.id === msg.id)) return s;

            const isActive = s.activeChannelId === msg.channelId;
            const isMine = msg.author?.id === s.me?.id;

            return {
                messages: { ...s.messages, [msg.channelId]: [...existing, msg] },
                channels: s.channels.map((c) =>
                    c.id === msg.channelId
                        ? {
                            ...c,
                            unreadCount:
                                isActive || isMine ? c.unreadCount : c.unreadCount + 1,
                            lastMessage: {
                                body: msg.body,
                                authorName: msg.author?.name ?? null,
                                createdAt: msg.createdAt,
                            },
                        }
                        : c,
                ),
            };
        }),

    reconcile: (channelId, clientId, real) =>
        set((s) => ({
            messages: {
                ...s.messages,
                [channelId]: (s.messages[channelId] ?? []).map((m) =>
                    m.clientId === clientId ? real : m,
                ),
            },
        })),

    setTyping: (channelId, user, typing) =>
        set((s) => {
            const current = s.typing[channelId] ?? [];
            const next = typing
                ? current.some((u) => u.id === user.id)
                    ? current
                    : [...current, user]
                : current.filter((u) => u.id !== user.id);
            return { typing: { ...s.typing, [channelId]: next } };
        }),

    setOnline: (ids) => set({ online: new Set(ids) }),

    updateOnline: (id, online) =>
        set((s) => {
            const next = new Set(s.online);
            online ? next.add(id) : next.delete(id);
            return { online: next };
        }),

    clearUnread: (channelId) =>
        set((s) => ({
            channels: s.channels.map((c) =>
                c.id === channelId ? { ...c, unreadCount: 0 } : c,
            ),
        })),
}));