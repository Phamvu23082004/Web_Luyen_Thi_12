import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import type { FileStorage } from './file-storage';

/**
 * Local-filesystem implementation of {@link FileStorage} (AD-15). Both the temp
 * and published paths live under one root/volume, so `publish`'s `fs.rename` is a
 * genuine atomic move — this IS the write-temp-then-rename, not a simulation of it.
 * A later swap to S3/MinIO replaces only this class.
 */
@Injectable()
export class LocalFileStorageService implements FileStorage {
  private readonly root: string;

  constructor(config: ConfigService) {
    // `./storage` fallback keeps a fresh clone working before STORAGE_ROOT is set;
    // compose points it at the shared `/app/storage` volume.
    this.root = path.resolve(config.get<string>('STORAGE_ROOT') ?? './storage');
  }

  async writeTemp(buffer: Buffer, extension: string): Promise<string> {
    const tempDir = path.join(this.root, '.tmp');
    await mkdir(tempDir, { recursive: true });
    const handle = path.join(tempDir, `${randomUUID()}.${extension}`);
    await writeFile(handle, buffer);
    return handle;
  }

  async publish(tempHandle: string, key: string): Promise<void> {
    const target = this.resolveWithinRoot(key);
    await mkdir(path.dirname(target), { recursive: true });
    await rename(tempHandle, target);
  }

  async discardTemp(tempHandle: string): Promise<void> {
    // Best-effort — a failed publish already threw the real error; cleanup must
    // never mask it or throw its own (e.g. the file was already renamed away).
    await rm(tempHandle, { force: true }).catch(() => undefined);
  }

  /**
   * Resolves `key` under the root and rejects any path that escapes it. Keys are
   * server-built today, but this is the check that keeps them safe once Story 2.6
   * builds worker-side keys from parse output.
   */
  private resolveWithinRoot(key: string): string {
    const resolved = path.resolve(this.root, key);
    if (!resolved.startsWith(this.root + path.sep)) {
      throw new Error(`Storage key escapes the storage root: ${key}`);
    }
    return resolved;
  }
}
