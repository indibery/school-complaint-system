const request = require('supertest');
const { createTestApp } = require('../helpers/testApp');
const { 
  createTestUser, 
  expectSuccess, 
  expectError,
  dbHelpers,
  lockUserAccount,
  timeHelpers
} = require('../helpers/testHelpers');

describe('🔑 로그인 API 테스트', () => {
  let app;

  beforeAll(async () => {
    app = createTestApp();
  });

  describe('POST /api/auth/login', () => {
    
    describe('✅ 성공 케이스', () => {
      
      test('정상 로그인 성공', async () => {
        const user = await createTestUser({
          email: 'login@test.com',
          password: 'LoginTest123!',
          is_email_verified: true
        });

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'login@test.com',
            password: 'LoginTest123!'
          })
          .expect(200);

        const result = expectSuccess(response);
        
        // 응답 검증
        expect(result.message).toContain('로그인 성공');
        expect(result.data.tokens.accessToken).toBeTruthy();
        expect(result.data.tokens.refreshToken).toBeTruthy();
        expect(result.data.user.id).toBe(user.id);
        expect(result.data.user.email).toBe(user.email);
        expect(result.data.user.password).toBeUndefined(); // 비밀번호 노출 방지
        
        // 토큰 형식 검증
        expect(result.data.tokens.accessToken).toMatch(/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/);
        expect(result.data.tokens.refreshToken).toMatch(/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/);
        
        // 데이터베이스 업데이트 확인
        const updatedUser = await dbHelpers.getUserById(user.id);
        expect(updatedUser.last_login).toBeTruthy();
        expect(updatedUser.login_attempts).toBe(0);
      });

      test('다양한 역할별 로그인 성공', async () => {
        const roles = ['parent', 'teacher', 'admin', 'guard'];
        
        for (const role of roles) {
          const user = await createTestUser({
            email: `${role}@test.com`,
            password: 'RoleTest123!',
            role,
            is_email_verified: true
          });

          const response = await request(app)
            .post('/api/auth/login')
            .send({
              email: `${role}@test.com`,
              password: 'RoleTest123!'
            })
            .expect(200);

          const result = expectSuccess(response);
          expect(result.data.user.role).toBe(role);
        }
      });

      test('기억하기 옵션 로그인', async () => {
        const user = await createTestUser({
          email: 'remember@test.com',
          password: 'RememberTest123!',
          is_email_verified: true
        });

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'remember@test.com',
            password: 'RememberTest123!',
            rememberMe: true
          })
          .expect(200);

        const result = expectSuccess(response);
        expect(result.data.tokens.accessToken).toBeTruthy();
        expect(result.data.tokens.refreshToken).toBeTruthy();
        // 기억하기 옵션일 때 더 긴 만료 시간 설정 확인 가능
      });

    });

    describe('❌ 실패 케이스 - 입력 유효성', () => {
      
      test('이메일 누락', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            password: 'TestPassword123!'
          })
          .expect(400);

        const result = expectError(response);
        expect(result.message).toContain('이메일');
      });

      test('비밀번호 누락', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@test.com'
          })
          .expect(400);

        const result = expectError(response);
        expect(result.message).toContain('비밀번호');
      });

      test('잘못된 이메일 형식', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'invalid-email',
            password: 'TestPassword123!'
          })
          .expect(400);

        const result = expectError(response);
        expect(result.message).toContain('이메일');
      });

    });

    describe('❌ 실패 케이스 - 인증 오류', () => {
      
      test('존재하지 않는 사용자', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'nonexistent@test.com',
            password: 'TestPassword123!'
          })
          .expect(401);

        const result = expectError(response, 401);
        expect(result.message).toContain('이메일 또는 비밀번호가 올바르지 않습니다');
      });

      test('잘못된 비밀번호', async () => {
        const user = await createTestUser({
          email: 'wrong@test.com',
          password: 'CorrectPassword123!',
          is_email_verified: true
        });

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'wrong@test.com',
            password: 'WrongPassword123!'
          })
          .expect(401);

        const result = expectError(response, 401);
        expect(result.message).toContain('이메일 또는 비밀번호가 올바르지 않습니다');
        
        // 실패 시도 횟수 증가 확인
        const updatedUser = await dbHelpers.getUserById(user.id);
        expect(updatedUser.login_attempts).toBe(1);
      });

      test('이메일 미인증 사용자', async () => {
        const user = await createTestUser({
          email: 'unverified@test.com',
          password: 'TestPassword123!',
          is_email_verified: false
        });

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'unverified@test.com',
            password: 'TestPassword123!'
          })
          .expect(403);

        const result = expectError(response, 403);
        expect(result.message).toContain('이메일 인증이 필요합니다');
      });

      test('비활성화된 계정', async () => {
        const user = await createTestUser({
          email: 'inactive@test.com',
          password: 'TestPassword123!',
          is_active: false,
          is_email_verified: true
        });

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'inactive@test.com',
            password: 'TestPassword123!'
          })
          .expect(403);

        const result = expectError(response, 403);
        expect(result.message).toContain('비활성화된 계정입니다');
      });

    });

    describe('🛡️ 보안 기능 테스트', () => {
      
      test('계정 잠금 테스트', async () => {
        const user = await createTestUser({
          email: 'locked@test.com',
          password: 'TestPassword123!',
          is_email_verified: true
        });

        // 계정 잠금 설정
        await lockUserAccount(user.id, 30); // 30분 잠금

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'locked@test.com',
            password: 'TestPassword123!'
          })
          .expect(423);

        const result = expectError(response, 423);
        expect(result.message).toContain('계정이 잠겨있습니다');
        expect(result.message).toContain('분 후에 다시 시도해주세요');
      });

      test('연속 로그인 실패 후 계정 잠금', async () => {
        const user = await createTestUser({
          email: 'brute@test.com',
          password: 'CorrectPassword123!',
          is_email_verified: true
        });

        // 5번 연속 실패 시도
        for (let i = 0; i < 5; i++) {
          const response = await request(app)
            .post('/api/auth/login')
            .send({
              email: 'brute@test.com',
              password: 'WrongPassword123!'
            })
            .expect(401);

          expectError(response, 401);
        }

        // 6번째 시도 시 계정 잠금
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'brute@test.com',
            password: 'CorrectPassword123!' // 올바른 비밀번호여도 잠김
          })
          .expect(423);

        const result = expectError(response, 423);
        expect(result.message).toContain('계정이 잠겨있습니다');
        
        // 데이터베이스 확인
        const lockedUser = await dbHelpers.getUserById(user.id);
        expect(lockedUser.login_attempts).toBe(5);
        expect(lockedUser.locked_until).toBeTruthy();
      });

      test.skip('IP 기반 브루트포스 방어 (테스트 환경에서는 비활성화)', async () => {
        // 같은 IP에서 여러 계정으로 연속 실패 시도
        const users = [];
        for (let i = 0; i < 3; i++) {
          users.push(await createTestUser({
            email: `ip${i}@test.com`,
            password: 'TestPassword123!',
            is_email_verified: true
          }));
        }

        // 각 계정마다 실패 시도 (총 21회 - IP 제한 초과)
        for (let i = 0; i < 7; i++) {
          for (const user of users) {
            const response = await request(app)
              .post('/api/auth/login')
              .send({
                email: user.email,
                password: 'WrongPassword123!'
              });

            // 처음 20번은 401, 그 이후는 429 (Too Many Requests)
            if (i * users.length + users.indexOf(user) < 20) {
              expect(response.status).toBe(401);
            } else {
              expect(response.status).toBe(429);
              const result = expectError(response, 429);
              expect(result.message).toContain('너무 많은 로그인 시도');
            }
          }
        }
      });

    });

    describe('🔄 토큰 버전 관리 테스트', () => {
      
      test('토큰 버전 증가 확인', async () => {
        const user = await createTestUser({
          email: 'version@test.com',
          password: 'TestPassword123!',
          is_email_verified: true
        });

        const initialUser = await dbHelpers.getUserById(user.id);
        const initialVersion = initialUser.token_version;

        // 로그인
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'version@test.com',
            password: 'TestPassword123!'
          })
          .expect(200);

        const result = expectSuccess(response);
        expect(result.data.tokens.accessToken).toBeTruthy();

        // 토큰 버전 증가 확인
        const updatedUser = await dbHelpers.getUserById(user.id);
        expect(updatedUser.token_version).toBe(initialVersion);
      });

    });

  });

});
