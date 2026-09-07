"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChannelDto, MessagePage } from "@team-workspace/shared";
import { useChat } from "@/store/chat";
import { connectSocket, getSocket } from "@/lib/socket";
import { api, apiUrl } from "@/lib/api";
import {
  pushSupported,
  registerServiceWorker,
  subscribeToPush,
  unsubscribeFromPush,
  isSubscribed,
} from "@/lib/push";
import { ChannelList } from "@/components/ChannelList";
import { MessageThread } from "@/components/MessageThread";
import { Composer } from "@/components/Composer";

export default function Home() {
  const [userId, setUserId] = useState("1");
  const [name, setName] = useState("Fikri");
  const [error, setError] = useState("");

  const [canPush, setCanPush] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  // Deep link captured at mount, opened once channels are loaded.
  const [pendingChannel, setPendingChannel] = useState<string | null>(null);

  // Reactive values — each one subscribes independently.
  const token = useChat((s) => s.token);
  const me = useChat((s) => s.me);
  const channels = useChat((s) => s.channels);
  const activeChannelId = useChat((s) => s.activeChannelId);

  const activeChannel = channels.find((c) => c.id === activeChannelId);

  // Attach socket listeners and load channels for a known-good token.
  // Used both after a fresh login and when restoring a persisted session.
  const bootstrap = useCallback(async (authToken: string) => {
    const {
      setChannels,
      addMessage,
      setOnline,
      updateOnline,
      setTyping,
      clearAuth,
    } = useChat.getState();

    try {
      const socket = connectSocket(authToken);
      socket.on("message:new", addMessage);
      socket.on("presence:snapshot", ({ online }) => setOnline(online));
      socket.on("presence:update", (p) => updateOnline(p.userId, p.online));
      socket.on("typing:update", ({ channelId, user, typing }) =>
        setTyping(channelId, user, typing),
      );
      socket.on("connect_error", (e) => {
        if (e.message === "unauthorized") clearAuth();
      });

      setChannels(await api<ChannelDto[]>("/channels", authToken));
    } catch (e) {
      // Stale token from a previous session — drop it and show login.
      clearAuth();
      setError((e as Error).message);
    }
  }, []);

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

      const { token: newToken } = await res.json();
      useChat.getState().setAuth(newToken, { id: userId, name });
      await bootstrap(newToken);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function signOut() {
    getSocket()?.disconnect();
    useChat.getState().clearAuth();
  }

  const openChannel = useCallback(async (id: string) => {
    const socket = getSocket();
    const currentToken = useChat.getState().token;
    if (!socket || !currentToken) return;

    socket.emit("channel:join", id, async (res) => {
      if (!res.ok) {
        setError("Cannot join channel");
        return;
      }

      const { setActive, prependMessages, clearUnread, markLoaded } =
        useChat.getState();

      setActive(id);

      // `loaded`, not `messages` — live messages can arrive for a channel
      // whose history was never fetched.
      if (!useChat.getState().loaded[id]) {
        const page = await api<MessagePage>(
          `/channels/${id}/messages`,
          currentToken,
        );
        prependMessages(id, page.messages, page.nextCursor);
        markLoaded(id);
      }

      socket.emit("channel:read", { channelId: id });
      clearUnread(id);
    });
  }, []);

  // Capture the deep link once at mount, before anything clears the URL.
  useEffect(() => {
    const target = new URLSearchParams(window.location.search).get("channel");
    if (target) {
      setPendingChannel(target);
      window.history.replaceState({}, "", "/");
    }
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "OPEN_CHANNEL" && event.data.channelId) {
        setPendingChannel(event.data.channelId);
      }
    };

    navigator.serviceWorker.addEventListener("message", onMessage);
    return () =>
      navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  // Open it as soon as auth and channels are both ready.
  useEffect(() => {
    if (!me || !pendingChannel || channels.length === 0) return;

    if (channels.some((c) => c.id === pendingChannel)) {
      void openChannel(pendingChannel);
    }
    setPendingChannel(null);
  }, [me, pendingChannel, channels, openChannel]);

  // Restore a persisted session on load.
  useEffect(() => {
    if (token && me && !getSocket()) void bootstrap(token);
  }, [token, me, bootstrap]);

  // Register the service worker and read the real subscription state.
  useEffect(() => {
    if (!me) return;

    setCanPush(pushSupported());

    void (async () => {
      await registerServiceWorker();
      setPushOn(await isSubscribed());
    })();
  }, [me]);

  async function togglePush() {
    if (!token) return;
    setPushBusy(true);
    setError("");

    try {
      if (pushOn) {
        await unsubscribeFromPush(token);
        setPushOn(false);
      } else {
        const ok = await subscribeToPush(token);
        setPushOn(ok);
        if (!ok) {
          setError(
            Notification.permission === "denied"
              ? "Notifications blocked — allow them in site settings"
              : "Could not enable notifications",
          );
        }
      }
    } finally {
      setPushBusy(false);
    }
  }

  // Report what the user is looking at, so the server can skip pointless pushes.
  useEffect(() => {
    if (!me) return;

    const report = () => {
      const socket = getSocket();
      if (!socket) return;
      const visible = document.visibilityState === "visible";
      socket.emit("focus:set", {
        channelId: visible ? useChat.getState().activeChannelId : null,
      });
    };

    report();
    document.addEventListener("visibilitychange", report);
    window.addEventListener("blur", report);
    window.addEventListener("focus", report);

    return () => {
      document.removeEventListener("visibilitychange", report);
      window.removeEventListener("blur", report);
      window.removeEventListener("focus", report);
    };
  }, [me, activeChannelId]);

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
      <aside
        className={`w-full border-r border-neutral-200 dark:border-neutral-800 md:block md:w-80 ${showThread ? "hidden" : "block"
          }`}
      >
        <header className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <h1 className="font-semibold">Channels</h1>
          <p className="text-xs text-neutral-500">Signed in as {me.name}</p>

          <div className="mt-1 flex gap-3">
            {canPush && (
              <button
                onClick={togglePush}
                disabled={pushBusy}
                className="text-xs text-emerald-600 underline disabled:opacity-50"
              >
                {pushBusy
                  ? "…"
                  : pushOn
                    ? "Disable notifications"
                    : "Enable notifications"}
              </button>
            )}

            <button
              onClick={signOut}
              className="text-xs text-neutral-500 underline"
            >
              Sign out
            </button>
          </div>

          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </header>

        <ChannelList onPick={openChannel} />
      </aside>

      <section
        className={`flex flex-1 flex-col ${showThread ? "flex" : "hidden md:flex"}`}
      >
        {activeChannelId ? (
          <>
            <header className="flex items-center gap-2 border-b border-neutral-200 px-3 py-3 dark:border-neutral-800">
              <button
                onClick={() => useChat.getState().setActive(null)}
                className="md:hidden"
                aria-label="Back"
              >
                ←
              </button>
              <h2 className="font-semibold">{activeChannel?.name}</h2>
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
    </div>
  );
}