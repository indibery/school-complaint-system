const request = require('supertest');
const { createTestApp } = require('../helpers/testApp');
const { 
  createTestUser, 
  expectSuccess, 
  expectError,
  dbHelpers,
  timeHelpers,
  createTestComplaint
} = require('../helpers/testHelpers');

describe('📝 민원 API 테스트', () => {
  let app;
  let parentUser, teacherUser, adminUser;
  let parentToken, teacherToken, adminToken;

  beforeAll(async () => {
    app = createTestApp();
    
    // 테스트 사용자 생성
    parentUser = await createTestUser({
      email: 'parent@test.com',
      password: 'Parent123!',
      role: 'parent',
      is_email_verified: true
    });

    teacherUser = await createTestUser({
      email: 'teacher@test.com',
      password: 'Teacher123!',
      role: 'teacher',
      is_email_verified: true
    });

    adminUser = await createTestUser({
      email: 'admin@test.com',
      password: 'Admin123!',
      role: 'admin',
      is_email_verified: true
    });

    // 로그인하여 토큰 획득
    parentToken = await getAuthToken(app, 'parent@test.com', 'Parent123!');
    teacherToken = await getAuthToken(app, 'teacher@test.com', 'Teacher123!');
    adminToken = await getAuthToken(app, 'admin@test.com', 'Admin123!');
  });

  afterAll(async () => {
    await dbHelpers.cleanup();
  });

  describe('POST /api/complaints', () => {
    
    describe('✅ 성공 케이스', () => {
      
      test('학부모 - 민원 등록 성공', async () => {
        const complaintData = {
          title: '급식 관련 민원',
          description: '급식의 질이 좋지 않아서 개선을 요청드립니다.',
          category: 'meal',
          priority: 'medium',
          anonymous: false
        };

        const response = await request(app)
          .post('/api/complaints')
          .set('Authorization', `Bearer ${parentToken}`)
          .send(complaintData)
          .expect(201);

        const result = expectSuccess(response);
        
        expect(result.message).toContain('성공적으로 등록');
        expect(result.data.complaint.id).toBeTruthy();
        expect(result.data.complaint.title).toBe(complaintData.title);
        expect(result.data.complaint.description).toBe(complaintData.description);
        expect(result.data.complaint.category).toBe(complaintData.category);
        expect(result.data.complaint.status).toBe('submitted');
        expect(result.data.complaint.priority).toBe(complaintData.priority);
        expect(result.data.complaint.anonymous).toBe(complaintData.anonymous);
      });

      test('익명 민원 등록 성공', async () => {
        const complaintData = {
          title: '익명 민원입니다',
          description: '익명으로 민원을 제출합니다.',
          category: 'safety',
          priority: 'high',
          anonymous: true
        };

        const response = await request(app)
          .post('/api/complaints')
          .set('Authorization', `Bearer ${parentToken}`)
          .send(complaintData)
          .expect(201);

        const result = expectSuccess(response);
        expect(result.data.complaint.anonymous).toBe(true);
      });
    });

    describe('❌ 실패 케이스', () => {
      
      test('인증 토큰 없음', async () => {
        const response = await request(app)
          .post('/api/complaints')
          .send({
            title: '테스트 민원',
            description: '테스트 설명',
            category: 'meal'
          })
          .expect(401);

        expectError(response, 401);
      });

      test('필수 필드 누락', async () => {
        const response = await request(app)
          .post('/api/complaints')
          .set('Authorization', `Bearer ${parentToken}`)
          .send({
            title: '제목만 있는 민원'
            // description, category 누락
          })
          .expect(400);

        expectError(response, 400);
      });

      test('유효하지 않은 카테고리', async () => {
        const response = await request(app)
          .post('/api/complaints')
          .set('Authorization', `Bearer ${parentToken}`)
          .send({
            title: '테스트 민원',
            description: '테스트 설명',
            category: 'invalid_category'
          })
          .expect(400);

        expectError(response, 400);
      });
    });
  });

  describe('GET /api/complaints', () => {
    
    beforeEach(async () => {
      // 테스트 민원 생성
      await createTestComplaint({
        user_id: parentUser.id,
        title: '테스트 민원 1',
        description: '테스트 설명 1',
        category: 'meal',
        status: 'submitted'
      });
    });

    describe('✅ 성공 케이스', () => {
      
      test('학부모 - 본인 민원 목록 조회', async () => {
        const response = await request(app)
          .get('/api/complaints')
          .set('Authorization', `Bearer ${parentToken}`)
          .expect(200);

        const result = expectSuccess(response);
        
        expect(result.data.complaints).toBeInstanceOf(Array);
        expect(result.data.pagination).toBeTruthy();
        expect(result.data.pagination.page).toBe(1);
        expect(result.data.pagination.limit).toBe(10);
      });

      test('교사 - 전체 민원 목록 조회', async () => {
        const response = await request(app)
          .get('/api/complaints')
          .set('Authorization', `Bearer ${teacherToken}`)
          .expect(200);

        const result = expectSuccess(response);
        expect(result.data.complaints).toBeInstanceOf(Array);
      });

      test('페이지네이션 테스트', async () => {
        const response = await request(app)
          .get('/api/complaints?page=1&limit=5')
          .set('Authorization', `Bearer ${parentToken}`)
          .expect(200);

        const result = expectSuccess(response);
        expect(result.data.pagination.page).toBe(1);
        expect(result.data.pagination.limit).toBe(5);
      });

      test('필터링 테스트', async () => {
        const response = await request(app)
          .get('/api/complaints?category=meal&status=submitted')
          .set('Authorization', `Bearer ${parentToken}`)
          .expect(200);

        const result = expectSuccess(response);
        expect(result.data.filters.category).toBe('meal');
        expect(result.data.filters.status).toBe('submitted');
      });
    });
  });

  describe('GET /api/complaints/:id', () => {
    let testComplaint;

    beforeEach(async () => {
      testComplaint = await createTestComplaint({
        user_id: parentUser.id,
        title: '상세 조회 테스트 민원',
        description: '상세 조회 테스트 설명',
        category: 'education',
        status: 'submitted'
      });
    });

    describe('✅ 성공 케이스', () => {
      
      test('학부모 - 본인 민원 상세 조회', async () => {
        const response = await request(app)
          .get(`/api/complaints/${testComplaint.id}`)
          .set('Authorization', `Bearer ${parentToken}`)
          .expect(200);

        const result = expectSuccess(response);
        
        expect(result.data.complaint.id).toBe(testComplaint.id);
        expect(result.data.complaint.title).toBe(testComplaint.title);
        expect(result.data.complaint.attachments).toBeInstanceOf(Array);
        expect(result.data.complaint.comments).toBeInstanceOf(Array);
      });

      test('교사 - 타인 민원 상세 조회', async () => {
        const response = await request(app)
          .get(`/api/complaints/${testComplaint.id}`)
          .set('Authorization', `Bearer ${teacherToken}`)
          .expect(200);

        const result = expectSuccess(response);
        expect(result.data.complaint.id).toBe(testComplaint.id);
      });
    });

    describe('��� 실패 케이스', () => {
      
      test('존재하지 않는 민원 ID', async () => {
        const response = await request(app)
          .get('/api/complaints/99999')
          .set('Authorization', `Bearer ${parentToken}`)
          .expect(404);

        expectError(response, 404);
      });

      test('유효하지 않은 ID 형식', async () => {
        const response = await request(app)
          .get('/api/complaints/invalid-id')
          .set('Authorization', `Bearer ${parentToken}`)
          .expect(400);

        expectError(response, 400);
      });
    });
  });

  describe('PUT /api/complaints/:id', () => {
    let testComplaint;

    beforeEach(async () => {
      testComplaint = await createTestComplaint({
        user_id: parentUser.id,
        title: '수정 테스트 민원',
        description: '수정 테스트 설명',
        category: 'facility',
        status: 'submitted'
      });
    });

    describe('✅ 성공 케이스', () => {
      
      test('학부모 - 본인 민원 수정', async () => {
        const updateData = {
          title: '수정된 민원 제목',
          description: '수정된 민원 설명',
          category: 'safety',
          priority: 'high'
        };

        const response = await request(app)
          .put(`/api/complaints/${testComplaint.id}`)
          .set('Authorization', `Bearer ${parentToken}`)
          .send(updateData)
          .expect(200);

        const result = expectSuccess(response);
        
        expect(result.data.complaint.title).toBe(updateData.title);
        expect(result.data.complaint.description).toBe(updateData.description);
        expect(result.data.complaint.category).toBe(updateData.category);
        expect(result.data.complaint.priority).toBe(updateData.priority);
      });

      test('부분 수정 테스트', async () => {
        const updateData = {
          title: '부분 수정된 제목'
        };

        const response = await request(app)
          .put(`/api/complaints/${testComplaint.id}`)
          .set('Authorization', `Bearer ${parentToken}`)
          .send(updateData)
          .expect(200);

        const result = expectSuccess(response);
        expect(result.data.complaint.title).toBe(updateData.title);
      });
    });

    describe('❌ 실패 케이스', () => {
      
      test('타인 민원 수정 시도', async () => {
        const otherComplaint = await createTestComplaint({
          user_id: teacherUser.id,
          title: '다른 사용자 민원',
          description: '다른 사용자 설명',
          category: 'meal',
          status: 'submitted'
        });

        const response = await request(app)
          .put(`/api/complaints/${otherComplaint.id}`)
          .set('Authorization', `Bearer ${parentToken}`)
          .send({ title: '수정 시도' })
          .expect(404);

        expectError(response, 404);
      });
    });
  });

  describe('DELETE /api/complaints/:id', () => {
    let testComplaint;

    beforeEach(async () => {
      testComplaint = await createTestComplaint({
        user_id: parentUser.id,
        title: '삭제 테스트 민원',
        description: '삭제 테스트 설명',
        category: 'administration',
        status: 'submitted'
      });
    });

    describe('✅ 성공 케이스', () => {
      
      test('학부모 - 본인 민원 삭제', async () => {
        const response = await request(app)
          .delete(`/api/complaints/${testComplaint.id}`)
          .set('Authorization', `Bearer ${parentToken}`)
          .expect(200);

        const result = expectSuccess(response);
        
        expect(result.data.complaint.id).toBe(testComplaint.id);
        expect(result.data.complaint.status).toBe('closed');
        expect(result.data.complaint.deleted_at).toBeTruthy();
      });
    });
  });

  describe('PATCH /api/complaints/:id/status', () => {
    let testComplaint;

    beforeEach(async () => {
      testComplaint = await createTestComplaint({
        user_id: parentUser.id,
        title: '상태 변경 테스트 민원',
        description: '상태 변경 테스트 설명',
        category: 'education',
        status: 'submitted'
      });
    });

    describe('✅ 성공 케이스', () => {
      
      test('교사 - 민원 상태 변경', async () => {
        const statusData = {
          status: 'in_progress',
          assigned_to: teacherUser.id,
          response: '처리 시작합니다.'
        };

        const response = await request(app)
          .patch(`/api/complaints/${testComplaint.id}/status`)
          .set('Authorization', `Bearer ${teacherToken}`)
          .send(statusData)
          .expect(200);

        const result = expectSuccess(response);
        
        expect(result.data.complaint.status).toBe(statusData.status);
        expect(result.data.complaint.assigned_to).toBe(statusData.assigned_to);
        expect(result.data.complaint.response).toBe(statusData.response);
      });

      test('관리자 - 민원 해결 완료', async () => {
        const statusData = {
          status: 'resolved',
          response: '민원이 해결되었습니다.'
        };

        const response = await request(app)
          .patch(`/api/complaints/${testComplaint.id}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(statusData)
          .expect(200);

        const result = expectSuccess(response);
        
        expect(result.data.complaint.status).toBe('resolved');
        expect(result.data.complaint.resolved_at).toBeTruthy();
      });
    });

    describe('❌ 실패 케이스', () => {
      
      test('학부모 - 상태 변경 권한 없음', async () => {
        const response = await request(app)
          .patch(`/api/complaints/${testComplaint.id}/status`)
          .set('Authorization', `Bearer ${parentToken}`)
          .send({ status: 'in_progress' })
          .expect(403);

        expectError(response, 403);
      });

      test('유효하지 않은 상태값', async () => {
        const response = await request(app)
          .patch(`/api/complaints/${testComplaint.id}/status`)
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({ status: 'invalid_status' })
          .expect(400);

        expectError(response, 400);
      });
    });
  });
});

// 헬퍼 함수
async function getAuthToken(app, email, password) {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  
  return response.body.data.tokens.accessToken;
}