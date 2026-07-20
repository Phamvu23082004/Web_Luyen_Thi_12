import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
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
    // Guards need JwtService; the per-verify secret is passed explicitly
    // (mirrors auth.module.ts — two independent JwtModule.register({}) are fine).
    JwtModule.register({}),
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
  providers: [
    AppService,
    // Order is load-bearing: NestJS runs global guards in provider-array order,
    // so authentication (attach request.user) MUST precede authorization (read it).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
