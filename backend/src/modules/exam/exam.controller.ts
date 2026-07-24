import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AiParseRateLimitGuard } from '../../common/guards/ai-parse-rate-limit.guard';
import type { AuthUser } from '../../common/types/authenticated-request';
import { CreateExamDto } from './dto/create-exam.dto';
import { ExamService } from './exam.service';

@Controller('exams')
export class ExamController {
  constructor(private readonly examService: ExamService) {}

  // Teacher-only via the global RolesGuard (@Roles('teacher')). The multer options
  // (memoryStorage + EXAM_PDF_MAX_BYTES limit) come from MulterModule in
  // exam.module.ts, so `FileInterceptor('file')` carries no inline options here.
  // NestJS 11 maps multer's own errors correctly with no custom filter:
  // LIMIT_FILE_SIZE → 413, LIMIT_FILE_COUNT/LIMIT_UNEXPECTED_FILE → 400.
  // AiParseRateLimitGuard runs before FileInterceptor (guards precede
  // interceptors in NestJS 11), so a throttled teacher never buffers a PDF.
  @Post()
  @Roles('teacher')
  @UseGuards(AiParseRateLimitGuard)
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateExamDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    // AC 3: no PDF, no exam. teacherId comes from the verified JWT, never the body.
    if (!file) {
      throw new BadRequestException('A PDF file is required');
    }
    const exam = await this.examService.createDraftFromPdf(user.sub, dto, file);
    // The global ResponseInterceptor wraps this as { data: ... } (AD-16) — do not
    // hand-build the envelope. source_file_url is intentionally not exposed.
    return {
      id: exam.id,
      title: exam.title,
      subject: exam.subject,
      durationMinutes: exam.durationMinutes,
      status: exam.status,
      parseStatus: exam.parseStatus,
    };
  }
}
