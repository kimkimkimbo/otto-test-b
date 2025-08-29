## 회원가입 설계

### 1. 데이터베이스 (PostgreSQL with Prisma, ULID)
#### 개요
- **DB**: PostgreSQL, Prisma ORM 사용.
- **ID 생성**: ULID (`ulid` 패키지)로 고유하고 정렬 가능한 식별자 생성.
- **GitHub 정보**: 별도 테이블로 관리 예정, 현재는 `User` 테이블만 정의.
- **목적**: 사용자 등록 및 인증 정보 저장, 이후 GitHub 연동 준비.

#### 스키마 (Prisma)
```prisma
// schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  USER
  ADMIN
}

model User {
  id            String   @id // ULID
  userId        String   @unique // 입력받은 ID
  passwordHash  String   // bcrypt 해시
  email         String   @unique
  username      String
  role          Role     @default(USER)
  apiKey        String?  @unique // Jenkins 스타일 API 키
  createdAt     DateTime @default(now())
}
```

#### ULID 적용
- **패키지**: `ulid` (`npm install ulid`).
- **구현**: Prisma에서 `@default(uuid())` 대신 백엔드에서 ULID 생성.
  ```ts
  import { ulid } from 'ulid';
  const newId = ulid(); // 예: 01ARZ3NDEKTSV4RRFFQ69G5FAV
  ```

#### 보안
- **비밀번호**: `bcrypt`로 해싱 (10 rounds).
- **API 키**: ULID로 생성, Jenkins처럼 외부 호출 인증용.
- **환경 변수**: `.env`에 `DATABASE_URL`, `JWT_SECRET` 저장.

---

### 2. 백엔드 (NestJS, TypeScript)
#### 개요
- **프레임워크**: NestJS, REST API 제공.
- **인증**: JWT (`@nestjs/jwt`), bcrypt로 패스워드 검증.
- **목적**: 회원가입 요청 처리, 데이터베이스 저장, JWT 발급.

#### 모듈 구조
```
src/
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── dto/
│   │   ├── register.dto.ts
├── prisma/
│   ├── prisma.service.ts
├── main.ts
```

#### 코드 구현
1. **DTO** (`auth/dto/register.dto.ts`):
   ```ts
   import { IsString, IsEmail, MinLength } from 'class-validator';

   export class RegisterDto {
     @IsString()
     userId: string;

     @IsString()
     @MinLength(8)
     password: string;

     @IsEmail()
     email: string;

     @IsString()
     username: string;
   }
   ```

2. **서비스** (`auth/auth.service.ts`):
   ```ts
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
   ```

3. **컨트롤러** (`auth/auth.controller.ts`):
   ```ts
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
   ```

4. **모듈** (`auth/auth.module.ts`):
   ```ts
   import { Module } from '@nestjs/common';
   import { AuthController } from './auth.controller';
   import { AuthService } from './auth.service';
   import { PrismaService } from '../prisma/prisma.service';
   import { JwtModule } from '@nestjs/jwt';

   @Module({
     imports: [
       JwtModule.register({
         secret: process.env.JWT_SECRET,
         signOptions: { expiresIn: '1h' },
       }),
     ],
     controllers: [AuthController],
     providers: [AuthService, PrismaService],
   })
   export class AuthModule {}
   ```

#### 환경 변수
```env
# .env
DATABASE_URL=postgresql://user:password@localhost:5432/db
JWT_SECRET=your-jwt-secret
```

---

### 3. 프론트엔드 (Next.js, Tailwind, TypeScript)
#### 개요
- **프레임워크**: Next.js, Tailwind로 스타일링, TypeScript로 타입 안전성.
- **목적**: 회원가입 폼 제공, 백엔드 API 호출, JWT 저장.

