import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ulid } from 'ulid';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(data: RegisterDto) {
    const { userId, password, email, username } = data;

    // 중복 체크
    const existingUser = await this.prisma.user.findFirst({
      where: { OR: [{ userId }, { email }] },
    });
    if (existingUser) {
      throw new HttpException('User ID or email already exists', HttpStatus.BAD_REQUEST);
    }

    // 비밀번호 해싱
    const passwordHash = await bcrypt.hash(password, 10);

    // ULID 생성
    const id = ulid();

    // 사용자 생성
    const user = await this.prisma.user.create({
      data: {
        id,
        userId,
        passwordHash,
        email,
        username,
        apiKey: ulid(),
      },
    });

    return user;
  }

  async generateJwt(user: any) {
    return this.jwtService.sign({ sub: user.id, userId: user.userId, email: user.email });
  }
}
