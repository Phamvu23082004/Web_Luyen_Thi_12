import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { ExamModule } from './modules/exam/exam.module';
import { AiParsingModule } from './modules/ai-parsing/ai-parsing.module';
import { SubmissionModule } from './modules/submission/submission.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ClassModule } from './modules/class/class.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';

@Module({
  imports: [
    // `backend/.env` first (local override, also what the Prisma CLI reads),
    // then the repo-root `.env` that `.env.example` documents and compose loads.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../.env'] }),
    PrismaModule,
    RedisModule,
    AuthModule,
    ExamModule,
    AiParsingModule,
    SubmissionModule,
    DashboardModule,
    ClassModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
