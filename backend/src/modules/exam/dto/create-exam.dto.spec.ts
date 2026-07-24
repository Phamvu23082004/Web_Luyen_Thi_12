import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateExamDto } from './create-exam.dto';

// Whitespace-only title/subject must fail validation, not just empty-string
// (code review of story-2-1a, 2026-07-24) — @IsNotEmpty() alone treats ' ' as
// non-empty.
describe('CreateExamDto whitespace handling', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  it('rejects a whitespace-only title', async () => {
    await expect(
      pipe.transform(
        { title: '   ', subject: 'Toán', durationMinutes: '45' },
        { type: 'body', metatype: CreateExamDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a whitespace-only subject', async () => {
    await expect(
      pipe.transform(
        { title: 'Giữa kỳ', subject: '\t\n', durationMinutes: '45' },
        { type: 'body', metatype: CreateExamDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('trims surrounding whitespace on an otherwise valid payload', async () => {
    const result = (await pipe.transform(
      { title: '  Giữa kỳ Toán  ', subject: ' Toán ', durationMinutes: '45' },
      { type: 'body', metatype: CreateExamDto },
    )) as CreateExamDto;
    expect(result.title).toBe('Giữa kỳ Toán');
    expect(result.subject).toBe('Toán');
  });
});
