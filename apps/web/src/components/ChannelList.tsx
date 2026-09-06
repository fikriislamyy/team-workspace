"use client";

import { useChat } from "@/store/chat";
import type { ChannelDto } from "@team-workspace/shared";

function previewText(last: ChannelDto["lastMessage"]): string {
    if (!last) return "No messages yet";
    const prefix = last.authorName ? `${last.authorName}: ` : "";
    const body = last.body?.trim();
    if (body) return `${prefix}${body}`;
    if (last.attachmentKind === "image") return `${prefix}📷 Photo`;
    if (last.attachmentKind === "file") return `${prefix}📄 Document`;
    return prefix;
}

export function ChannelList({ onPick }: { onPick: (id: string) => void }) {
    const channels = useChat((s) => s.channels);
    const activeId = useChat((s) => s.activeChannelId);

    return (
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {channels.map((c) => (
                <li key={c.id}>
                    <button
                        onClick={() => onPick(c.id)}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${activeId === c.id
                            ? "bg-neutral-100 dark:bg-neutral-800"
                            : "hover:bg-neutral-50 dark:hover:bg-neutral-900"
                            }`}
                    >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
                            {c.name.slice(0, 2).toUpperCase()}
                        </div>

                        <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                                <span className="truncate font-medium">{c.name}</span>
                                {c.unreadCount > 0 && (
                                    <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-xs text-white">
                                        {c.unreadCount}
                                    </span>
                                )}
                            </div>
                            <p className="truncate text-sm text-neutral-500">
                                {previewText(c.lastMessage)}
                            </p>
                        </div>
                    </button>
                </li>
            ))}
        </ul>
    );
}