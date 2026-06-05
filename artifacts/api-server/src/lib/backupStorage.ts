import { Storage } from "@google-cloud/storage";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

const storageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

function parseStoragePath(path: string): { bucketName: string; objectName: string } {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const parts = normalized.split("/");
  if (parts.length < 3) {
    throw new Error(`Invalid storage path: ${path}`);
  }
  return {
    bucketName: parts[1]!,
    objectName: parts.slice(2).join("/"),
  };
}

export async function uploadBackupToStorage(
  filename: string,
  data: Buffer
): Promise<string> {
  const privateObjectDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateObjectDir) {
    throw new Error("PRIVATE_OBJECT_DIR not set — object storage not configured.");
  }

  const dir = privateObjectDir.endsWith("/") ? privateObjectDir : `${privateObjectDir}/`;
  const fullPath = `${dir}backups/${filename}`;
  const { bucketName, objectName } = parseStoragePath(fullPath);

  const bucket = storageClient.bucket(bucketName);
  const file = bucket.file(objectName);

  await file.save(data, {
    metadata: { contentType: "application/gzip" },
  });

  return `gs://${bucketName}/${objectName}`;
}

export async function generateBackupDownloadUrl(
  storageUrl: string,
  ttlSec = 604800
): Promise<string> {
  if (!storageUrl.startsWith("gs://")) {
    throw new Error(`Invalid storage URL: ${storageUrl}`);
  }
  const rest = storageUrl.slice("gs://".length);
  const slashIdx = rest.indexOf("/");
  if (slashIdx < 0) {
    throw new Error(`Invalid storage URL: ${storageUrl}`);
  }
  const bucketName = rest.slice(0, slashIdx);
  const objectName = rest.slice(slashIdx + 1);

  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method: "GET",
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };

  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(30_000),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL: ${response.status} ${await response.text()}`
    );
  }

  const { signed_url } = await response.json() as { signed_url: string };
  return signed_url;
}
