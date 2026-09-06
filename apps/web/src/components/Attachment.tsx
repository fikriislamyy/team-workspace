"use client";

import { useState } from "react";
import type { AttachmentDto } from "@team-workspace/shared";
import { formatBytes } from "@/lib/upload";

export function Attachment({ a, mine }: { a: AttachmentDto; mine: boolean }) {
    const [open, setOpen] = useState(false);
    const isImage = a.mimeType.startsWith("image/");

    if (isImage) {
        // aspect-ratio reserves the box before the image loads — no layout shift,
        // which on a chat list means the scroll position doesn't jump.
        const ratio = a.width && a.height ? a.width / a.height : 4 / 3;

        return (
            <>
                <button
                    onClick={() => setOpen(true)}
                    className="block w-full overflow-hidden rounded-xl"
                    style={{ maxWidth: 280 }}
                >
                    <div style={{ aspectRatio: ratio }} className="bg-neutral-300/30">
                        <img
                            src={a.url}
                            alt={a.filename}
                            loading="lazy"
                            className="h-full w-full object-cover"
                        />
                    </div>
                </button>

                {open && (
                    <div
                        onClick={() => setOpen(false)}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
                    >
                        <img
                            src={a.url}
                            alt={a.filename}
                            className="max-h-full max-w-full object-contain"
                        />
                    </div>
                )}
            </>
        );
    }

    return (
        <a
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-2 rounded-xl px-3 py-2 ${mine ? "bg-emerald-700/40" : "bg-neutral-300/40 dark:bg-neutral-700/40"
                }`}
        >
            <span className="text-2xl">📄</span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{a.filename}</span>
                <span className="block text-xs opacity-70">
                    {formatBytes(a.sizeBytes)}
                </span>
            </span>
        </a>
    );
}