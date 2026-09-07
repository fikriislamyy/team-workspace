"use client";

import { useEffect, useRef, useState } from "react";
import type { ChannelDto } from "@team-workspace/shared";
import { useChat } from "@/store/chat";
import { api } from "@/lib/api";

interface Props {
    open: boolean;
    onClose: () => void;
    onCreated: (channel: ChannelDto) => void;
}

export function NewChannelDialog({ open, onClose, onCreated }: Props) {
    const [name, setName] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    const token = useChat((s) => s.token);

    useEffect(() => {
        if (open) {
            setName("");
            setError("");
            // Delay so the element exists before focusing.
            setTimeout(() => inputRef.current?.focus(), 0);
        }
    }, [open]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        if (open) document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;

    async function create() {
        const trimmed = name.trim();
        if (!trimmed || !token) return;

        setBusy(true);
        setError("");

        try {
            const channel = await api<ChannelDto>("/channels", token, {
                method: "POST",
                // Seeded users. Replace with a real picker once Laravel supplies
                // the org's member list.
                body: JSON.stringify({ name: trimmed, memberIds: ["1", "2", "3"] }),
            });
            onCreated(channel);
            onClose();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
            onClick={onClose}
        >
            <div
                className="w-full max-w-sm rounded-2xl bg-white p-5 dark:bg-neutral-900"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="mb-3 text-lg font-semibold">New channel</h2>

                <input
                    ref={inputRef}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") void create();
                    }}
                    maxLength={80}
                    placeholder="e.g. design-review"
                    className="w-full rounded-lg bg-neutral-100 px-3 py-2.5 outline-none dark:bg-neutral-800"
                />

                {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

                <div className="mt-4 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="rounded-lg px-4 py-2 text-sm text-neutral-500"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => void create()}
                        disabled={!name.trim() || busy}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-40"
                    >
                        {busy ? "Creating…" : "Create"}
                    </button>
                </div>
            </div>
        </div>
    );
}