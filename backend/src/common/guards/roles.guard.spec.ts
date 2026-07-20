import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import type { Role } from '../../../generated/prisma/client';
import type { AuthUser } from '../types/authenticated-request';

function buildContext(user: AuthUser | undefined): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function buildGuard(requiredRoles: Role[] | undefined) {
  const reflector = {
    getAllAndOverride: jest.fn(() => requiredRoles),
  };
  const guard = new RolesGuard(reflector as unknown as Reflector);
  return { guard };
}

describe('RolesGuard', () => {
  it('allows a route with no @Roles() metadata (auth-only)', () => {
    const { guard } = buildGuard(undefined);
    expect(guard.canActivate(buildContext({ sub: 'u', role: 'student' }))).toBe(
      true,
    );
  });

  it('allows a route with an empty @Roles() list', () => {
    const { guard } = buildGuard([]);
    expect(guard.canActivate(buildContext({ sub: 'u', role: 'student' }))).toBe(
      true,
    );
  });

  it('allows when the user role is in the required list', () => {
    const { guard } = buildGuard(['teacher']);
    expect(guard.canActivate(buildContext({ sub: 'u', role: 'teacher' }))).toBe(
      true,
    );
  });

  // AC 2: both directions must 403 — a one-directional test would pass while a
  // bug lets the other role through.
  it('denies a student token on a teacher-only route (403)', () => {
    const { guard } = buildGuard(['teacher']);
    expect(() =>
      guard.canActivate(buildContext({ sub: 'u', role: 'student' })),
    ).toThrow(ForbiddenException);
  });

  it('denies a teacher token on a student-only route (403)', () => {
    const { guard } = buildGuard(['student']);
    expect(() =>
      guard.canActivate(buildContext({ sub: 'u', role: 'teacher' })),
    ).toThrow(ForbiddenException);
  });

  it('fails closed when request.user is absent (guard-order misconfig)', () => {
    const { guard } = buildGuard(['teacher']);
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
