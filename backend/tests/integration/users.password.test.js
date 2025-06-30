const request = require('supertest');
const { createTestApp } = require('../helpers/testApp');
const { 
  createTestUser, 
  expectSuccess, 
  expectError,
  dbHelpers,
  timeHelpers
} = require('../helpers/testHelpers');

describe('🔒 비밀번호 변경 API 테스트', () => {
  let app;

  beforeAll(async () => {
    app = createTestApp();
  });

  describe('PUT /api/users/password', () => {
    
    describe('✅ 성공 케이스', () => {
      
      test('정상적으로 비밀번호를 변경할 수 있어야 함', async () => {
        const user = await createTestUser({
          email: 'password@test.com',
          password: 'OldPassword123!',
          name: '비밀번호테스트'
        });

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        const response = await request(app)
          .put('/api/users/password')
          .set('Authorization', `Bearer ${token}`)
          .send({
            currentPassword: 'OldPassword123!',
            newPassword: 'NewPassword123!',
            confirmPassword: 'NewPassword123!'
          })
          .expect(200);

        expectSuccess(response, '비밀번호 변경');
        expect(response.body.message).toContain('성공적으로 변경되었습니다');
        expect(response.body.message).toContain('다시 로그인해주세요');
      });

      test('비밀번호 변경 후 기존 토큰이 무효화되어야 함', async () => {
        const user = await createTestUser({
          email: 'tokentest@test.com',
          password: 'OldPassword123!'
        });

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        // 비밀번호 변경
        await request(app)
          .put('/api/users/password')
          .set('Authorization', `Bearer ${token}`)
          .send({
            currentPassword: 'OldPassword123!',
            newPassword: 'NewPassword123!',
            confirmPassword: 'NewPassword123!'
          })
          .expect(200);

        // 기존 토큰으로 API 호출 시 실패해야 함
        const profileResponse = await request(app)
          .get('/api/users/profile')
          .set('Authorization', `Bearer ${token}`)
          .expect(401);

        expectError(profileResponse, '토큰 무효화');
      });

      test('변경된 새 비밀번호로 로그인 가능해야 함', async () => {
        const user = await createTestUser({
          email: 'newlogin@test.com',
          password: 'OldPassword123!'
        });

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        // 비밀번호 변경
        await request(app)
          .put('/api/users/password')
          .set('Authorization', `Bearer ${token}`)
          .send({
            currentPassword: 'OldPassword123!',
            newPassword: 'NewPassword123!',
            confirmPassword: 'NewPassword123!'
          })
          .expect(200);

        // 새 비밀번호로 로그인
        const newLoginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: 'NewPassword123!'
          })
          .expect(200);

        expectSuccess(newLoginResponse, '새 비밀번호 로그인');
        expect(newLoginResponse.body.data.accessToken).toBeDefined();
      });
    });

    describe('❌ 실패 케이스', () => {
      
      test('인증 토큰 없이 요청 시 실패', async () => {
        const response = await request(app)
          .put('/api/users/password')
          .send({
            currentPassword: 'OldPassword123!',
            newPassword: 'NewPassword123!',
            confirmPassword: 'NewPassword123!'
          })
          .expect(401);

        expectError(response, '인증 필요');
      });

      test('잘못된 현재 비밀번호로 요청 시 실패', async () => {
        const user = await createTestUser({
          email: 'wrongpass@test.com',
          password: 'OldPassword123!'
        });

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        const response = await request(app)
          .put('/api/users/password')
          .set('Authorization', `Bearer ${token}`)
          .send({
            currentPassword: 'WrongPassword123!',
            newPassword: 'NewPassword123!',
            confirmPassword: 'NewPassword123!'
          })
          .expect(400);

        expectError(response, '잘못된 현재 비밀번호');
        expect(response.body.message).toBe('현재 비밀번호가 올바르지 않습니다.');
      });

      test('새 비밀번호가 현재 비밀번호와 동일할 때 실패', async () => {
        const user = await createTestUser({
          email: 'samepass@test.com',
          password: 'SamePassword123!'
        });

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        const response = await request(app)
          .put('/api/users/password')
          .set('Authorization', `Bearer ${token}`)
          .send({
            currentPassword: 'SamePassword123!',
            newPassword: 'SamePassword123!',
            confirmPassword: 'SamePassword123!'
          })
          .expect(400);

        expectError(response, '동일한 비밀번호');
        expect(response.body.message).toBe('새 비밀번호는 현재 비밀번호와 달라야 합니다.');
      });

      test('약한 새 비밀번호로 요청 시 실패', async () => {
        const user = await createTestUser({
          email: 'weakpass@test.com',
          password: 'OldPassword123!'
        });

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        const response = await request(app)
          .put('/api/users/password')
          .set('Authorization', `Bearer ${token}`)
          .send({
            currentPassword: 'OldPassword123!',
            newPassword: 'weak',
            confirmPassword: 'weak'
          })
          .expect(400);

        expectError(response, '약한 비밀번호');
      });

      test('새 비밀번호 확인이 일치하지 않을 때 실패', async () => {
        const user = await createTestUser({
          email: 'mismatch@test.com',
          password: 'OldPassword123!'
        });

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        const response = await request(app)
          .put('/api/users/password')
          .set('Authorization', `Bearer ${token}`)
          .send({
            currentPassword: 'OldPassword123!',
            newPassword: 'NewPassword123!',
            confirmPassword: 'DifferentPassword123!'
          })
          .expect(400);

        expectError(response, '비밀번호 확인 불일치');
      });

      test('필수 필드 누락 시 실패', async () => {
        const user = await createTestUser({
          email: 'missing@test.com',
          password: 'OldPassword123!'
        });

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        const response = await request(app)
          .put('/api/users/password')
          .set('Authorization', `Bearer ${token}`)
          .send({
            newPassword: 'NewPassword123!',
            confirmPassword: 'NewPassword123!'
            // currentPassword 누락
          })
          .expect(400);

        expectError(response, '필수 필드 누락');
      });
    });

    describe('🛡️ 보안 케이스', () => {
      
      test('여러 번 잘못된 비밀번호 입력 시 계정 잠금', async () => {
        const user = await createTestUser({
          email: 'security@test.com',
          password: 'OldPassword123!'
        });

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        // 5번 연속 잘못된 비밀번호 입력
        for (let i = 0; i < 5; i++) {
          await request(app)
            .put('/api/users/password')
            .set('Authorization', `Bearer ${token}`)
            .send({
              currentPassword: 'WrongPassword123!',
              newPassword: 'NewPassword123!',
              confirmPassword: 'NewPassword123!'
            });
        }

        // 마지막 요청은 계정 잠금으로 423 상태 코드 반환
        const response = await request(app)
          .put('/api/users/password')
          .set('Authorization', `Bearer ${token}`)
          .send({
            currentPassword: 'OldPassword123!', // 올바른 비밀번호라도 
            newPassword: 'NewPassword123!',
            confirmPassword: 'NewPassword123!'
          })
          .expect(423);

        expectError(response, '계정 잠금');
        expect(response.body.message).toContain('일시적으로 잠겨있습니다');
      });

      test('비밀번호 변경 후 이전 비밀번호로 로그인 불가', async () => {
        const user = await createTestUser({
          email: 'oldpass@test.com',
          password: 'OldPassword123!'
        });

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        // 비밀번호 변경
        await request(app)
          .put('/api/users/password')
          .set('Authorization', `Bearer ${token}`)
          .send({
            currentPassword: 'OldPassword123!',
            newPassword: 'NewPassword123!',
            confirmPassword: 'NewPassword123!'
          })
          .expect(200);

        // 이전 비밀번호로 로그인 시도 - 실패해야 함
        const oldLoginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: 'OldPassword123!'
          })
          .expect(401);

        expectError(oldLoginResponse, '이전 비밀번호 로그인 불가');
      });
    });
  });
});
