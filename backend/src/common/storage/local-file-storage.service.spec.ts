import { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { LocalFileStorageService } from './local-file-storage.service';

function buildService(root: string): LocalFileStorageService {
  const config = {
    get: (key: string) => (key === 'STORAGE_ROOT' ? root : undefined),
  } as unknown as ConfigService;
  return new LocalFileStorageService(config);
}

describe('LocalFileStorageService', () => {
  let root: string;
  let storage: LocalFileStorageService;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'onthi12-storage-'));
    storage = buildService(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('write → publish lands the exact bytes at the resolved key', async () => {
    const bytes = Buffer.from('%PDF-1.7 hello');
    const handle = await storage.writeTemp(bytes, 'pdf');

    await storage.publish(handle, 'exams/abc/source.pdf');

    const written = await readFile(path.join(root, 'exams/abc/source.pdf'));
    expect(written.equals(bytes)).toBe(true);
  });

  it('rejects a publish to a key that escapes the storage root', async () => {
    const handle = await storage.writeTemp(Buffer.from('x'), 'pdf');

    await expect(storage.publish(handle, '../../etc/x')).rejects.toThrow(
      /escapes the storage root/,
    );
  });

  it('discardTemp resolves on an already-removed file (never throws)', async () => {
    const handle = await storage.writeTemp(Buffer.from('x'), 'pdf');
    await storage.discardTemp(handle);

    await expect(storage.discardTemp(handle)).resolves.toBeUndefined();
  });
});
