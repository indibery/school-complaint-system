const request = require('supertest');
const { createTestApp } = require('../helpers/testApp');
const { 
  createTestUser, 
  expectSuccess, 
  expectError,
  dbHelpers,
  setEmailVerificationToken
} = require('../helpers/testHelpers');

describe('🔐 회원가입 API 테스트', () => {
  let app;

  beforeAll(async () => {
    app = createTestApp();
  });

  describe('POST /api/auth/register', () => {
    
    describe('✅ 성공 케이스', () => {
      
      test('학부모 회원가입 성공', async () => {
        const userData = {
          email: 'parent@test.com',
          password: 'TestPassword123!',
          name: '김학부모',
          phone: '010-1234-5678',
          role: 'parent'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(201);

        const result = expectSuccess(response, 201);
        
        // 응답 검증
        expect(result.message).toContain('회원가입이 완료되었습니다');
        expect(result.data.user.email).toBe(userData.email);
        expect(result.data.user.name).toBe(userData.name);
        expect(result.data.user.role).toBe(userData.role);
        expect(result.data.user.is_active).toBe(true);
        expect(result.data.user.is_email_verified).toBe(false);
        expect(result.data.user.password).toBeUndefined(); // 비밀번호 노출 방지

        // 데이터베이스 확인
        const dbUser = await dbHelpers.getUserByEmail(userData.email);
        expect(dbUser).toBeTruthy();
        expect(dbUser.email_verification_token).toBeTruthy();
        expect(dbUser.email_verification_expires).toBeTruthy();
      });

      test('교사 회원가입 성공', async () => {
        const userData = {
          email: 'teacher@test.com',
          password: 'TeacherPass456!',
          name: '이교사',
          phone: '010-9876-5432',
          role: 'teacher'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(201);

        const result = expectSuccess(response, 201);
        expect(result.data.user.role).toBe('teacher');
      });

      test('관리자 회원가입 성공', async () => {
        const userData = {
          email: 'admin@test.com',
          password: 'AdminPass789!',
          name: '박관리자',
          phone: '010-1111-2222',
          role: 'admin'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(201);

        const result = expectSuccess(response, 201);
        expect(result.data.user.role).toBe('admin');
      });

      test('교문지킴이 회원가입 성공', async () => {
        const userData = {
          email: 'guard@test.com',
          password: 'GuardPass101!',
          name: '최지킴이',
          phone: '010-3333-4444',
          role: 'guard'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(201);

        const result = expectSuccess(response, 201);
        expect(result.data.user.role).toBe('guard');
      });

      test('전화번호 없이 회원가입 성공', async () => {
        const userData = {
          email: 'nophone@test.com',
          password: 'NoPhonePass123!',
          name: '폰없음',
          role: 'parent'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(201);

        const result = expectSuccess(response, 201);
        expect(result.data.user.phone).toBeNull();
      });

    });

    describe('❌ 실패 케이스 - 입력 유효성 검사', () => {
      
      test('이메일 누락', async () => {
        const userData = {
          password: 'TestPassword123!',
          name: '김테스트',
          role: 'parent'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(400);

        const result = expectError(response);
        expect(result.message).toContain('이메일');
      });

      test('잘못된 이메일 형식', async () => {
        const userData = {
          email: 'invalid-email',
          password: 'TestPassword123!',
          name: '김테스트',
          role: 'parent'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(400);

        const result = expectError(response);
        expect(result.message).toContain('이메일');
      });

      test('비밀번호 누락', async () => {
        const userData = {
          email: 'test@test.com',
          name: '김테스트',
          role: 'parent'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(400);

        const result = expectError(response);
        expect(result.message).toContain('비밀번호');
      });

      test('약한 비밀번호', async () => {
        const weakPasswords = [
          '123456',           // 너무 짧고 숫자만
          'password',         // 대문자, 숫자, 특수문자 없음
          'PASSWORD123',      // 소문자, 특수문자 없음
          'Password',         // 숫자, 특수문자 없음
          'Pass123',          // 특수문자 없음
          'pass123!',         // 대문자 없음
          'PASS123!'          // 소문자 없음
        ];

        for (const password of weakPasswords) {
          const userData = {
            email: `weak${Date.now()}@test.com`,
            password,
            name: '김테스트',
            role: 'parent'
          };

          const response = await request(app)
            .post('/api/auth/register')
            .send(userData)
            .expect(400);

          const result = expectError(response);
          expect(result.message).toContain('비밀번호');
        }
      });

      test('이름 누락', async () => {
        const userData = {
          email: 'test@test.com',
          password: 'TestPassword123!',
          role: 'parent'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(400);

        const result = expectError(response);
        expect(result.message).toContain('이름');
      });

      test('잘못된 역할', async () => {
        const userData = {
          email: 'test@test.com',
          password: 'TestPassword123!',
          name: '김테스트',
          role: 'invalid_role'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(400);

        const result = expectError(response);
        expect(result.message).toContain('역할');
      });

      test('잘못된 전화번호 형식', async () => {
        const invalidPhones = [
          '123-456-7890',     // 미국 형식
          '010-123-456',      // 너무 짧음
          '010-1234-56789',   // 너무 김
          'invalid-phone',    // 완전히 잘못된 형식
          '02-1234-5678'      // 지역번호
        ];

        for (const phone of invalidPhones) {
          const userData = {
            email: `phone${Date.now()}@test.com`,
            password: 'TestPassword123!',
            name: '김테스트',
            phone,
            role: 'parent'
          };

          const response = await request(app)
            .post('/api/auth/register')
            .send(userData)
            .expect(400);

          const result = expectError(response);
          expect(result.message).toContain('전화번호');
        }
      });

    });

    describe('❌ 실패 케이스 - 중복 검증', () => {
      
      test('이메일 중복', async () => {
        // 첫 번째 사용자 생성
        const firstUser = await createTestUser({
          email: 'duplicate@test.com'
        });

        // 동일한 이메일로 회원가입 시도
        const userData = {
          email: 'duplicate@test.com',
          password: 'TestPassword123!',
          name: '김중복',
          role: 'parent'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(409);

        const result = expectError(response, 409);
        expect(result.message).toContain('이미 사용 중인 이메일');
      });

      test('전화번호 중복', async () => {
        // 첫 번째 사용자 생성
        const firstUser = await createTestUser({
          phone: '010-5555-6666'
        });

        // 동일한 전화번호로 회원가입 시도
        const userData = {
          email: 'newuser@test.com',
          password: 'TestPassword123!',
          name: '김신규',
          phone: '010-5555-6666',
          role: 'parent'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(409);

        const result = expectError(response, 409);
        expect(result.message).toContain('이미 사용 중인 전화번호');
      });

    });

  });

  describe('POST /api/auth/validate-registration', () => {
    
    test('이메일 사용 가능 검증', async () => {
      const response = await request(app)
        .post('/api/auth/validate-registration')
        .send({ email: 'available@test.com' })
        .expect(200);

      const result = expectSuccess(response);
      expect(result.data.emailAvailable).toBe(true);
    });

    test('이메일 사용 불가 검증', async () => {
      // 기존 사용자 생성
      await createTestUser({ email: 'taken@test.com' });

      const response = await request(app)
        .post('/api/auth/validate-registration')
        .send({ email: 'taken@test.com' })
        .expect(200);

      const result = expectSuccess(response);
      expect(result.data.emailAvailable).toBe(false);
    });

    test('전화번호 사용 가능 검증', async () => {
      const response = await request(app)
        .post('/api/auth/validate-registration')
        .send({ phone: '010-7777-8888' })
        .expect(200);

      const result = expectSuccess(response);
      expect(result.data.phoneAvailable).toBe(true);
    });

    test('전화번호 사용 불가 검증', async () => {
      // 기존 사용자 생성
      await createTestUser({ phone: '010-9999-0000' });

      const response = await request(app)
        .post('/api/auth/validate-registration')
        .send({ phone: '010-9999-0000' })
        .expect(200);

      const result = expectSuccess(response);
      expect(result.data.phoneAvailable).toBe(false);
    });

  });

});
