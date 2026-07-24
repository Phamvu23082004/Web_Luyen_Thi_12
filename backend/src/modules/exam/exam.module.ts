import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { getPositiveIntConfig } from '../../common/config/positive-int-config';
import { FILE_STORAGE } from '../../common/storage/file-storage';
import { LocalFileStorageService } from '../../common/storage/local-file-storage.service';
import { ExamController } from './exam.controller';
import { ExamService } from './exam.service';

const DEFAULT_EXAM_PDF_MAX_BYTES = 20 * 1024 * 1024; // 20 MB

@Module({
  imports: [
    // registerAsync's useFactory runs at app init (after ConfigModule), so the
    // limit is read at runtime — not the module-load-time `undefined` a
    // decorator-inline `ConfigService.get` would capture. getPositiveIntConfig
    // (not `?? DEFAULT`) also rejects a present-but-blank/non-numeric value
    // (Epic 1 retro Pattern 2).
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // memoryStorage — not diskStorage — so FileStorage owns every byte that
        // touches disk; diskStorage would write into a second, unmanaged location.
        storage: memoryStorage(),
        limits: {
          fileSize: getPositiveIntConfig(
            config,
            'EXAM_PDF_MAX_BYTES',
            DEFAULT_EXAM_PDF_MAX_BYTES,
          ),
          files: 1,
        },
      }),
    }),
  ],
  controllers: [ExamController],
  providers: [
    ExamService,
    { provide: FILE_STORAGE, useClass: LocalFileStorageService },
  ],
})
export class ExamModule {}
