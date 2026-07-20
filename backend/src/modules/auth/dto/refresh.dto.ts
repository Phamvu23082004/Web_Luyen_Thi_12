import { IsNotEmpty, IsString } from 'class-validator';

// Shared shape for both /api/auth/refresh and /api/auth/logout bodies.
export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
