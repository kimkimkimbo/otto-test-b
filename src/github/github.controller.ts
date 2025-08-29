// src/github/github.controller.ts
import { Controller, Get } from '@nestjs/common';
import { testGitHubApp } from './testGitHubApp';

@Controller('github')
export class GitHubController {
    /**
     * 백엔드 테스트용 API
     * GitHub App 설치 토큰 발급 및 설치된 레포 조회
     * 프론트에서 useEffect로 호출
     */
    @Get('test')
    async test() {
        try {
            const repos = await testGitHubApp(); // 모든 설치된 레포 조회
            return { success: true, result: repos };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }
}
