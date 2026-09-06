"use client";

import { useRef, useState } from "react";
import { nanoid } from "nanoid";
import { useChat } from "@/store/chat";
import { getSocket } from "@/lib/socket";

export function Composer({ channelId }: { channelId: string }) {
    const [text, setText] = useState("");
    const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isTyping = useRef(false);

    const me = useChat((s) => s.me);
    const addMessage = useChat((s) => s.addMessage);
    const reconcile = useChat((s) => s.reconcile);

    function signalTyping() {
        const socket = getSocket();
        if (!socket) return;

        if (!isTyping.current) {
            isTyping.current = true;
            socket.emit("typing:set", { channelId, typing: true });
        }

        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => {
            isTyping.current = false;
            socket.emit("typing:set", { channelId, typing: false });
        }, 2000);
    }

    function send() {
        const body = text.trim();
        const socket = getSocket();
        if (!body || !socket || !me) return;

        const clientId = nanoid();

        // Optimistic render.
        addMessage({
            id: `tmp_${clientId}`,
            channelId,
            kind: "TEXT",
            body,
            createdAt: new Date().toISOString(),
            author: { id: me.id, name: me.name },
            clientId,
        });

        setText("");
        isTyping.current = false;
        socket.emit("typing:set", { channelId, typing: false });

        socket.emit("message:send", { channelId, body, clientId }, (res) => {
            if (res.ok && res.message) {
                reconcile(channelId, clientId, res.message);
            }
        });
    }

    return (
        <div className="flex items-end gap-2 border-t border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-950">
            <textarea
                rows={1}
                value={text}
                onChange={(e) => {
                    setText(e.target.value);
                    signalTyping();
                }}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                    }
                }}
                placeholder="Message"
                className="max-h-32 flex-1 resize-none rounded-2xl bg-neutral-100 px-4 py-2.5 outline-none dark:bg-neutral-800"
            />
            <button
                onClick={send}
                disabled={!text.trim()}
                className="h-10 w-10 shrink-0 rounded-full bg-emerald-600 text-white disabled:opacity-40"
                aria-label="Send"
            >
                ➤
            </button>
        </div>
    );
}
