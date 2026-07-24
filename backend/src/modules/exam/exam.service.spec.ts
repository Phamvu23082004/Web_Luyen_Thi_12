import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { FileStorage } from '../../common/storage/file-storage';
import { ExamService } from './exam.service';
import { CreateExamDto } from './dto/create-exam.dto';
import type { ParseJobPublisher } from './parse-job.publisher';

const DTO: CreateExamDto = {
  title: 'Giữa kỳ Toán 12',
  subject: 'Toán',
  durationMinutes: 45,
};

const TEACHER_ID = 'teacher-1';

function multerFile(buffer: Buffer): Express.Multer.File {
  // mimetype deliberately claims PDF — the service must validate the BYTES, not
  // this client-supplied label.
  return { buffer, mimetype: 'application/pdf' } as Express.Multer.File;
}

function buildStorageFake() {
  return {
    writeTemp: jest
      .fn<Promise<string>, [Buffer, string]>()
      .mockResolvedValue('/tmp/handle.pdf'),
    publish: jest
      .fn<Promise<void>, [string, string]>()
      .mockResolvedValue(undefined),
    discardTemp: jest
      .fn<Promise<void>, [string]>()
      .mockResolvedValue(undefined),
  } satisfies FileStorage & Record<string, jest.Mock>;
}

function buildPrismaFake() {
  const createdRow = {
    id: 'exam-1',
    title: DTO.title,
    subject: DTO.subject,
    durationMinutes: DTO.durationMinutes,
    teacherId: TEACHER_ID,
    status: 'draft',
    sourceFileUrl: '',
    parseStatus: 'pending',
    parseError: null,
    parseGeneration: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  type Row = typeof createdRow;
  const create = jest
    .fn<Promise<Row>, [{ data: Record<string, unknown> }]>()
    .mockResolvedValue(createdRow);
  const update = jest
    .fn<
      Promise<Row>,
      [{ where: { id: string }; data: Record<string, unknown> }]
    >()
    .mockImplementation(({ data }) =>
      Promise.resolve({ ...createdRow, ...data }),
    );
  const transaction = jest.fn();
  const prisma = { exam: { create, update }, $transaction: transaction };
  // Interactive form — set after `prisma` exists so the callback can receive it
  // as the transactional client; its writes only run when invoked, so a throw
  // inside genuinely skips the rest (mirrors auth.service.spec.ts).
  transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
    fn(prisma),
  );
  return prisma;
}

function buildPublisherFake() {
  return {
    publish: jest.fn<Promise<void>, [unknown]>().mockResolvedValue(undefined),
  } satisfies Pick<ParseJobPublisher, 'publish'> & Record<string, jest.Mock>;
}

describe('ExamService.createDraftFromPdf', () => {
  let prisma: ReturnType<typeof buildPrismaFake>;
  let storage: ReturnType<typeof buildStorageFake>;
  let publisher: ReturnType<typeof buildPublisherFake>;
  let service: ExamService;

  beforeEach(() => {
    prisma = buildPrismaFake();
    storage = buildStorageFake();
    publisher = buildPublisherFake();
    service = new ExamService(
      prisma as unknown as PrismaService,
      storage,
      publisher as unknown as ParseJobPublisher,
    );
  });

  it('rejects a non-PDF buffer even when the mimetype claims application/pdf', async () => {
    await expect(
      service.createDraftFromPdf(
        TEACHER_ID,
        DTO,
        multerFile(Buffer.from('GIF89a not a pdf')),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    // Rejected on the bytes alone — nothing was written or created.
    expect(storage.writeTemp).not.toHaveBeenCalled();
    expect(prisma.exam.create).not.toHaveBeenCalled();
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it('writes the temp file, creates a Draft/pending row, and returns it', async () => {
    const result = await service.createDraftFromPdf(
      TEACHER_ID,
      DTO,
      multerFile(Buffer.from('%PDF-1.7 body')),
    );

    // status/parse_status are DB defaults — the service must NOT set them.
    const createArg = prisma.exam.create.mock.calls[0][0];
    expect(createArg.data).toEqual({
      title: DTO.title,
      subject: DTO.subject,
      durationMinutes: DTO.durationMinutes,
      teacherId: TEACHER_ID,
      sourceFileUrl: '',
    });
    expect(createArg.data).not.toHaveProperty('status');
    expect(createArg.data).not.toHaveProperty('parseStatus');

    // temp write happens before the row is stamped with the id-derived key.
    expect(storage.writeTemp).toHaveBeenCalledWith(expect.any(Buffer), 'pdf');
    expect(storage.publish).toHaveBeenCalledWith(
      '/tmp/handle.pdf',
      'exams/exam-1/source.pdf',
    );
    expect(result.status).toBe('draft');
    expect(result.parseStatus).toBe('pending');
    expect(result.sourceFileUrl).toBe('exams/exam-1/source.pdf');

    // The success path still calls discardTemp (a no-op after the rename).
    expect(storage.discardTemp).toHaveBeenCalledWith('/tmp/handle.pdf');

    // AC 4: the job is published exactly once, AFTER the transaction commits,
    // with the message shape the Story 2.2 consumer will read.
    expect(publisher.publish).toHaveBeenCalledTimes(1);
    expect(publisher.publish).toHaveBeenCalledWith({
      examId: 'exam-1',
      sourceFileRef: 'exams/exam-1/source.pdf',
      parseGeneration: 1,
    });
  });

  it('still returns the exam when the publisher throws (dual-write gap accepted)', async () => {
    publisher.publish.mockRejectedValueOnce(new Error('broker unreachable'));

    const result = await service.createDraftFromPdf(
      TEACHER_ID,
      DTO,
      multerFile(Buffer.from('%PDF-1.7 body')),
    );

    // The publish failure must not propagate and must not turn a successful
    // upload into a failed one — the exam is created, the file is stored, and
    // parse_status stays 'pending' (recoverable via Story 2.3's manual retry).
    expect(result.id).toBe('exam-1');
    expect(result.parseStatus).toBe('pending');
  });

  it('discards the temp file and persists no row when the transaction throws', async () => {
    storage.publish.mockRejectedValueOnce(new Error('rename failed'));

    await expect(
      service.createDraftFromPdf(
        TEACHER_ID,
        DTO,
        multerFile(Buffer.from('%PDF-1.7 body')),
      ),
    ).rejects.toThrow('rename failed');

    // publish failed inside the transaction → the final update never ran, so no
    // row was stamped/committed; the temp file is cleaned up.
    expect(prisma.exam.update).not.toHaveBeenCalled();
    expect(storage.discardTemp).toHaveBeenCalledWith('/tmp/handle.pdf');

    // A transaction throw must never reach the publish step (publish is
    // strictly after commit) — publishing here would enqueue a job for a
    // row that was never persisted.
    expect(publisher.publish).not.toHaveBeenCalled();
  });
});
