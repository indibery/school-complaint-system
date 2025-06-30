const request = require('supertest');
const { createTestApp } = require('../helpers/testApp');
const { 
  createTestUser, 
  expectSuccess, 
  expectError,
  dbHelpers,
  timeHelpers
} = require('../helpers/testHelpers');

describe('⚙️ 계정 설정 및 삭제 API 테스트', () => {
  let app;

  beforeAll(async () => {
    app = createTestApp();
  });

  describe('PUT /api/users/settings', () => {
    
    describe('✅ 성공 케이스', () => {
      
      test('이메일 알림 설정을 변경할 수 있어야 함', async () => {
        const user = await createTestUser({
          email: 'settings@test.com',
          name: '설정테스트'
        });

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        const response = await request(app)
          .put('/api/users/settings')
          .set('Authorization', `Bearer ${token}`)
          .send({
            email_notifications: false
          })
          .expect(200);

        expectSuccess(response, '이메일 알림 설정 변경');
        expect(response.body.data.settings.email_notifications).toBe(false);
        expect(response.body.data.changes).toContain('이메일 알림: 비활성화');
      });

      test('여러 설정을 동시에 변경할 수 있어야 함', async () => {
        const user = await createTestUser({
          email: 'multisettings@test.com'
        });

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        const response = await request(app)
          .put('/api/users/settings')
          .set('Authorization', `Bearer ${token}`)
          .send({
            email_notifications: false,
            sms_notifications: true,
            language: 'en',
            timezone: 'UTC'
          })
          .expect(200);

        expectSuccess(response, '다중 설정 변경');
        
        const settings = response.body.data.settings;
        expect(settings.email_notifications).toBe(false);
        expect(settings.sms_notifications).toBe(true);
        expect(settings.language).toBe('en');
        expect(settings.timezone).toBe('UTC');
        
        expect(response.body.data.changes).toHaveLength(4);
      });

      test('동일한 값으로 설정 시 변경사항 없음', async () => {
        const user = await createTestUser({
          email: 'nochange@test.com'
        });

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        // 기본값과 동일한 설정으로 요청
        const response = await request(app)
          .put('/api/users/settings')
          .set('Authorization', `Bearer ${token}`)
          .send({
            email_notifications: true, // 기본값
            language: 'ko'            // 기본값
          })
          .expect(400);

        expectError(response, '변경사항 없음');
        expect(response.body.message).toBe('변경할 설정을 선택해주세요.');
      });
    });

    describe('❌ 실패 케이스', () => {
      
      test('인증 토큰 없이 요청 시 실패', async () => {
        const response = await request(app)
          .put('/api/users/settings')
          .send({
            email_notifications: false
          })
          .expect(401);

        expectError(response, '인증 필요');
      });

      test('잘못된 언어 설정으로 요청 시 실패', async () => {
        const user = await createTestUser();
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        const response = await request(app)
          .put('/api/users/settings')
          .set('Authorization', `Bearer ${token}`)
          .send({
            language: 'fr' // 지원하지 않는 언어
          })
          .expect(400);

        expectError(response, '잘못된 언어 설정');
      });

      test('잘못된 시간대 설정으로 요청 시 실패', async () => {
        const user = await createTestUser();
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        const response = await request(app)
          .put('/api/users/settings')
          .set('Authorization', `Bearer ${token}`)
          .send({
            timezone: 'Invalid/Timezone'
          })
          .expect(400);

        expectError(response, '잘못된 시간대 설정');
      });

      test('잘못된 데이터 타입으로 요청 시 실패', async () => {
        const user = await createTestUser();
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        const response = await request(app)
          .put('/api/users/settings')
          .set('Authorization', `Bearer ${token}`)
          .send({
            email_notifications: 'yes' // boolean이어야 함
          })
          .expect(400);

        expectError(response, '잘못된 데이터 타입');
      });
    });
  });

  describe('DELETE /api/users/account', () => {
    
    describe('✅ 성공 케이스', () => {
      
      test('정상적으로 계정을 삭제할 수 있어야 함', async () => {
        const user = await createTestUser({
          email: 'delete@test.com',
          password: 'DeleteTest123!',
          name: '삭제테스트'
        });

        // 계정 생성 24시간 후로 설정 (삭제 제한 우회)
        await global.testPool.query(
          'UPDATE users SET created_at = NOW() - INTERVAL \'25 hours\' WHERE id = $1',
          [user.id]
        );

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        const response = await request(app)
          .delete('/api/users/account')
          .set('Authorization', `Bearer ${token}`)
          .send({
            password: 'DeleteTest123!',
            confirmation: 'DELETE_MY_ACCOUNT'
          })
          .expect(200);

        expectSuccess(response, '계정 삭제');
        expect(response.body.message).toContain('성공적으로 삭제되었습니다');
        expect(response.body.data.deleted_at).toBeDefined();
        expect(response.body.data.data_retention_info).toBeDefined();
      });

      test('계정 삭제 후 로그인 불가', async () => {
        const user = await createTestUser({
          email: 'deletelogin@test.com',
          password: 'DeleteTest123!'
        });

        // 계정 생성 24시간 후로 설정
        await global.testPool.query(
          'UPDATE users SET created_at = NOW() - INTERVAL \'25 hours\' WHERE id = $1',
          [user.id]
        );

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        // 계정 삭제
        await request(app)
          .delete('/api/users/account')
          .set('Authorization', `Bearer ${token}`)
          .send({
            password: 'DeleteTest123!',
            confirmation: 'DELETE_MY_ACCOUNT'
          })
          .expect(200);

        // 삭제된 계정으로 로그인 시도
        const failedLoginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: 'DeleteTest123!'
          })
          .expect(401);

        expectError(failedLoginResponse, '삭제된 계정 로그인 불가');
      });

      test('계정 삭제 후 기존 토큰 무효화', async () => {
        const user = await createTestUser({
          email: 'tokendelete@test.com',
          password: 'DeleteTest123!'
        });

        // 계정 생성 24시간 후로 설정
        await global.testPool.query(
          'UPDATE users SET created_at = NOW() - INTERVAL \'25 hours\' WHERE id = $1',
          [user.id]
        );

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        // 계정 삭제
        await request(app)
          .delete('/api/users/account')
          .set('Authorization', `Bearer ${token}`)
          .send({
            password: 'DeleteTest123!',
            confirmation: 'DELETE_MY_ACCOUNT'
          })
          .expect(200);

        // 기존 토큰으로 API 호출 시도
        const profileResponse = await request(app)
          .get('/api/users/profile')
          .set('Authorization', `Bearer ${token}`)
          .expect(401);

        expectError(profileResponse, '토큰 무효화');
      });
    });

    describe('❌ 실패 케이스', () => {
      
      test('인증 토큰 없이 요청 시 실패', async () => {
        const response = await request(app)
          .delete('/api/users/account')
          .send({
            password: 'TestPassword123!',
            confirmation: 'DELETE_MY_ACCOUNT'
          })
          .expect(401);

        expectError(response, '인증 필요');
      });

      test('잘못된 비밀번호로 요청 시 실패', async () => {
        const user = await createTestUser({
          email: 'wrongpassdelete@test.com',
          password: 'DeleteTest123!'
        });

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        const response = await request(app)
          .delete('/api/users/account')
          .set('Authorization', `Bearer ${token}`)
          .send({
            password: 'WrongPassword123!',
            confirmation: 'DELETE_MY_ACCOUNT'
          })
          .expect(400);

        expectError(response, '잘못된 비밀번호');
        expect(response.body.message).toBe('비밀번호가 올바르지 않습니다.');
      });

      test('확인 문구 없이 요청 시 실패', async () => {
        const user = await createTestUser({
          email: 'noconfirm@test.com',
          password: 'DeleteTest123!'
        });

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        const response = await request(app)
          .delete('/api/users/account')
          .set('Authorization', `Bearer ${token}`)
          .send({
            password: 'DeleteTest123!'
            // confirmation 필드 누락
          })
          .expect(400);

        expectError(response, '확인 문구 필요');
      });

      test('잘못된 확인 문구로 요청 시 실패', async () => {
        const user = await createTestUser({
          email: 'wrongconfirm@test.com',
          password: 'DeleteTest123!'
        });

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        const response = await request(app)
          .delete('/api/users/account')
          .set('Authorization', `Bearer ${token}`)
          .send({
            password: 'DeleteTest123!',
            confirmation: 'DELETE_ACCOUNT' // 틀린 확인 문구
          })
          .expect(400);

        expectError(response, '잘못된 확인 문구');
        expect(response.body.message).toContain('DELETE_MY_ACCOUNT');
      });

      test('관리자 계정 삭제 시 실패', async () => {
        const admin = await createTestUser({
          email: 'admin@test.com',
          password: 'AdminTest123!',
          role: 'admin'
        });

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: admin.email,
            password: admin.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        const response = await request(app)
          .delete('/api/users/account')
          .set('Authorization', `Bearer ${token}`)
          .send({
            password: 'AdminTest123!',
            confirmation: 'DELETE_MY_ACCOUNT'
          })
          .expect(403);

        expectError(response, '관리자 계정 삭제 불가');
        expect(response.body.message).toContain('관리자 계정은 직접 삭제할 수 없습니다');
      });

      test('계정 생성 24시간 이내 삭제 시 실패', async () => {
        const user = await createTestUser({
          email: 'newaccount@test.com',
          password: 'DeleteTest123!'
        });

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        const response = await request(app)
          .delete('/api/users/account')
          .set('Authorization', `Bearer ${token}`)
          .send({
            password: 'DeleteTest123!',
            confirmation: 'DELETE_MY_ACCOUNT'
          })
          .expect(429);

        expectError(response, '24시간 제한');
        expect(response.body.message).toContain('24시간이 지나야 삭제할 수 있습니다');
      });
    });

    describe('🔍 데이터 무결성 검증', () => {
      
      test('계정 삭제 시 관련 데이터가 적절히 처리되어야 함', async () => {
        const user = await createTestUser({
          email: 'dataintegrity@test.com',
          password: 'DeleteTest123!'
        });

        // 계정 생성 24시간 후로 설정
        await global.testPool.query(
          'UPDATE users SET created_at = NOW() - INTERVAL \'25 hours\' WHERE id = $1',
          [user.id]
        );

        // 민원 생성
        await global.testPool.query(
          `INSERT INTO complaints (user_id, title, content, category, priority, status)
           VALUES ($1, 'Test Complaint', 'Test Content', 'other', 'medium', 'pending')`,
          [user.id]
        );

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        // 계정 삭제
        await request(app)
          .delete('/api/users/account')
          .set('Authorization', `Bearer ${token}`)
          .send({
            password: 'DeleteTest123!',
            confirmation: 'DELETE_MY_ACCOUNT'
          })
          .expect(200);

        // 사용자 계정 상태 확인
        const userCheck = await global.testPool.query(
          'SELECT is_active, email, name FROM users WHERE id = $1',
          [user.id]
        );

        expect(userCheck.rows[0].is_active).toBe(false);
        expect(userCheck.rows[0].email).toContain('deleted_user_');
        expect(userCheck.rows[0].name).toBe('Deleted User');

        // 민원 상태 확인
        const complaintCheck = await global.testPool.query(
          'SELECT is_active FROM complaints WHERE user_id = $1',
          [user.id]
        );

        expect(complaintCheck.rows[0].is_active).toBe(false);
      });
    });
  });
});
