"use client";

import { useEffect, useRef } from "react";
import { useChat } from "@/store/chat";

export function MessageThread({ channelId }: { channelId: string }) {
    const messages = useChat((s) => s.messages[channelId]) ?? [];
    const typing = useChat((s) => s.typing[channelId]) ?? [];
    const me = useChat((s) => s.me);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length, typing.length]);

    return (
        <div className="flex-1 overflow-y-auto px-3 py-4">
            {messages.map((m, i) => {
                const mine = m.author?.id === me?.id;
                const showAuthor =
                    !mine && messages[i - 1]?.author?.id !== m.author?.id;

                if (m.kind === "SYSTEM") {
                    return (
                        <p
                            key={m.id}
                            className="mx-auto my-2 w-fit rounded-full bg-neutral-200 px-3 py-1 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                        >
                            {m.body}
                        </p>
                    );
                }

                return (
                    <div
                        key={m.id}
                        className={`mb-1 flex ${mine ? "justify-end" : "justify-start"}`}
                    >
                        <div
                            className={`max-w-[78%] rounded-2xl px-3 py-2 ${mine
                                ? "rounded-br-sm bg-emerald-600 text-white"
                                : "rounded-bl-sm bg-neutral-200 dark:bg-neutral-800"
                                } ${m.id.startsWith("tmp_") ? "opacity-60" : ""}`}
                        >
                            {showAuthor && (
                                <p className="mb-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                    {m.author?.name}
                                </p>
                            )}
                            <p className="whitespace-pre-wrap break-words text-[15px]">
                                {m.body}
                            </p>
                            <p
                                className={`mt-0.5 text-right text-[10px] ${mine ? "text-emerald-100" : "text-neutral-500"
                                    }`}
                            >
                                {new Date(m.createdAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                })}
                            </p>
                        </div>
                    </div>
                );
            })}

            {typing.length > 0 && (
                <p className="px-2 text-xs italic text-neutral-500">
                    {typing.map((u) => u.name).join(", ")}{" "}
                    {typing.length === 1 ? "is" : "are"} typing…
                </p>
            )}

            <div ref={bottomRef} />
        </div>
    );
}