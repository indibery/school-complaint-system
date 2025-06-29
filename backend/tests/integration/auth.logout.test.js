const request = require('supertest');
const { createTestApp } = require('../helpers/testApp');
const { 
  createTestUser, 
  expectSuccess, 
  expectError,
  dbHelpers,
  generateTestTokens,
  createAuthHeader,
  addTokenToBlacklist
} = require('../helpers/testHelpers');

describe('🚪 로그아웃 API 테스트', () => {
  let app;

  beforeAll(async () => {
    app = createTestApp();
  });

  describe('POST /api/auth/logout', () => {
    
    describe('✅ 성공 케이스', () => {
      
      test('단일 디바이스 로그아웃 성공', async () => {
        const user = await createTestUser({
          email: 'logout@test.com',
          is_email_verified: true
        });
        
        const tokens = generateTestTokens(user.id);

        const response = await request(app)
          .post('/api/auth/logout')
          .set(createAuthHeader(tokens.accessToken))
          .expect(200);

        const result = expectSuccess(response);
        expect(result.message).toContain('로그아웃되었습니다');

        // 토큰이 블랙리스트에 추가되었는지 확인
        const blacklistedToken = await dbHelpers.getTokenFromBlacklist(tokens.accessTokenPayload.jti);
        expect(blacklistedToken).toBeTruthy();
      });

      test('액세스 토큰으로 로그아웃 후 리프레시 토큰 무효화', async () => {
        const user = await createTestUser({
          email: 'refresh-logout@test.com',
          is_email_verified: true
        });
        
        const tokens = generateTestTokens(user.id);

        // 액세스 토큰으로 로그아웃
        const response = await request(app)
          .post('/api/auth/logout')
          .set(createAuthHeader(tokens.accessToken))
          .expect(200);

        const result = expectSuccess(response);
        expect(result.message).toContain('로그아웃되었습니다');

        // 액세스 토큰이 블랙리스트에 추가되었는지 확인
        const blacklistedToken = await dbHelpers.getTokenFromBlacklist(tokens.accessTokenPayload.jti);
        expect(blacklistedToken).toBeTruthy();
      });

    });

    describe('❌ 실패 케이스', () => {
      
      test('토큰 없이 로그아웃 시도', async () => {
        const response = await request(app)
          .post('/api/auth/logout')
          .expect(401);

        const result = expectError(response, 401);
        expect(result.message).toContain('인증이 필요합니다');
      });

      test('잘못된 토큰으로 로그아웃 시도', async () => {
        const response = await request(app)
          .post('/api/auth/logout')
          .set(createAuthHeader('invalid-token'))
          .expect(401);

        const result = expectError(response, 401);
        expect(result.message).toContain('유효하지 않은 토큰');
      });

      test('이미 블랙리스트된 토큰으로 로그아웃 시도', async () => {
        const user = await createTestUser({
          email: 'blacklisted@test.com',
          is_email_verified: true
        });
        
        const tokens = generateTestTokens(user.id);
        
        // 토큰을 미리 블랙리스트에 추가
        await addTokenToBlacklist(tokens.accessTokenPayload.jti, user.id);

        const response = await request(app)
          .post('/api/auth/logout')
          .set(createAuthHeader(tokens.accessToken))
          .expect(401);

        const result = expectError(response, 401);
        expect(result.message).toContain('무효화된 토큰');
      });

    });

  });

  describe('POST /api/auth/logout-all', () => {
    
    describe('✅ 성공 케이스', () => {
      
      test('모든 디바이스 로그아웃 성공', async () => {
        const user = await createTestUser({
          email: 'logout-all@test.com',
          is_email_verified: true
        });
        
        const tokens = generateTestTokens(user.id);
        const initialUser = await dbHelpers.getUserById(user.id);
        const initialTokenVersion = initialUser.token_version;

        const response = await request(app)
          .post('/api/auth/logout-all')
          .set(createAuthHeader(tokens.accessToken))
          .expect(200);

        const result = expectSuccess(response);
        expect(result.message).toContain('모든 디바이스에서 로그아웃되었습니다');

        // 토큰 버전이 증가했는지 확인
        const updatedUser = await dbHelpers.getUserById(user.id);
        expect(updatedUser.token_version).toBe(initialTokenVersion + 1);

        // 현재 토큰이 블랙리스트에 추가되었는지 확인
        const blacklistedToken = await dbHelpers.getTokenFromBlacklist(tokens.accessTokenPayload.jti);
        expect(blacklistedToken).toBeTruthy();
      });

      test('관리자의 다른 사용자 강제 로그아웃', async () => {
        // 관리자 사용자 생성
        const adminUser = await createTestUser({
          email: 'admin@test.com',
          role: 'admin',
          is_email_verified: true
        });

        // 일반 사용자 생성
        const targetUser = await createTestUser({
          email: 'target@test.com',
          is_email_verified: true
        });
        
        const adminTokens = generateTestTokens(adminUser.id);
        const initialTokenVersion = targetUser.token_version;

        const response = await request(app)
          .post('/api/auth/logout-all')
          .set(createAuthHeader(adminTokens.accessToken))
          .send({ userId: targetUser.id })
          .expect(200);

        const result = expectSuccess(response);
        expect(result.message).toContain('사용자의 모든 세션이 종료되었습니다');

        // 대상 사용자의 토큰 버전 증가 확인
        const updatedTargetUser = await dbHelpers.getUserById(targetUser.id);
        expect(updatedTargetUser.token_version).toBe(initialTokenVersion + 1);
      });

    });

    describe('❌ 실패 케이스', () => {
      
      test('권한 없는 사용자의 다른 사용자 로그아웃 시도', async () => {
        // 일반 사용자 생성
        const normalUser = await createTestUser({
          email: 'normal@test.com',
          role: 'parent',
          is_email_verified: true
        });

        // 대상 사용자 생성
        const targetUser = await createTestUser({
          email: 'target2@test.com',
          is_email_verified: true
        });
        
        const normalTokens = generateTestTokens(normalUser.id);

        const response = await request(app)
          .post('/api/auth/logout-all')
          .set(createAuthHeader(normalTokens.accessToken))
          .send({ userId: targetUser.id })
          .expect(403);

        const result = expectError(response, 403);
        expect(result.message).toContain('권한이 없습니다');
      });

    });

  });

  describe('🔄 토큰 갱신 API 테스트', () => {
    
    describe('POST /api/auth/refresh', () => {
      
      test('토큰 갱신 성공', async () => {
        const user = await createTestUser({
          email: 'refresh@test.com',
          password: 'RefreshTest123!',
          is_email_verified: true
        });
        
        // 실제 로그인을 통해 토큰 획득
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'refresh@test.com',
            password: 'RefreshTest123!'
          })
          .expect(200);

        const loginResult = expectSuccess(loginResponse);
        const { accessToken, refreshToken } = loginResult.data.tokens;

        // 토큰 갱신
        const response = await request(app)
          .post('/api/auth/refresh')
          .set(createAuthHeader(accessToken))
          .send({ refreshToken })
          .expect(200);

        const result = expectSuccess(response);
        expect(result.data.accessToken).toBeTruthy();
        expect(result.data.refreshToken).toBeTruthy();
        
        // 새로운 토큰들이 기존과 다른지 확인
        expect(result.data.accessToken).not.toBe(accessToken);
        expect(result.data.refreshToken).not.toBe(refreshToken);

        // 새로운 토큰으로 API 호출 가능한지 확인
        const meResponse = await request(app)
          .get('/api/auth/me')
          .set(createAuthHeader(result.data.accessToken))
          .expect(200);

        const meResult = expectSuccess(meResponse);
        expect(meResult.data.user.id).toBe(user.id);
        expect(meResult.data.user.email).toBe(user.email);
      });

      test('잘못된 리프레시 토큰으로 갱신 시도', async () => {
        const response = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken: 'invalid-refresh-token' })
          .expect(401);

        const result = expectError(response, 401);
        expect(result.message).toContain('유효하지 않은 리프레시 토큰');
      });

      test('블랙리스트된 리프레시 토큰으로 갱신 시도', async () => {
        const user = await createTestUser({
          email: 'blacklist-refresh@test.com',
          is_email_verified: true
        });
        
        const tokens = generateTestTokens(user.id);
        
        // 리프레시 토큰을 블랙리스트에 추가
        await addTokenToBlacklist(tokens.refreshTokenPayload.jti, user.id, 'refresh');

        const response = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken: tokens.refreshToken })
          .expect(401);

        const result = expectError(response, 401);
        expect(result.message).toContain('무효화된 토큰');
      });

      test('토큰 버전 불일치로 갱신 실패', async () => {
        const user = await createTestUser({
          email: 'version-mismatch@test.com',
          is_email_verified: true
        });
        
        const tokens = generateTestTokens(user.id, 0); // 버전 0

        // 사용자의 토큰 버전을 증가시킴
        await global.testPool.query(
          'UPDATE users SET token_version = 1 WHERE id = $1',
          [user.id]
        );

        const response = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken: tokens.refreshToken })
          .expect(401);

        const result = expectError(response, 401);
        expect(result.message).toContain('토큰 버전이 일치하지 않습니다');
      });

    });

  });

  describe('🔐 사용자 정보 조회 API', () => {
    
    describe('GET /api/auth/me', () => {
      
      test('인증된 사용자 정보 조회 성공', async () => {
        const user = await createTestUser({
          email: 'me@test.com',
          name: '내정보',
          role: 'teacher',
          is_email_verified: true
        });
        
        const tokens = generateTestTokens(user.id);

        const response = await request(app)
          .get('/api/auth/me')
          .set(createAuthHeader(tokens.accessToken))
          .expect(200);

        const result = expectSuccess(response);
        expect(result.data.user.id).toBe(user.id);
        expect(result.data.user.email).toBe(user.email);
        expect(result.data.user.name).toBe(user.name);
        expect(result.data.user.role).toBe(user.role);
        expect(result.data.user.password).toBeUndefined(); // 비밀번호 노출 방지
      });

      test('토큰 없이 사용자 정보 조회 시도', async () => {
        const response = await request(app)
          .get('/api/auth/me')
          .expect(401);

        const result = expectError(response, 401);
        expect(result.message).toContain('인증이 필요합니다');
      });

      test('무효한 토큰으로 사용자 정보 조회 시도', async () => {
        const response = await request(app)
          .get('/api/auth/me')
          .set(createAuthHeader('invalid-token'))
          .expect(401);

        const result = expectError(response, 401);
        expect(result.message).toContain('유효하지 않은 토큰');
      });

    });

  });

  describe('🏃‍♂️ 로그인/로그아웃 통합 플로우', () => {
    
    test('전체 인증 플로우 테스트', async () => {
      // 1. 사용자 생성
      const user = await createTestUser({
        email: 'flow@test.com',
        password: 'FlowTest123!',
        is_email_verified: true
      });

      // 2. 로그인
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'flow@test.com',
          password: 'FlowTest123!'
        })
        .expect(200);

      const loginResult = expectSuccess(loginResponse);
      const { accessToken, refreshToken } = loginResult.data.tokens;

      // 3. 사용자 정보 조회
      const meResponse = await request(app)
        .get('/api/auth/me')
        .set(createAuthHeader(accessToken))
        .expect(200);

      expectSuccess(meResponse);

      // 4. 토큰 갱신
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      const refreshResult = expectSuccess(refreshResponse);
      const newAccessToken = refreshResult.data.accessToken;

      // 5. 새 토큰으로 사용자 정보 조회
      const meResponse2 = await request(app)
        .get('/api/auth/me')
        .set(createAuthHeader(newAccessToken))
        .expect(200);

      expectSuccess(meResponse2);

      // 6. 로그아웃
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set(createAuthHeader(newAccessToken))
        .expect(200);

      expectSuccess(logoutResponse);

      // 7. 로그아웃 후 사용자 정보 조회 실패 확인
      const meResponse3 = await request(app)
        .get('/api/auth/me')
        .set(createAuthHeader(newAccessToken))
        .expect(401);

      expectError(meResponse3, 401);
    });

    test('다중 디바이스 로그인 및 전체 로그아웃', async () => {
      const user = await createTestUser({
        email: 'multi@test.com',
        password: 'MultiTest123!',
        is_email_verified: true
      });

      // 여러 디바이스에서 로그인 (3번)
      const sessions = [];
      for (let i = 0; i < 3; i++) {
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'multi@test.com',
            password: 'MultiTest123!'
          })
          .expect(200);

        const loginResult = expectSuccess(loginResponse);
        sessions.push(loginResult.data.tokens);
      }

      // 모든 세션이 활성화되어 있는지 확인
      for (const session of sessions) {
        const meResponse = await request(app)
          .get('/api/auth/me')
          .set(createAuthHeader(session.accessToken))
          .expect(200);

        expectSuccess(meResponse);
      }

      // 첫 번째 세션에서 모든 디바이스 로그아웃
      const logoutAllResponse = await request(app)
        .post('/api/auth/logout-all')
        .set(createAuthHeader(sessions[0].accessToken))
        .expect(200);

      expectSuccess(logoutAllResponse);

      // 모든 세션이 무효화되었는지 확인
      for (const session of sessions) {
        const meResponse = await request(app)
          .get('/api/auth/me')
          .set(createAuthHeader(session.accessToken))
          .expect(401);

        expectError(meResponse, 401);
      }
    });

  });

});
