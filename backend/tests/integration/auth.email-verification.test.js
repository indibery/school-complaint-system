const request = require('supertest');
const { createTestApp } = require('../helpers/testApp');
const { 
  createTestUser, 
  expectSuccess, 
  expectError,
  dbHelpers,
  setEmailVerificationToken,
  generateTestTokens,
  createAuthHeader
} = require('../helpers/testHelpers');

describe('📧 이메일 인증 API 테스트', () => {
  let app;

  beforeAll(async () => {
    app = createTestApp();
  });

  describe('POST /api/auth/verify-email', () => {
    
    describe('✅ 성공 케이스', () => {
      
      test('이메일 인증 성공', async () => {
        // 미인증 사용자 생성
        const user = await createTestUser({
          is_email_verified: false
        });
        
        // 인증 토큰 설정
        const verificationToken = await setEmailVerificationToken(user.id);

        const response = await request(app)
          .post('/api/auth/verify-email')
          .send({ token: verificationToken })
          .expect(200);

        const result = expectSuccess(response);
        expect(result.message).toContain('이메일 인증이 완료되었습니다');

        // 데이터베이스 확인
        const verifiedUser = await dbHelpers.getUserById(user.id);
        expect(verifiedUser.is_email_verified).toBe(true);
        expect(verifiedUser.email_verification_token).toBeNull();
        expect(verifiedUser.email_verification_expires).toBeNull();
      });

    });

    describe('❌ 실패 케이스', () => {
      
      test('토큰 누락', async () => {
        const response = await request(app)
          .post('/api/auth/verify-email')
          .send({})
          .expect(400);

        const result = expectError(response);
        expect(result.message).toContain('토큰');
      });

      test('잘못된 토큰', async () => {
        const response = await request(app)
          .post('/api/auth/verify-email')
          .send({ token: 'invalid-token' })
          .expect(400);

        const result = expectError(response);
        expect(result.message).toContain('유효하지 않은 인증 토큰');
      });

      test('만료된 토큰', async () => {
        // 사용자 생성
        const user = await createTestUser({
          is_email_verified: false
        });
        
        // 만료된 토큰 설정 (과거 시간)
        const expiredToken = 'expired-token-123';
        const pastTime = new Date(Date.now() - 60 * 60 * 1000); // 1시간 전
        
        await global.testPool.query(
          'UPDATE users SET email_verification_token = $1, email_verification_expires = $2 WHERE id = $3',
          [expiredToken, pastTime, user.id]
        );

        const response = await request(app)
          .post('/api/auth/verify-email')
          .send({ token: expiredToken })
          .expect(400);

        const result = expectError(response);
        expect(result.message).toContain('만료된 인증 토큰');
      });

      test('이미 인증된 사용자', async () => {
        // 이미 인증된 사용자 생성
        const user = await createTestUser({
          is_email_verified: true
        });
        
        const verificationToken = await setEmailVerificationToken(user.id);

        const response = await request(app)
          .post('/api/auth/verify-email')
          .send({ token: verificationToken })
          .expect(400);

        const result = expectError(response);
        expect(result.message).toContain('이미 인증된 계정');
      });

    });

  });

  describe('POST /api/auth/resend-verification', () => {
    
    describe('✅ 성공 케이스', () => {
      
      test('인증 이메일 재발송 성공', async () => {
        // 미인증 사용자 생성
        const user = await createTestUser({
          is_email_verified: false
        });
        
        const tokens = generateTestTokens(user.id);

        const response = await request(app)
          .post('/api/auth/resend-verification')
          .set(createAuthHeader(tokens.accessToken))
          .expect(200);

        const result = expectSuccess(response);
        expect(result.message).toContain('인증 이메일이 재발송되었습니다');

        // 새로운 토큰이 생성되었는지 확인
        const updatedUser = await dbHelpers.getUserById(user.id);
        expect(updatedUser.email_verification_token).toBeTruthy();
        expect(updatedUser.email_verification_expires).toBeTruthy();
      });

    });

    describe('❌ 실패 케이스', () => {
      
      test('인증 토큰 없음', async () => {
        const response = await request(app)
          .post('/api/auth/resend-verification')
          .expect(401);

        const result = expectError(response, 401);
        expect(result.message).toContain('인증');
      });

      test('잘못된 토큰', async () => {
        const response = await request(app)
          .post('/api/auth/resend-verification')
          .set(createAuthHeader('invalid-token'))
          .expect(401);

        const result = expectError(response, 401);
        expect(result.message).toContain('유효하지 않은 토큰');
      });

      test('이미 인증된 사용자', async () => {
        // 이미 인증된 사용자 생성
        const user = await createTestUser({
          is_email_verified: true
        });
        
        const tokens = generateTestTokens(user.id);

        const response = await request(app)
          .post('/api/auth/resend-verification')
          .set(createAuthHeader(tokens.accessToken))
          .expect(400);

        const result = expectError(response);
        expect(result.message).toContain('이미 인증된 계정');
      });

      test('비활성화된 계정', async () => {
        // 비활성화된 사용자 생성
        const user = await createTestUser({
          is_active: false,
          is_email_verified: false
        });
        
        const tokens = generateTestTokens(user.id);

        const response = await request(app)
          .post('/api/auth/resend-verification')
          .set(createAuthHeader(tokens.accessToken))
          .expect(403);

        const result = expectError(response, 403);
        expect(result.message).toContain('비활성화된 계정');
      });

    });

  });

  describe('이메일 인증 통합 플로우', () => {
    
    test('전체 인증 플로우 테스트', async () => {
      // 1. 회원가입
      const userData = {
        email: 'flow@test.com',
        password: 'FlowTest123!',
        name: '플로우테스트',
        role: 'parent'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      const registerResult = expectSuccess(registerResponse, 201);
      expect(registerResult.data.user.is_email_verified).toBe(false);

      // 2. 데이터베이스에서 인증 토큰 가져오기
      const user = await dbHelpers.getUserByEmail(userData.email);
      expect(user.email_verification_token).toBeTruthy();

      // 3. 이메일 인증
      const verifyResponse = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: user.email_verification_token })
        .expect(200);

      const verifyResult = expectSuccess(verifyResponse);
      expect(verifyResult.message).toContain('인증이 완료되었습니다');

      // 4. 사용자 상태 확인
      const verifiedUser = await dbHelpers.getUserById(user.id);
      expect(verifiedUser.is_email_verified).toBe(true);
      expect(verifiedUser.email_verification_token).toBeNull();
    });

    test('재발송 후 인증 플로우 테스트', async () => {
      // 1. 미인증 사용자 생성
      const user = await createTestUser({
        is_email_verified: false
      });
      
      const tokens = generateTestTokens(user.id);

      // 2. 인증 이메일 재발송
      const resendResponse = await request(app)
        .post('/api/auth/resend-verification')
        .set(createAuthHeader(tokens.accessToken))
        .expect(200);

      expectSuccess(resendResponse);

      // 3. 새로운 토큰으로 인증
      const updatedUser = await dbHelpers.getUserById(user.id);
      
      const verifyResponse = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: updatedUser.email_verification_token })
        .expect(200);

      expectSuccess(verifyResponse);

      // 4. 인증 완료 확인
      const finalUser = await dbHelpers.getUserById(user.id);
      expect(finalUser.is_email_verified).toBe(true);
    });

  });

});
