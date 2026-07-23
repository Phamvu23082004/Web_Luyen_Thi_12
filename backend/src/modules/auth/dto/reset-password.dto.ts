import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  // bcrypt ignores everything past 72 bytes — roughly 24 Vietnamese characters
  // in UTF-8 — so without this cap a long passphrase is silently truncated and
  // the user ends up with a weaker credential than the one they chose.
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}
