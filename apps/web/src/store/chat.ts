import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ChannelDto, MessageDto, UserSummary } from "@team-workspace/shared";

interface ChatState {
    token: string | null;
    me: { id: string; name: string } | null;

    channels: ChannelDto[];
    activeChannelId: string | null;

    messages: Record<string, MessageDto[]>;
    loaded: Record<string, boolean>;
    cursors: Record<string, string | null>;
    typing: Record<string, UserSummary[]>;
    online: Set<string>;

    setAuth: (token: string, me: { id: string; name: string }) => void;
    clearAuth: () => void;
    setChannels: (channels: ChannelDto[]) => void;
    setActive: (id: string | null) => void;
    prependMessages: (channelId: string, msgs: MessageDto[], cursor: string | null) => void;
    markLoaded: (channelId: string) => void;
    addMessage: (msg: MessageDto) => void;
    reconcile: (channelId: string, clientId: string, real: MessageDto) => void;
    removeOptimistic: (channelId: string, clientId: string) => void;
    clearUnread: (channelId: string) => void;
    setTyping: (channelId: string, user: UserSummary, typing: boolean) => void;
    setOnline: (ids: string[]) => void;
    updateOnline: (id: string, online: boolean) => void;
}

export const useChat = create<ChatState>()(
    persist(
        (set) => ({
            token: null,
            me: null,
            channels: [],
            activeChannelId: null,
            messages: {},
            loaded: {},
            cursors: {},
            typing: {},
            online: new Set(),

            setAuth: (token, me) => set({ token, me }),

            clearAuth: () =>
                set({
                    token: null,
                    me: null,
                    channels: [],
                    activeChannelId: null,
                    messages: {},
                    loaded: {},
                    cursors: {},
                    typing: {},
                    online: new Set(),
                }),

            setChannels: (channels) => set({ channels }),
            setActive: (activeChannelId) => set({ activeChannelId }),

            prependMessages: (channelId, msgs, cursor) =>
                set((s) => {
                    const existing = s.messages[channelId] ?? [];
                    const existingIds = new Set(existing.map((m) => m.id));
                    const fresh = msgs.filter((m) => !existingIds.has(m.id));
                    return {
                        messages: { ...s.messages, [channelId]: [...fresh, ...existing] },
                        cursors: { ...s.cursors, [channelId]: cursor },
                    };
                }),

            markLoaded: (channelId) =>
                set((s) => ({ loaded: { ...s.loaded, [channelId]: true } })),

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
                                        attachmentKind: msg.attachments?.[0]
                                            ? msg.attachments[0].mimeType.startsWith("image/")
                                                ? ("image" as const)
                                                : ("file" as const)
                                            : null,
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

            removeOptimistic: (channelId, clientId) =>
                set((s) => ({
                    messages: {
                        ...s.messages,
                        [channelId]: (s.messages[channelId] ?? []).filter(
                            (m) => m.clientId !== clientId,
                        ),
                    },
                })),

            clearUnread: (channelId) =>
                set((s) => ({
                    channels: s.channels.map((c) =>
                        c.id === channelId ? { ...c, unreadCount: 0 } : c,
                    ),
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
                    if (online) next.add(id);
                    else next.delete(id);
                    return { online: next };
                }),
        }),
        {
            name: "team-workspace-auth",
            storage: createJSONStorage(() => localStorage),
            // Only the session survives a reload. Messages and presence are
            // re-fetched, and stale cached ones would be worse than none.
            partialize: (s) => ({ token: s.token, me: s.me }),
        },
    ),
);