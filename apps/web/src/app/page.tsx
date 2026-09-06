"use client";

import { useEffect, useState } from "react";
import { connectSocket, type AppSocket } from "@/lib/socket";

const API =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:3001`
    : "http://localhost:3001";

export default function Home() {
  const [name, setName] = useState("Fikri");
  const [userId, setUserId] = useState("1");
  const [status, setStatus] = useState<string>("disconnected");
  const [online, setOnline] = useState<string[]>([]);
  const [socket, setSocket] = useState<AppSocket | null>(null);

  async function login() {
    setStatus("logging in…");
    try {
      const res = await fetch(`${API}/auth/dev/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: userId,
          name,
          email: `${name.toLowerCase()}@example.com`,
          orgId: "org_1",
        }),
      });

      const { token } = await res.json();
      const s = connectSocket(token);
      setSocket(s);

      s.on("connect", () => setStatus(`connected (${s.id})`));
      s.on("disconnect", () => setStatus("disconnected"));
      s.on("connect_error", (e) => setStatus(`error: ${e.message}`));
      s.on("presence:snapshot", ({ online }) => setOnline(online));
      s.on("presence:update", ({ userId, online: isOn }) =>
        setOnline((prev) =>
          isOn ? [...new Set([...prev, userId])] : prev.filter((u) => u !== userId),
        ),
      );
    } catch (e) {
      setStatus(`login failed: ${(e as Error).message}`);
    }
  }

  useEffect(() => {
    return () => {
      socket?.disconnect();
    };
  }, [socket]);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Socket harness</h1>

      <input
        className="rounded border px-3 py-2"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        placeholder="user id"
      />
      <input
        className="rounded border px-3 py-2"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="name"
      />

      <button
        onClick={login}
        className="rounded bg-black px-4 py-2 text-white"
      >
        Login &amp; connect
      </button>

      <p className="text-sm">
        Status: <span className="font-mono">{status}</span>
      </p>

      <div>
        <p className="text-sm font-medium">Online ({online.length})</p>
        <ul className="font-mono text-sm">
          {online.map((u) => (
            <li key={u}>{u}</li>
          ))}
        </ul>
      </div>
    </main>
  );
}