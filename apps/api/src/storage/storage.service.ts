import { BadRequestException, Injectable } from "@nestjs/common";
import {
    GetObjectCommand,
    HeadObjectCommand,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { nanoid } from "nanoid";

const MAX_BYTES = 25 * 1024 * 1024;

const ALLOWED_MIME = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/zip",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

@Injectable()
export class StorageService {
    private readonly bucket = process.env.S3_BUCKET ?? "team-workspace";

    /** Internal client — used for HeadObject and anything server-side. */
    private readonly internal = new S3Client({
        region: process.env.S3_REGION ?? "us-east-1",
        endpoint: process.env.S3_ENDPOINT,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
        credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY ?? "",
            secretAccessKey: process.env.S3_SECRET_KEY ?? "",
        },
    });

    /** Public client — signs URLs against a host that browsers can reach. */
    private readonly publicClient = new S3Client({
        region: process.env.S3_REGION ?? "us-east-1",
        endpoint: process.env.S3_PUBLIC_ENDPOINT ?? process.env.S3_ENDPOINT,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
        credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY ?? "",
            secretAccessKey: process.env.S3_SECRET_KEY ?? "",
        },
    });

    validate(mimeType: string, sizeBytes: number): void {
        if (!ALLOWED_MIME.has(mimeType)) {
            throw new BadRequestException(`Unsupported file type: ${mimeType}`);
        }
        if (sizeBytes <= 0 || sizeBytes > MAX_BYTES) {
            throw new BadRequestException("File must be between 1 byte and 25 MB");
        }
    }

    /**
     * The server owns the key. Clients never choose where their bytes land —
     * that would allow overwriting other people's files.
     */
    buildKey(orgId: string, channelId: string, filename: string): string {
        const safe = filename
            .replace(/[^a-zA-Z0-9._-]/g, "_")
            .slice(-80);
        return `chat/${orgId}/${channelId}/${nanoid()}-${safe}`;
    }

    async signUpload(
        key: string,
        mimeType: string,
    ): Promise<{ uploadUrl: string; expiresIn: number }> {
        const expiresIn = 300;

        const uploadUrl = await getSignedUrl(
            this.publicClient,
            new PutObjectCommand({
                Bucket: this.bucket,
                Key: key,
                ContentType: mimeType,
            }),
            { expiresIn },
        );

        return { uploadUrl, expiresIn };
    }

    async signDownload(key: string, filename?: string): Promise<string> {
        return getSignedUrl(
            this.publicClient,
            new GetObjectCommand({
                Bucket: this.bucket,
                Key: key,
                ...(filename
                    ? {
                        ResponseContentDisposition: `inline; filename="${filename}"`,
                    }
                    : {}),
            }),
            { expiresIn: 3600 },
        );
    }

    /** Confirms the client actually uploaded what it claims. */
    async exists(key: string): Promise<{ size: number } | null> {
        try {
            const head = await this.internal.send(
                new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
            );
            return { size: head.ContentLength ?? 0 };
        } catch {
            return null;
        }
    }
}