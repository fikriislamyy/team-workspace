import { io, type Socket } from "socket.io-client";
import type {
    ClientToServerEvents,
    ServerToClientEvents,
} from "@team-workspace/shared";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

export function connectSocket(token: string): AppSocket {
    socket?.disconnect();

    const url =
        typeof window !== "undefined"
            ? `${window.location.protocol}//${window.location.hostname}:3001`
            : "http://localhost:3001";

    socket = io(url, {
        auth: { token },
        transports: ["websocket"],
        autoConnect: true,
    });

    return socket;
}

export function getSocket(): AppSocket | null {
    return socket;
}