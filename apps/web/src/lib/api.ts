export function apiUrl(): string {
    if (typeof window === "undefined") return "http://localhost:3001";
    return `${window.location.protocol}//${window.location.hostname}:3001`;
}

export async function api<T>(
    path: string,
    token: string,
    init?: RequestInit,
): Promise<T> {
    const res = await fetch(`${apiUrl()}${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...init?.headers,
        },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<T>;
}