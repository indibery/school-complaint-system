const request = require('supertest');
const { createTestApp } = require('../helpers/testApp');
const { 
  createTestUser, 
  expectSuccess, 
  expectError,
  dbHelpers,
  timeHelpers
} = require('../helpers/testHelpers');

describe('👤 사용자 프로필 관리 API 테스트', () => {
  let app;

  beforeAll(async () => {
    app = createTestApp();
  });

  describe('GET /api/users/profile', () => {
    
    describe('✅ 성공 케이스', () => {
      
      test('내 프로필 조회 성공', async () => {
        const user = await createTestUser({
          email: 'profile@test.com',
          name: '김프로필',
          phone: '010-1234-5678',
          role: 'parent'
        });

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        const response = await request(app)
          .get('/api/users/profile')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expectSuccess(response, '프로필 조회');
        
        expect(response.body.data.user).toMatchObject({
          id: user.id,
          email: user.email,
          name: '김프로필',
          phone: '010-1234-5678',
          role: 'parent',
          is_active: true
        });

        // 비밀번호 해시는 포함되지 않아야 함
        expect(response.body.data.user.password_hash).toBeUndefined();
      });

      test('관리자 프로필 조회 성공', async () => {
        const admin = await createTestUser({
          email: 'admin@test.com',
          name: '관리자',
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
          .get('/api/users/profile')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expectSuccess(response, '관리자 프로필 조회');
        expect(response.body.data.user.role).toBe('admin');
      });
    });

    describe('❌ 실패 케이스', () => {
      
      test('인증 토큰 없이 요청 시 실패', async () => {
        const response = await request(app)
          .get('/api/users/profile')
          .expect(401);

        expectError(response, '인증 필요');
      });

      test('잘못된 토큰으로 요청 시 실패', async () => {
        const response = await request(app)
          .get('/api/users/profile')
          .set('Authorization', 'Bearer invalid_token')
          .expect(401);

        expectError(response, '유효하지 않은 토큰');
      });

      test('비활성화된 사용자 프로필 조회 실패', async () => {
        const user = await createTestUser({
          email: 'inactive@test.com',
          is_active: false
        });

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        // 비활성화된 사용자는 로그인부터 실패해야 함
        expect(loginResponse.status).toBe(401);
      });
    });
  });

  describe('PUT /api/users/profile', () => {
    
    describe('✅ 성공 케이스', () => {
      
      test('프로필 수정 성공 - 이름만 변경', async () => {
        const user = await createTestUser({
          email: 'update@test.com',
          name: '변경전이름'
        });

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        const response = await request(app)
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${token}`)
          .send({
            name: '변경후이름'
          })
          .expect(200);

        expectSuccess(response, '프로필 수정');
        
        expect(response.body.data.user).toMatchObject({
          id: user.id,
          name: '변경후이름',
          email: user.email
        });

        // 데이터베이스에서도 변경 확인
        const dbUser = await global.testPool.query(
          'SELECT name FROM users WHERE id = $1',
          [user.id]
        );
        expect(dbUser.rows[0].name).toBe('변경후이름');
      });

      test('프로필 수정 성공 - 전화번호만 변경', async () => {
        const user = await createTestUser({
          email: 'phone@test.com',
          phone: '010-1111-1111'
        });

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        const response = await request(app)
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${token}`)
          .send({
            phone: '010-2222-2222'
          })
          .expect(200);

        expectSuccess(response, '전화번호 수정');
        expect(response.body.data.user.phone).toBe('010-2222-2222');
      });

      test('프로필 수정 성공 - 이름과 전화번호 동시 변경', async () => {
        const user = await createTestUser({
          email: 'both@test.com',
          name: '기존이름',
          phone: '010-0000-0000'
        });

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        const response = await request(app)
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${token}`)
          .send({
            name: '새로운이름',
            phone: '010-9999-9999'
          })
          .expect(200);

        expectSuccess(response, '프로필 전체 수정');
        
        expect(response.body.data.user).toMatchObject({
          name: '새로운이름',
          phone: '010-9999-9999'
        });
      });
    });

    describe('❌ 실패 케이스', () => {
      
      test('인증 토큰 없이 수정 요청 시 실패', async () => {
        const response = await request(app)
          .put('/api/users/profile')
          .send({
            name: '새이름'
          })
          .expect(401);

        expectError(response, '인증 필요');
      });

      test('잘못된 이름 형식으로 수정 시 실패 - 너무 짧음', async () => {
        const user = await createTestUser();
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        const response = await request(app)
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${token}`)
          .send({
            name: '김' // 2자 미만
          })
          .expect(400);

        expectError(response, '유효성 검증 실패');
      });

      test('잘못된 이름 형식으로 수정 시 실패 - 특수문자 포함', async () => {
        const user = await createTestUser();
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        const response = await request(app)
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${token}`)
          .send({
            name: '김@철수' // 특수문자 포함
          })
          .expect(400);

        expectError(response, '유효성 검증 실패');
      });

      test('잘못된 전화번호 형식으로 수정 시 실패', async () => {
        const user = await createTestUser();
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        const response = await request(app)
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${token}`)
          .send({
            phone: '010-12345-6789' // 잘못된 형식
          })
          .expect(400);

        expectError(response, '유효성 검증 실패');
      });

      test('빈 데이터로 수정 요청 시 실패', async () => {
        const user = await createTestUser();
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        const response = await request(app)
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${token}`)
          .send({})
          .expect(400);

        expectError(response, '수정할 정보 없음');
      });
    });
  });
});
