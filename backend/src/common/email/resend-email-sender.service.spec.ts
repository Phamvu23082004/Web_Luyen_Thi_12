import { ConfigService } from '@nestjs/config';
import { ResendEmailSenderService } from './resend-email-sender.service';

const CONFIG: Record<string, string> = {
  EMAIL_PROVIDER_API_KEY: 'test-api-key',
  EMAIL_FROM_ADDRESS: 'onboarding@resend.dev',
};

interface ResendRequestBody {
  from: string;
  to: string;
  subject: string;
  html: string;
}

function buildService() {
  const config = { get: jest.fn((key: string) => CONFIG[key]) };
  const service = new ResendEmailSenderService(
    config as unknown as ConfigService,
  );
  return { service, config };
}

// spyOn (not `global.fetch = ...`) so restoreAllMocks actually puts the real
// implementation back — a direct assignment is not a spy and survives cleanup.
function stubFetch(impl: () => Promise<Pick<Response, 'ok' | 'status'>>) {
  return jest
    .spyOn(global, 'fetch')
    .mockImplementation(impl as unknown as typeof fetch);
}

describe('ResendEmailSenderService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('POSTs to Resend with the bearer token and JSON body', async () => {
    const { service } = buildService();
    const fetchMock = stubFetch(() =>
      Promise.resolve({ ok: true, status: 200 }),
    );

    await service.sendPasswordResetEmail(
      'student@onthi12.local',
      'http://localhost:5173/reset-password?token=abc123',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-api-key',
          'Content-Type': 'application/json',
        }) as HeadersInit,
        // Without this the request can hang forever on a provider that accepts
        // the connection and never answers (NFR-11).
        signal: expect.anything() as AbortSignal,
      }),
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as ResendRequestBody;
    expect(body.from).toBe('onboarding@resend.dev');
    expect(body.to).toBe('student@onthi12.local');
    expect(body.subject).toBe('Đặt lại mật khẩu OnThi12');
    expect(body.html).toContain(
      'http://localhost:5173/reset-password?token=abc123',
    );
  });

  it('throws on a non-2xx response, naming the status but never the key or link', async () => {
    const { service } = buildService();
    stubFetch(() => Promise.resolve({ ok: false, status: 401 }));

    const error: unknown = await service
      .sendPasswordResetEmail(
        'student@onthi12.local',
        'http://localhost:5173/reset-password?token=abc123',
      )
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    // The status is the whole diagnostic — 401 (bad key) vs 403 (unverified
    // sender) vs 429 (quota) are otherwise indistinguishable in the caller's log.
    expect((error as Error).message).toContain('401');
    expect((error as Error).message).not.toContain('test-api-key');
    expect((error as Error).message).not.toContain('token=abc123');
  });

  it('propagates a network-level rejection (DNS failure, reset connection, timeout)', async () => {
    const { service } = buildService();
    stubFetch(() => Promise.reject(new Error('ECONNRESET')));

    await expect(
      service.sendPasswordResetEmail(
        'student@onthi12.local',
        'http://localhost:5173/reset-password?token=abc123',
      ),
    ).rejects.toThrow('ECONNRESET');
  });
});
