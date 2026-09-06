import type { AttachmentInput } from "@team-workspace/shared";
import { api } from "./api";

interface SignResponse {
    uploadUrl: string;
    storageKey: string;
    expiresIn: number;
}

/** Reads intrinsic dimensions so the UI can reserve space before load. */
async function imageSize(
    file: File,
): Promise<{ width: number; height: number } | null> {
    if (!file.type.startsWith("image/")) return null;

    try {
        const bitmap = await createImageBitmap(file);
        const size = { width: bitmap.width, height: bitmap.height };
        bitmap.close();
        return size;
    } catch {
        return null;
    }
}

export async function uploadFile(
    file: File,
    channelId: string,
    token: string,
    onProgress?: (percent: number) => void,
): Promise<AttachmentInput> {
    const { uploadUrl, storageKey } = await api<SignResponse>(
        "/uploads/sign",
        token,
        {
            method: "POST",
            body: JSON.stringify({
                channelId,
                filename: file.name,
                mimeType: file.type || "application/octet-stream",
                sizeBytes: file.size,
            }),
        },
    );

    // XHR rather than fetch — fetch has no upload progress event.
    await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                onProgress?.(Math.round((e.loaded / e.total) * 100));
            }
        };

        xhr.onload = () =>
            xhr.status >= 200 && xhr.status < 300
                ? resolve()
                : reject(new Error(`Upload failed: ${xhr.status}`));

        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(file);
    });

    const size = await imageSize(file);

    return {
        storageKey,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        ...(size ?? {}),
    };
}

export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}