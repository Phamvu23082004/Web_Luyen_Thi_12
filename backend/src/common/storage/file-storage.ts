// Injection token + interface so blob storage is swappable (AD-15: "a later swap
// to S3/MinIO touches only the storage adapter"). Mirrors the EMAIL_SENDER shape
// in common/email/email-sender.ts — same precedent, same reason: only the adapter
// changes on a swap, never callers.
export const FILE_STORAGE = Symbol('FILE_STORAGE');

export interface FileStorage {
  /** Writes bytes to a temp file inside the storage root; returns its handle. */
  writeTemp(buffer: Buffer, extension: string): Promise<string>;
  /** Atomically publishes a temp file at `key` (mkdir -p + rename). */
  publish(tempHandle: string, key: string): Promise<void>;
  /** Best-effort cleanup of an unpublished temp file; never throws. */
  discardTemp(tempHandle: string): Promise<void>;
}
