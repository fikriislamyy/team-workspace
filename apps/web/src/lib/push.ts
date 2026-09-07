import { api } from "./api";

/**
 * TypeScript 5.7+ made Uint8Array generic over its buffer type, and
 * BufferSource wants one backed by a real ArrayBuffer. Building it
 * explicitly avoids a type error at the subscribe() call.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(normalized);

    const output = new Uint8Array(new ArrayBuffer(raw.length));
    for (let i = 0; i < raw.length; i += 1) {
        output[i] = raw.charCodeAt(i);
    }
    return output;
}

export function pushSupported(): boolean {
    return (
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window
    );
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!pushSupported()) return null;
    try {
        return await navigator.serviceWorker.register("/sw.js");
    } catch (err) {
        console.warn("Service worker registration failed:", err);
        return null;
    }
}

export async function subscribeToPush(token: string): Promise<boolean> {
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    if (!key) {
        console.warn("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set");
        return false;
    }
    if (!pushSupported()) return false;

    // Service workers need a secure context: HTTPS or localhost.
    // A LAN IP will fail here.
    if (!window.isSecureContext) {
        console.warn("Push requires HTTPS or localhost");
        return false;
    }

    try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return false;

        await registerServiceWorker();
        const registration = await navigator.serviceWorker.ready;

        const existing = await registration.pushManager.getSubscription();
        const subscription =
            existing ??
            (await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(key),
            }));

        const json = subscription.toJSON();
        if (!json.keys?.p256dh || !json.keys?.auth) {
            console.warn("Subscription missing encryption keys");
            return false;
        }

        await api("/notifications/subscribe", token, {
            method: "POST",
            body: JSON.stringify({
                endpoint: subscription.endpoint,
                p256dh: json.keys.p256dh,
                auth: json.keys.auth,
                userAgent: navigator.userAgent,
            }),
        });

        return true;
    } catch (err) {
        console.warn("Push subscription failed:", err);
        return false;
    }
}

export async function unsubscribeFromPush(token: string): Promise<void> {
    if (!pushSupported()) return;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    await api("/notifications/subscribe", token, {
        method: "DELETE",
        body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => { });

    await subscription.unsubscribe();
}

export async function isSubscribed(): Promise<boolean> {
    if (!pushSupported() || Notification.permission !== "granted") return false;
    try {
        const registration = await navigator.serviceWorker.ready;
        return (await registration.pushManager.getSubscription()) !== null;
    } catch {
        return false;
    }
}