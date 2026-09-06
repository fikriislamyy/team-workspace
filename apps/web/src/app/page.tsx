"use client";

import { useEffect, useState } from "react";
import type { ChannelDto, MessagePage } from "@team-workspace/shared";
import { useChat } from "@/store/chat";
import { connectSocket, getSocket } from "@/lib/socket";
import { api, apiUrl } from "@/lib/api";
import { ChannelList } from "@/components/ChannelList";
import { MessageThread } from "@/components/MessageThread";
import { Composer } from "@/components/Composer";

export default function Home() {
  const [userId, setUserId] = useState("1");
  const [name, setName] = useState("Fikri");
  const [error, setError] = useState("");
  const channels = useChat((s) => s.channels);

  const {
    token, me, activeChannelId, setAuth, setChannels, setActive,
    prependMessages, addMessage, reconcile, setTyping, setOnline, updateOnline,
  } = useChat();

  const activeChannel = channels.find((c) => c.id === activeChannelId);

  async function login() {
    setError("");
    try {
      const res = await fetch(`${apiUrl()}/auth/dev/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: userId,
          name,
          email: `${name.toLowerCase()}@example.com`,
          orgId: "org_1",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const { token } = await res.json();
      setAuth(token, { id: userId, name });

      const socket = connectSocket(token);
      socket.on("message:new", addMessage);
      socket.on("presence:snapshot", ({ online }) => setOnline(online));
      socket.on("presence:update", ({ userId, online }) =>
        updateOnline(userId, online),
      );
      socket.on("typing:update", ({ channelId, user, typing }) =>
        setTyping(channelId, user, typing),
      );

      const channels = await api<ChannelDto[]>("/channels", token);
      setChannels(channels);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function openChannel(id: string) {
    const socket = getSocket();
    if (!socket || !token) return;

    socket.emit("channel:join", id, async (res) => {
      if (!res.ok) return setError("Cannot join channel");

      setActive(id);

      if (!useChat.getState().messages[id]) {
        const page = await api<MessagePage>(
          `/channels/${id}/messages`,
          token,
        );
        prependMessages(id, page.messages, page.nextCursor);
      }

      socket.emit("channel:read", { channelId: id });
      socket.emit("channel:read", { channelId: id });
      useChat.getState().clearUnread(id);
    });
  }

  useEffect(() => () => void getSocket()?.disconnect(), []);

  if (!me) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-3 p-6">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <input
          className="rounded border px-3 py-2"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="user id (1, 2, or 3)"
        />
        <input
          className="rounded border px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="name"
        />
        <button
          onClick={login}
          className="rounded bg-emerald-600 px-4 py-2 text-white"
        >
          Continue
        </button>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </main>
    );
  }

  const showThread = activeChannelId !== null;

  return (
    <div className="h-dvh-safe flex overflow-hidden">
      {/* Sidebar: hidden on mobile when a thread is open */}
      <aside
        className={`w-full border-r border-neutral-200 dark:border-neutral-800 md:block md:w-80 ${showThread ? "hidden" : "block"
          }`}
      >
        <header className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <h1 className="font-semibold">Channels</h1>
          <p className="text-xs text-neutral-500">Signed in as {me.name}</p>
        </header>
        <ChannelList onPick={openChannel} />
      </aside>

      {/* Thread */}
      <section
        className={`flex flex-1 flex-col ${showThread ? "flex" : "hidden md:flex"}`}
      >
        {activeChannelId ? (
          <>
            <header className="flex items-center gap-2 border-b border-neutral-200 px-3 py-3 dark:border-neutral-800">
              <button
                onClick={() => setActive(null)}
                className="md:hidden"
                aria-label="Back"
              >
                ←
              </button>
              <h2 className="font-semibold">{activeChannel?.name}

              </h2>
            </header>
            <MessageThread channelId={activeChannelId} />
            <Composer channelId={activeChannelId} />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-neutral-500">
            Pick a channel
          </div>
        )}
      </section>
    </div >
  );
}