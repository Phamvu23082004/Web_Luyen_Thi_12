import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  FILE_STORAGE,
  type FileStorage,
} from '../../common/storage/file-storage';
import { CreateExamDto } from './dto/create-exam.dto';
import type { Exam } from '../../../generated/prisma/client';

@Injectable()
export class ExamService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  /**
   * Upload → stored Draft exam (EXAM-01, AD-13). Creates the exam and stores its
   * source PDF; does NOT call Gemini and does NOT enqueue anything — a 2.1a exam
   * sits at `parse_status = pending` with nothing in the queue. Story 2.1b adds
   * the publish-after-commit step.
   */
  async createDraftFromPdf(
    teacherId: string,
    dto: CreateExamDto,
    file: Express.Multer.File,
  ): Promise<Exam> {
    // 1. Validate the bytes, not the label — `file.mimetype` is client-supplied.
    if (file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      throw new BadRequestException('The uploaded file is not a valid PDF');
    }

    // 2. Write the multi-MB temp file OUTSIDE the transaction, so a slow disk
    //    write never holds a DB transaction open.
    const tempHandle = await this.storage.writeTemp(file.buffer, 'pdf');

    try {
      // 3. The row and its file commit together. The id names the storage key
      //    (AD-15), so the row is created first, `storage.publish` (mkdir + the
      //    atomic `fs.rename`) runs INSIDE the transaction — a couple of syscalls
      //    on the same volume, microseconds, not enough to meaningfully extend
      //    the transaction — and a rename failure rolls the row back. No exam
      //    row can therefore exist without its file
      //    (AC 3 / AD-01). The one tolerated asymmetry: a commit failure AFTER a
      //    successful rename leaves an orphan blob — harmless, sweepable, never a
      //    violation. (See the story Dev Notes for the full rationale.)
      const exam = await this.prisma.$transaction(async (tx) => {
        const created = await tx.exam.create({
          data: {
            title: dto.title,
            subject: dto.subject,
            durationMinutes: dto.durationMinutes,
            teacherId,
            // Placeholder — the id-derived key is set by the update below, once
            // the id exists. NOT NULL means it is never persisted as this value.
            sourceFileUrl: '',
          },
        });
        const key = `exams/${created.id}/source.pdf`;
        await this.storage.publish(tempHandle, key);
        return tx.exam.update({
          where: { id: created.id },
          data: { sourceFileUrl: key },
        });
      });

      // 4/5. status=draft, parse_status=pending, parse_generation=1 are all schema
      //      defaults. Nothing is enqueued here — that line is Story 2.1b's.
      return exam;
    } finally {
      // On any throw before commit the temp file still exists and this removes it;
      // on success `publish` already renamed it away and this is a no-op.
      // discardTemp is best-effort and never throws, so it cannot mask a real error.
      await this.storage.discardTemp(tempHandle);
    }
  }
}
