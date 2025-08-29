import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';

@Controller('api/v1')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    const user = await this.authService.register(body);
    const jwt = await this.authService.generateJwt(user);
    return {
      token: jwt,
      user: {
        id: user.id,
        userId: user.userId,
        email: user.email,
        username: user.username,
      },
    };
  }
}
