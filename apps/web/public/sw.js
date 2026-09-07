self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
    const raw = event.data ? event.data.text() : "";

    let payload;
    try {
        payload = JSON.parse(raw);
    } catch {
        payload = { title: "Team Workspace", body: raw || "New message" };
    }

    event.waitUntil(
        self.registration.showNotification(payload.title ?? "Team Workspace", {
            body: payload.body ?? "",
            tag: payload.tag,
            renotify: false,
            icon: "/icon-192.png",
            badge: "/badge-72.png",
            data: { url: payload.url ?? "/", channelId: payload.tag },
        }),
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    const url = event.notification.data?.url ?? "/";
    const channelId = event.notification.data?.channelId ?? null;

    event.waitUntil(
        (async () => {
            const clientList = await self.clients.matchAll({
                type: "window",
                includeUncontrolled: true,
            });

            for (const client of clientList) {
                if ("focus" in client) {
                    await client.focus();
                    // The SPA won't remount on same-origin navigation, so tell it
                    // directly which channel to open.
                    client.postMessage({ type: "OPEN_CHANNEL", channelId });
                    return;
                }
            }

            await self.clients.openWindow(url);
        })(),
    );
});