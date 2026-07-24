import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// `@IsNotEmpty()` alone accepts whitespace-only strings (`' '` is non-empty);
// trimming first makes an all-whitespace title/subject fail validation too.
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateExamDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  subject!: string;

  // `@Type(() => Number)` is required: multipart text fields arrive as strings,
  // and the global ValidationPipe runs `transform: true` WITHOUT
  // `enableImplicitConversion` (configure-app.ts). Without this, `@IsInt()` sees a
  // string and rejects every request. Story 2.9 owns the repo-wide call on
  // enableImplicitConversion (deferred-work.md); the explicit form is used here.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(600)
  durationMinutes!: number;
}
