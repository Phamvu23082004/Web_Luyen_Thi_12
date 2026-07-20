import { Controller, Get, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { Public } from './../src/common/decorators/public.decorator';
import { Roles } from './../src/common/decorators/roles.decorator';
import { CurrentUser } from './../src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from './../src/common/guards/jwt-auth.guard';
import { RolesGuard } from './../src/common/guards/roles.guard';
import { configureApp } from './../src/common/configure-app';
import type { AuthUser } from './../src/common/types/authenticated-request';

const JWT_SECRET = 'e2e-access-secret';

// Throwaway controller — exists only to exercise the global guard wiring end-to-end.
// It is NOT product surface: no feature endpoint exists to guard yet (Epic 2's
// Story 2.1 is the first real @Roles('teacher') consumer). Keep it in-spec.
@Controller()
class GuardProbeController {
  @Public()
  @Get('open')
  open(): { ok: boolean } {
    return { ok: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }

  @Roles('teacher')
  @Get('teacher-only')
  teacherOnly(): { area: string } {
    return { area: 'teacher' };
  }

  @Roles('student')
  @Get('student-only')
  studentOnly(): { area: string } {
    return { area: 'student' };
  }
}

describe('RolesGuard global wiring (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;

  const sign = (payload: AuthUser): string =>
    jwt.sign(payload, { secret: JWT_SECRET });
  const bearer = (payload: AuthUser) => `Bearer ${sign(payload)}`;

  const studentToken = () => bearer({ sub: 'student-1', role: 'student' });
  const teacherToken = () => bearer({ sub: 'teacher-1', role: 'teacher' });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ JWT_SECRET })],
        }),
        JwtModule.register({}),
      ],
      controllers: [GuardProbeController],
      providers: [
        // Same order as production (app.module.ts): authenticate before authorize.
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    jwt = app.get(JwtService);
    configureApp(app);
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows a @Public() route with no token', () => {
    return request(app.getHttpServer())
      .get('/api/open')
      .expect(200)
      .expect({ data: { ok: true } });
  });

  it('rejects an auth-only route with no token (401)', () => {
    return request(app.getHttpServer()).get('/api/me').expect(401);
  });

  it('rejects an auth-only route with a garbage token (401)', () => {
    return request(app.getHttpServer())
      .get('/api/me')
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(401);
  });

  it('allows an auth-only route with a valid token and returns the verified user', () => {
    return request(app.getHttpServer())
      .get('/api/me')
      .set('Authorization', teacherToken())
      .expect(200)
      .expect({ data: { sub: 'teacher-1', role: 'teacher' } });
  });

  it('denies a student token on a teacher-only route (403, not the data)', () => {
    return request(app.getHttpServer())
      .get('/api/teacher-only')
      .set('Authorization', studentToken())
      .expect(403)
      .expect((res) => {
        const body = res.body as Record<string, unknown>;
        expect(body.data).toBeUndefined();
        expect(body.area).toBeUndefined();
      });
  });

  it('allows a teacher token on a teacher-only route', () => {
    return request(app.getHttpServer())
      .get('/api/teacher-only')
      .set('Authorization', teacherToken())
      .expect(200)
      .expect({ data: { area: 'teacher' } });
  });

  it('denies a teacher token on a student-only route (403, not the data)', () => {
    return request(app.getHttpServer())
      .get('/api/student-only')
      .set('Authorization', teacherToken())
      .expect(403)
      .expect((res) => {
        const body = res.body as Record<string, unknown>;
        expect(body.data).toBeUndefined();
        expect(body.area).toBeUndefined();
      });
  });

  it('allows a student token on a student-only route', () => {
    return request(app.getHttpServer())
      .get('/api/student-only')
      .set('Authorization', studentToken())
      .expect(200)
      .expect({ data: { area: 'student' } });
  });
});
