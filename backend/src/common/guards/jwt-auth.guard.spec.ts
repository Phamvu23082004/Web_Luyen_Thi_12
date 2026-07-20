import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthenticatedRequest } from '../types/authenticated-request';

const JWT_SECRET = 'access-secret';

function buildContext(headers: Record<string, string> = {}): {
  context: ExecutionContext;
  request: Partial<AuthenticatedRequest>;
} {
  const request: Partial<AuthenticatedRequest> = { headers };
  const context = {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

function buildGuard(overrides: { isPublic?: boolean; verify?: jest.Mock }) {
  const reflector = {
    getAllAndOverride: jest.fn(() => overrides.isPublic ?? false),
  };
  const jwt = {
    verifyAsync: overrides.verify ?? jest.fn(),
  };
  const config = {
    get: jest.fn((key: string) =>
      key === 'JWT_SECRET' ? JWT_SECRET : undefined,
    ),
  };
  const guard = new JwtAuthGuard(
    reflector as unknown as Reflector,
    jwt as unknown as JwtService,
    config as unknown as ConfigService,
  );
  return { guard, reflector, jwt, config };
}

describe('JwtAuthGuard', () => {
  it('bypasses a @Public() route without requiring a token', async () => {
    const { guard } = buildGuard({ isPublic: true });
    const { context } = buildContext(); // no Authorization header
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects a missing Authorization header with UnauthorizedException', async () => {
    const { guard } = buildGuard({ isPublic: false });
    const { context } = buildContext();
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a non-Bearer scheme with UnauthorizedException', async () => {
    const { guard } = buildGuard({ isPublic: false });
    const { context } = buildContext({ authorization: 'Basic abc.def.ghi' });
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  // AC 1: a missing header, malformed, wrong-secret, and expired token must all
  // reject *identically* — same exception message, so the client can't tell why.
  it('rejects malformed, wrong-secret, and expired tokens with the identical message', async () => {
    const reasons = [
      new Error('jwt malformed'),
      new Error('invalid signature'),
      new Error('jwt expired'),
    ];
    const messages: string[] = [];

    for (const reason of reasons) {
      const verify = jest.fn().mockRejectedValue(reason);
      const { guard } = buildGuard({ isPublic: false, verify });
      const { context } = buildContext({
        authorization: 'Bearer some.jwt.token',
      });
      await guard.canActivate(context).catch((err: UnauthorizedException) => {
        expect(err).toBeInstanceOf(UnauthorizedException);
        messages.push(err.message);
      });
    }

    // Also capture the missing-header path's message for the same comparison.
    const { guard: guardNoHeader } = buildGuard({ isPublic: false });
    const { context: ctxNoHeader } = buildContext();
    await guardNoHeader
      .canActivate(ctxNoHeader)
      .catch((err: UnauthorizedException) => messages.push(err.message));

    expect(messages).toHaveLength(4);
    expect(new Set(messages).size).toBe(1); // all identical
    expect(messages[0]).toBe('Unauthorized');
  });

  it('accepts a valid token and attaches { sub, role } to request.user', async () => {
    const verify = jest
      .fn()
      .mockResolvedValue({ sub: 'user-1', role: 'teacher' });
    const { guard, jwt } = buildGuard({ isPublic: false, verify });
    const { context, request } = buildContext({
      authorization: 'Bearer valid.jwt.token',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ sub: 'user-1', role: 'teacher' });
    // Verified statelessly with JWT_SECRET only (no store hit).
    expect(jwt.verifyAsync).toHaveBeenCalledWith('valid.jwt.token', {
      secret: JWT_SECRET,
    });
  });
});