#### 코드 구현
1. **회원가입 폼** (`components/RegisterForm.tsx`):
   ```tsx
   'use client';

   import { useState } from 'react';
   import axios from 'axios';

   interface RegisterFormData {
     userId: string;
     password: string;
     email: string;
     username: string;
   }

   export default function RegisterForm() {
     const [formData, setFormData] = useState<RegisterFormData>({
       userId: '',
       password: '',
       email: '',
       username: '',
     });
     const [error, setError] = useState<string | null>(null);

     const handleSubmit = async (e: React.FormEvent) => {
       e.preventDefault();
       try {
         const res = await axios.post('/api/v1/register', formData);
         localStorage.setItem('token', res.data.token);
         window.location.href = '/dashboard';
       } catch (err: any) {
         setError(err.response?.data?.error || 'Registration failed');
       }
     };

     return (
       <div className="max-w-md mx-auto p-6 bg-white shadow-lg rounded-lg">
         <h1 className="text-2xl font-bold mb-6 text-center">Register</h1>
         {error && <p className="text-red-500 mb-4">{error}</p>}
         <form onSubmit={handleSubmit} className="space-y-4">
           <div>
             <label className="block text-sm font-medium text-gray-700">User ID</label>
             <input
               type="text"
               value={formData.userId}
               onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
               placeholder="User ID"
               className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
               required
             />
           </div>
           <div>
             <label className="block text-sm font-medium text-gray-700">Password</label>
             <input
               type="password"
               value={formData.password}
               onChange={(e) => setFormData({ ...formData, password: e.target.value })}
               placeholder="Password (min 8 characters)"
               className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
               required
               minLength={8}
             />
           </div>
           <div>
             <label className="block text-sm font-medium text-gray-700">Email</label>
             <input
               type="email"
               value={formData.email}
               onChange={(e) => setFormData({ ...formData, email: e.target.value })}
               placeholder="Email"
               className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
               required
             />
           </div>
           <div>
             <label className="block text-sm font-medium text-gray-700">Username</label>
             <input
               type="text"
               value={formData.username}
               onChange={(e) => setFormData({ ...formData, username: e.target.value })}
               placeholder="Username"
               className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
               required
             />
           </div>
           <button
             type="submit"
             className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
           >
             Register
           </button>
         </form>
       </div>
     );
   }
   ```

2. **페이지** (`pages/register.tsx`):
   ```tsx
   import RegisterForm from '../components/RegisterForm';

   export default function RegisterPage() {
     return (
       <div className="min-h-screen flex items-center justify-center bg-gray-100">
         <RegisterForm />
       </div>
     );
   }
   ```

#### 보안
- **입력 검증**: 프론트에서 `required`, `minLength`로 기본 검증, 백엔드에서 `class-validator`로 추가 검증.
- **JWT 저장**: `localStorage` 사용 (HTTP-only 쿠키 대안 가능).
- **HTTPS**: 모든 API 호출에 HTTPS 필수.

---

### 4. Jenkins 레퍼런스 반영
- **회원가입**: Jenkins처럼 간단한 입력(`id`, `password`, `email`, `username`)으로 사용자 생성.
- **API 키**: `apiKey` 필드(ULID)로 Jenkins 스타일의 외부 호출 인증 지원.
- **역할**: `Role` 열거형으로 Admin/User 구분, Jenkins의 RBAC 유사.

---

### 5. 추가 팁
- **ULID 통합**:
  ```ts
  // prisma.service.ts
  import { PrismaClient } from '@prisma/client';
  import { ulid } from 'ulid';

  export class PrismaService extends PrismaClient {
    async createUser(data: any) {
      return this.user.create({
        data: {
          ...data,
          id: ulid(),
          apiKey: ulid(),
        },
      });
    }
  }
  ```
- **테스트**:
  - Jest로 백엔드 단위 테스트 (`auth.service.ts`).
  - Cypress로 프론트엔드 E2E 테스트 (`RegisterForm.tsx`).

- **확장**: GitHub 테이블은 나중에 `User.id`를 외래 키로 참조하도록 설계.

---
