import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS 활성화: 다른 포트(Next.js 3000)에서 API 호출 가능
  app.enableCors();

  // ValidationPipe 추가
  app.useGlobalPipes(new ValidationPipe());

  // 백엔드 서버 포트 설정
  await app.listen(3001);
  console.log('NestJS backend running on http://localhost:3001');
}
bootstrap();
