// src/github/testGitHubApp.ts
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

if (process.env.NODE_ENV !== 'production') {
    const envPath = path.resolve(__dirname, '../../.env');
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
    }
}

const githubId = process.env.GITHUB_APP_ID;
const privateKey = process.env.GITHUB_PRIVATE_KEY?.replace(/\\n/g, '\n');


export async function testGitHubApp() {

    if (!githubId || !privateKey) throw new Error('환경 변수 미설정');

    const jwtToken = jwt.sign({ iss: Number(githubId) }, privateKey, {
        algorithm: 'RS256',
        expiresIn: '10m',
    });


    // 설치 목록 조회
    const installationsResponse = await fetch('https://api.github.com/app/installations', {
        headers: {
            Authorization: `Bearer ${jwtToken}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'GitHubAppTest/1.0',
        },
    });
    const installationsData = await installationsResponse.json();
    console.log('installations status:', installationsResponse.status, 'data:', installationsData);
    // 실제 응답은 배열
    const installations = Array.isArray(installationsData) ? installationsData : installationsData.installations ?? [];
    if (!installations.length) return [];


    // 첫 번째 설치 토큰 발급
    const installationId = installations[0].id;
    const tokenResponse = await fetch(
        `https://api.github.com/app/installations/${installationId}/access_tokens`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${jwtToken}`,
                Accept: 'application/vnd.github.v3+json',
                'User-Agent': 'GitHubAppTest/1.0',
            },
        }
    );
    const accessTokenData = await tokenResponse.json();
    console.log('access token status:', tokenResponse.status, 'data:', accessTokenData);
    const installationToken = accessTokenData.token;


    // 설치된 레포 조회
    const reposResponse = await fetch('https://api.github.com/installation/repositories', {
        headers: {
            Authorization: `Bearer ${installationToken}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'GitHubAppTest/1.0',
        },
    });
    const reposData = await reposResponse.json();
    console.log('repos status:', reposResponse.status, 'data:', reposData);
    return reposData.repositories?.map((repo: any) => repo.full_name) ?? [];
}
