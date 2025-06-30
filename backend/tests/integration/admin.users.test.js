const request = require('supertest');
const { createTestApp } = require('../helpers/testApp');
const { 
  createTestUser, 
  expectSuccess, 
  expectError,
  dbHelpers,
  timeHelpers
} = require('../helpers/testHelpers');

describe('🔧 관리자용 사용자 관리 API 테스트', () => {
  let app;
  let adminUser;
  let adminToken;
  let regularUser;

  beforeAll(async () => {
    app = createTestApp();
    
    // 관리자 사용자 생성
    adminUser = await createTestUser({
      email: 'admin@test.com',
      name: '관리자',
      role: 'admin',
      password: 'AdminTest123!'
    });
    
    // 일반 사용자 생성
    regularUser = await createTestUser({
      email: 'regular@test.com',
      name: '일반사용자',
      role: 'parent',
      password: 'RegularTest123!'
    });
    
    // 관리자 로그인
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: adminUser.email,
        password: adminUser.originalPassword
      });
    
    adminToken = adminLogin.body.data.accessToken;
  });

  describe('GET /api/admin/users', () => {
    
    describe('✅ 성공 케이스', () => {
      
      test('관리자가 사용자 목록을 조회할 수 있어야 함', async () => {
        const response = await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expectSuccess(response, '사용자 목록 조회');
        
        expect(response.body.data.users).toBeInstanceOf(Array);
        expect(response.body.data.users.length).toBeGreaterThan(0);
        expect(response.body.data.pagination).toHaveProperty('total_users');
        expect(response.body.data.pagination).toHaveProperty('current_page');
        expect(response.body.data.statistics).toHaveProperty('total_users');
        expect(response.body.data.filters_applied).toBeDefined();
        
        // 사용자 정보 구조 검증
        const firstUser = response.body.data.users[0];
        expect(firstUser).toHaveProperty('id');
        expect(firstUser).toHaveProperty('email');
        expect(firstUser).toHaveProperty('name');
        expect(firstUser).toHaveProperty('role');
        expect(firstUser).toHaveProperty('complaint_count');
        expect(firstUser).toHaveProperty('activity_status');
      });

      test('검색 필터로 사용자를 찾을 수 있어야 함', async () => {
        const response = await request(app)
          .get('/api/admin/users?search=admin')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expectSuccess(response, '검색 필터');
        
        // 검색 결과에 관리자가 포함되어 있어야 함
        const foundAdmin = response.body.data.users.find(user => user.email === adminUser.email);
        expect(foundAdmin).toBeDefined();
        expect(response.body.data.filters_applied.search).toBe('admin');
      });

      test('역할별 필터로 사용자를 조회할 수 있어야 함', async () => {
        const response = await request(app)
          .get('/api/admin/users?role=admin')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expectSuccess(response, '역할 필터');
        
        // 모든 결과가 admin 역할이어야 함
        response.body.data.users.forEach(user => {
          expect(user.role).toBe('admin');
        });
        expect(response.body.data.filters_applied.role).toBe('admin');
      });

      test('페이징이 정상 작동해야 함', async () => {
        const response = await request(app)
          .get('/api/admin/users?page=1&limit=1')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expectSuccess(response, '페이징');
        
        expect(response.body.data.users).toHaveLength(1);
        expect(response.body.data.pagination.per_page).toBe(1);
        expect(response.body.data.pagination.current_page).toBe(1);
      });

      test('정렬 기능이 정상 작동해야 함', async () => {
        const response = await request(app)
          .get('/api/admin/users?sortBy=name&sortOrder=ASC')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expectSuccess(response, '정렬');
        
        expect(response.body.data.filters_applied.sort.field).toBe('name');
        expect(response.body.data.filters_applied.sort.order).toBe('ASC');
        
        // 이름 순으로 정렬되었는지 확인
        const users = response.body.data.users;
        for (let i = 1; i < users.length; i++) {
          expect(users[i-1].name.localeCompare(users[i].name)).toBeLessThanOrEqual(0);
        }
      });
    });

    describe('❌ 실패 케이스', () => {
      
      test('관리자 권한 없이 요청 시 실패', async () => {
        const regularLogin = await request(app)
          .post('/api/auth/login')
          .send({
            email: regularUser.email,
            password: regularUser.originalPassword
          });

        const regularToken = regularLogin.body.data.accessToken;

        const response = await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${regularToken}`)
          .expect(403);

        expectError(response, '권한 없음');
      });

      test('인증 토큰 없이 요청 시 실패', async () => {
        const response = await request(app)
          .get('/api/admin/users')
          .expect(401);

        expectError(response, '인증 필요');
      });

      test('잘못된 정렬 필드로 요청 시 실패', async () => {
        const response = await request(app)
          .get('/api/admin/users?sortBy=invalid_field')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);

        expectError(response, '잘못된 정렬 필드');
      });

      test('잘못된 페이지 번호로 요청 시 실패', async () => {
        const response = await request(app)
          .get('/api/admin/users?page=0')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);

        expectError(response, '잘못된 페이지 번호');
      });
    });
  });

  describe('GET /api/admin/users/:id', () => {
    
    describe('✅ 성공 케이스', () => {
      
      test('관리자가 특정 사용자 상세 정보를 조회할 수 있어야 함', async () => {
        const response = await request(app)
          .get(`/api/admin/users/${regularUser.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expectSuccess(response, '사용자 상세 조회');
        
        expect(response.body.data.user).toHaveProperty('id', regularUser.id);
        expect(response.body.data.user).toHaveProperty('email', regularUser.email);
        expect(response.body.data.user).toHaveProperty('activity');
        expect(response.body.data.user).toHaveProperty('login_history');
        
        // 활동 정보 검증
        expect(response.body.data.user.activity).toHaveProperty('total_complaints');
        expect(response.body.data.user.activity).toHaveProperty('total_visits');
      });
    });

    describe('❌ 실패 케이스', () => {
      
      test('존재하지 않는 사용자 ID로 요청 시 실패', async () => {
        const response = await request(app)
          .get('/api/admin/users/99999')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);

        expectError(response, '사용자 없음');
      });
    });
  });

  describe('PUT /api/admin/users/:id', () => {
    
    describe('✅ 성공 케이스', () => {
      
      test('관리자가 사용자 정보를 수정할 수 있어야 함', async () => {
        const response = await request(app)
          .put(`/api/admin/users/${regularUser.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: '수정된이름',
            email_verified: true,
            is_active: true
          })
          .expect(200);

        expectSuccess(response, '사용자 정보 수정');
        
        expect(response.body.data.user.name).toBe('수정된이름');
        expect(response.body.data.user.email_verified).toBe(true);
      });

      test('관리자가 사용자 역할을 변경할 수 있어야 함', async () => {
        const testUser = await createTestUser({
          email: 'rolechange@test.com',
          role: 'parent'
        });

        const response = await request(app)
          .put(`/api/admin/users/${testUser.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            role: 'teacher'
          })
          .expect(200);

        expectSuccess(response, '역할 변경');
        expect(response.body.data.user.role).toBe('teacher');
      });
    });

    describe('❌ 실패 케이스', () => {
      
      test('중복된 이메일로 수정 시 실패', async () => {
        const response = await request(app)
          .put(`/api/admin/users/${regularUser.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            email: adminUser.email // 이미 존재하는 이메일
          })
          .expect(400);

        expectError(response, '이메일 중복');
      });

      test('잘못된 역할로 수정 시 실패', async () => {
        const response = await request(app)
          .put(`/api/admin/users/${regularUser.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            role: 'invalid_role'
          })
          .expect(400);

        expectError(response, '잘못된 역할');
      });
    });
  });

  describe('DELETE /api/admin/users/:id', () => {
    
    describe('✅ 성공 케이스', () => {
      
      test('관리자가 사용자를 삭제할 수 있어야 함', async () => {
        const targetUser = await createTestUser({
          email: 'delete@test.com',
          name: '삭제대상'
        });

        const response = await request(app)
          .delete(`/api/admin/users/${targetUser.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            confirmation: 'ADMIN_DELETE_USER',
            reason: '테스트 목적으로 삭제합니다.'
          })
          .expect(200);

        expectSuccess(response, '사용자 삭제');
        
        // 사용자가 비활성화되었는지 확인
        const deletedUser = await global.testPool.query(
          'SELECT is_active, email FROM users WHERE id = $1',
          [targetUser.id]
        );
        
        expect(deletedUser.rows[0].is_active).toBe(false);
        expect(deletedUser.rows[0].email).toContain('_deleted_');
      });
    });

    describe('❌ 실패 케이스', () => {
      
      test('자기 자신을 삭제하려 할 때 실패', async () => {
        const response = await request(app)
          .delete(`/api/admin/users/${adminUser.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            confirmation: 'ADMIN_DELETE_USER',
            reason: '자기 자신 삭제 시도'
          })
          .expect(400);

        expectError(response, '자기 삭제 불가');
      });

      test('확인 문구 없이 삭제 시도 시 실패', async () => {
        const targetUser = await createTestUser({
          email: 'noconfirm@test.com'
        });

        const response = await request(app)
          .delete(`/api/admin/users/${targetUser.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            reason: '삭제 사유'
            // confirmation 필드 누락
          })
          .expect(400);

        expectError(response, '확인 문구 필요');
      });
    });
  });

  describe('POST /api/admin/users/:id/reset-password', () => {
    
    describe('✅ 성공 케이스', () => {
      
      test('관리자가 사용자 비밀번호를 초기화할 수 있어야 함', async () => {
        const targetUser = await createTestUser({
          email: 'resetpw@test.com'
        });

        const response = await request(app)
          .post(`/api/admin/users/${targetUser.id}/reset-password`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            new_password: 'NewPassword123!',
            send_notification: true
          })
          .expect(200);

        expectSuccess(response, '비밀번호 초기화');
        
        expect(response.body.data.user_id).toBe(targetUser.id);
        expect(response.body.data.notification_sent).toBe(true);
        expect(response.body.data.reset_at).toBeDefined();
      });
    });

    describe('❌ 실패 케이스', () => {
      
      test('약한 비밀번호로 초기화 시도 시 실패', async () => {
        const response = await request(app)
          .post(`/api/admin/users/${regularUser.id}/reset-password`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            new_password: 'weak'
          })
          .expect(400);

        expectError(response, '약한 비밀번호');
      });
    });
  });

  describe('POST /api/admin/users/:id/unlock', () => {
    
    describe('✅ 성공 케이스', () => {
      
      test('관리자가 잠긴 계정을 해제할 수 있어야 함', async () => {
        const lockedUser = await createTestUser({
          email: 'locked@test.com'
        });

        // 먼저 계정을 잠금 상태로 만들기
        await global.testPool.query(
          'UPDATE users SET locked_until = NOW() + INTERVAL \'1 hour\', login_attempts = 5 WHERE id = $1',
          [lockedUser.id]
        );

        const response = await request(app)
          .post(`/api/admin/users/${lockedUser.id}/unlock`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expectSuccess(response, '계정 잠금 해제');
        
        // 잠금이 해제되었는지 확인
        const unlockedUser = await global.testPool.query(
          'SELECT locked_until, login_attempts FROM users WHERE id = $1',
          [lockedUser.id]
        );
        
        expect(unlockedUser.rows[0].locked_until).toBeNull();
        expect(unlockedUser.rows[0].login_attempts).toBe(0);
      });
    });

    describe('❌ 실패 케이스', () => {
      
      test('잠기지 않은 계정 해제 시도 시 실패', async () => {
        const response = await request(app)
          .post(`/api/admin/users/${regularUser.id}/unlock`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);

        expectError(response, '잠금 상태 아님');
      });
    });
  });

  describe('GET /api/admin/users/stats', () => {
    
    describe('✅ 성공 케이스', () => {
      
      test('관리자가 사용자 통계를 조회할 수 있어야 함', async () => {
        const response = await request(app)
          .get('/api/admin/users/stats')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expectSuccess(response, '관리자 사용자 통계');
        
        expect(response.body.data.overview).toHaveProperty('total_users');
        expect(response.body.data.overview).toHaveProperty('active_users');
        expect(response.body.data.role_distribution).toBeInstanceOf(Array);
        expect(response.body.data.registration_trend).toBeInstanceOf(Array);
        expect(response.body.data.activity_analysis).toBeInstanceOf(Array);
        expect(response.body.data.period_info).toHaveProperty('period_days');
      });

      test('기간별 통계를 조회할 수 있어야 함', async () => {
        const response = await request(app)
          .get('/api/admin/users/stats?period=7')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expectSuccess(response, '7일 통계');
        expect(response.body.data.period_info.period_days).toBe(7);
      });
    });
  });
});
