"use client";

import { useRef, useState } from "react";
import { nanoid } from "nanoid";
import type { AttachmentInput } from "@team-workspace/shared";
import { useChat } from "@/store/chat";
import { getSocket } from "@/lib/socket";
import { uploadFile, formatBytes } from "@/lib/upload";

export function Composer({ channelId }: { channelId: string }) {
    const [text, setText] = useState("");
    const [pending, setPending] = useState<File | null>(null);
    const [progress, setProgress] = useState<number | null>(null);
    const [error, setError] = useState("");

    const fileRef = useRef<HTMLInputElement>(null);
    const cameraRef = useRef<HTMLInputElement>(null);
    const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isTyping = useRef(false);

    const me = useChat((s) => s.me);
    const token = useChat((s) => s.token);
    const addMessage = useChat((s) => s.addMessage);
    const reconcile = useChat((s) => s.reconcile);
    const removeOptimistic = useChat((s) => s.removeOptimistic);

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

    function emit(body: string, attachment?: AttachmentInput) {
        const socket = getSocket();
        if (!socket || !me) return;

        const clientId = nanoid();

        addMessage({
            id: `tmp_${clientId}`,
            channelId,
            kind: attachment ? "FILE" : "TEXT",
            body,
            createdAt: new Date().toISOString(),
            author: { id: me.id, name: me.name },
            clientId,
        });

        socket.emit("message:send", { channelId, body, clientId, attachment }, (res) => {
            if (res.ok && res.message) {
                reconcile(channelId, clientId, res.message);
            } else {
                removeOptimistic(channelId, clientId);
                setError(res.error ?? "Send failed");
            }
        });
    }

    async function send() {
        const body = text.trim();
        if (!body && !pending) return;

        setError("");
        setText("");
        isTyping.current = false;
        getSocket()?.emit("typing:set", { channelId, typing: false });

        if (!pending) {
            emit(body);
            return;
        }

        const file = pending;
        setPending(null);
        setProgress(0);

        try {
            if (!token) throw new Error("Not authenticated");
            const attachment = await uploadFile(file, channelId, token, setProgress);
            emit(body, attachment);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setProgress(null);
        }
    }

    return (
        <div className="border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
            {pending && (
                <div className="flex items-center gap-2 border-b border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800">
                    <span className="truncate">📎 {pending.name}</span>
                    <span className="shrink-0 text-neutral-500">
                        {formatBytes(pending.size)}
                    </span>
                    <button
                        onClick={() => setPending(null)}
                        className="ml-auto shrink-0 text-neutral-500"
                        aria-label="Remove attachment"
                    >
                        ✕
                    </button>
                </div>
            )}

            {progress !== null && (
                <div className="h-1 w-full bg-neutral-200 dark:bg-neutral-800">
                    <div
                        className="h-1 bg-emerald-600 transition-all"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}

            {error && <p className="px-3 py-1 text-xs text-red-500">{error}</p>}

            <div className="flex items-end gap-1.5 p-2">
                <button
                    onClick={() => fileRef.current?.click()}
                    className="h-10 w-10 shrink-0 rounded-full text-xl"
                    aria-label="Attach file"
                >
                    📎
                </button>

                {/* capture="environment" opens the rear camera on mobile */}
                <button
                    onClick={() => cameraRef.current?.click()}
                    className="h-10 w-10 shrink-0 rounded-full text-xl md:hidden"
                    aria-label="Take photo"
                >
                    📷
                </button>

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
                            void send();
                        }
                    }}
                    placeholder="Message"
                    className="max-h-32 flex-1 resize-none rounded-2xl bg-neutral-100 px-4 py-2.5 outline-none dark:bg-neutral-800"
                />

                <button
                    onClick={() => void send()}
                    disabled={(!text.trim() && !pending) || progress !== null}
                    className="h-10 w-10 shrink-0 rounded-full bg-emerald-600 text-white disabled:opacity-40"
                    aria-label="Send"
                >
                    ➤
                </button>
            </div>

            <input
                ref={fileRef}
                type="file"
                hidden
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setPending(f);
                    e.target.value = "";
                }}
            />
            <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setPending(f);
                    e.target.value = "";
                }}
            />
        </div>
    );
}