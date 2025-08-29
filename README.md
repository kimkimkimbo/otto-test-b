

# GitHub App 연동 프로젝트 정리

## 1. 프로젝트 목적

* **GitHub App 설치/관리 자동화**
  사용자나 팀 레포에 GitHub App을 설치하고, 설치된 저장소 정보를 조회하며, 필요 시 웹훅 이벤트를 처리하기 위함.
* **백엔드와 프론트 통합 테스트**
  NestJS 백엔드에서 GitHub App API 호출 및 설치 토큰 발급 테스트, React 프론트에서 설치 버튼과 설치 상태 확인 UI 제공.

---

## 2. 프로젝트 구조

```
otto-test-b/
├─ src/
│  ├─ main.ts              # NestJS 앱 진입점
│  ├─ app.module.ts        # NestJS 모듈 설정
│  ├─ github/
│  │  ├─ github.controller.ts  # GitHub 관련 엔드포인트 (웹훅/테스트)
│  │  ├─ testGitHubApp.ts      # GitHub App 테스트 스크립트 (JWT, 설치 토큰, 레포 조회)
├─ .env                    # 로컬 개발용 환경 변수
```

프론트:

```
otto-front/
├─ app/
│  ├─ page.tsx             # 메인 페이지, InstallButton 포함
│  ├─ test.tsx             # API 호출 테스트 및 상태 표시
│  └─ components/
│     └─ GitHubInstallButton.tsx  # GitHub App 설치 버튼
```

---

## 3. 환경 변수 설정 (.env)

```env
GITHUB_APP_ID=your_app_id
GITHUB_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=your_webhook_secret
```

* `GITHUB_APP_ID`: GitHub App ID
* `GITHUB_PRIVATE_KEY`: GitHub App RSA private key (줄바꿈은 `\n`로)
* `GITHUB_WEBHOOK_SECRET`: 웹훅 검증용 시크릿

---

## 4. 백엔드 동작

### 4-1. GitHubController

* 경로: `/github/webhook` (POST)
* 역할: GitHub App 웹훅 이벤트 수신
* 처리 흐름:

  1. `@Req()`로 요청 본문 수신
  2. `@Headers('x-github-event')`로 이벤트 타입 확인
  3. `installation` 이벤트 감지 시 `testGitHubApp` 실행
  4. 설치 완료 후 설치된 레포 조회 및 로그 출력

### 4-2. testGitHubApp.ts

* 역할: GitHub App 테스트 스크립트
* 처리 흐름:

  1. **환경 변수 로드**

     * 로컬 개발이면 `.env` 사용, 배포 환경 변수도 가능
  2. **JWT 생성**

     * GitHub App ID와 private key로 RS256 JWT 생성 (만료 10분)
  3. **설치 목록 조회**

     * `GET /app/installations` 호출
  4. **설치 토큰 발급**

     * 첫 번째 설치의 installationId를 이용해 `POST /app/installations/:id/access_tokens`
  5. **접근 가능한 저장소 조회**

     * 발급된 토큰으로 `GET /installation/repositories`
  6. **웹훅 생성(선택)**

     * 필요 시 `POST /repos/:owner/:repo/hooks`

---

## 5. 프론트 동작

### 5-1. GitHubInstallButton.tsx

* 역할: 사용자가 GitHub App 설치 페이지로 이동할 수 있는 버튼 제공
* 클릭 시 GitHub 설치 페이지 이동

### 5-2. page.tsx

* 역할: GitHub App 설치 상태 표시 UI
* 처리 흐름:

  1. `useEffect`로 `/github/test` API 호출
  2. 설치 정보 JSON 형태로 화면에 표시
  3. InstallButton 클릭 시 GitHub App 설치 페이지로 이동

---

## 6. NestJS 실행 방법

1. 프로젝트 루트로 이동: `cd otto-test-b`
2. 의존성 설치: `npm install`
3. 서버 실행: `npm run start`
4. 기본 포트: `3001` (설정 가능)

---

## 7. GitHub App 설치 & 테스트 흐름

1. 사용자가 프론트에서 **InstallButton** 클릭
2. GitHub 로그인 후 App 설치 페이지로 이동
3. 설치 완료 시 GitHub 서버가 **웹훅 요청**을 백엔드 `/github/webhook`으로 전송
4. 백엔드에서 `testGitHubApp` 실행

   * 설치 토큰 발급
   * 접근 가능한 저장소 조회
   * (선택) 웹훅 등록
5. 프론트에서 설치 정보 API(`/github/test`) 호출 시 상태 확인

---

## 8. 주의 사항

* `ts-node` 실행 시 항상 **프로젝트 루트**에서 실행
* 포트 충돌 시 `EADDRINUSE` 에러 발생 → 다른 포트 지정
* `.env` 파일은 배포 시 절대 포함하지 말 것
* 웹훅 이벤트를 기다리는 구조이므로, 설치되지 않은 App은 저장소 조회 실패
