import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { IsString } from 'class-validator';

// Inline DTO used only in this spec to prove the exact ValidationPipe
// options configureApp() registers actually enforce AC 4.
class SampleDto {
  @IsString()
  name!: string;
}

describe('Validation baseline (ValidationPipe)', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  it('rejects a payload that fails class-validator rules', async () => {
    await expect(
      pipe.transform({ name: 123 }, { type: 'body', metatype: SampleDto }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unknown fields (forbidNonWhitelisted)', async () => {
    await expect(
      pipe.transform(
        { name: 'ok', extra: 'nope' },
        { type: 'body', metatype: SampleDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts a valid payload and transforms it into the DTO instance', async () => {
    const result = (await pipe.transform(
      { name: 'ok' },
      { type: 'body', metatype: SampleDto },
    )) as SampleDto;
    expect(result).toBeInstanceOf(SampleDto);
    expect(result).toEqual({ name: 'ok' });
  });
});
