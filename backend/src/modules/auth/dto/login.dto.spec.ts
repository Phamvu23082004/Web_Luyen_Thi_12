import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { LoginDto } from './login.dto';

// Pattern-matches common/validation-baseline.spec.ts — proves the exact
// ValidationPipe options configureApp() registers reject a client-supplied
// `role` field (AC 4: client-supplied role is never trusted).
describe('LoginDto whitelist (AC 4)', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  it('rejects a login payload that includes a role field', async () => {
    await expect(
      pipe.transform(
        {
          email: 'student1@onthi12.local',
          password: 'Password123!',
          role: 'teacher',
        },
        { type: 'body', metatype: LoginDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts a valid login payload with no extra fields', async () => {
    const result = (await pipe.transform(
      { email: 'student1@onthi12.local', password: 'Password123!' },
      { type: 'body', metatype: LoginDto },
    )) as LoginDto;
    expect(result).toBeInstanceOf(LoginDto);
    expect(result).toEqual({
      email: 'student1@onthi12.local',
      password: 'Password123!',
    });
  });
});
