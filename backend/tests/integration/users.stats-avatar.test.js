const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { createTestApp } = require('../helpers/testApp');
const { 
  createTestUser, 
  expectSuccess, 
  expectError,
  dbHelpers,
  timeHelpers
} = require('../helpers/testHelpers');

describe('📊 사용자 통계 및 프로필 이미지 API 테스트', () => {
  let app;

  beforeAll(async () => {
    app = createTestApp();
  });

  describe('GET /api/users/stats', () => {
    
    describe('✅ 성공 케이스', () => {
      
      test('기본 사용자 통계를 조회할 수 있어야 함', async () => {
        const user = await createTestUser({
          email: 'stats@test.com',
          name: '통계테스트'
        });

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        const response = await request(app)
          .get('/api/users/stats')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expectSuccess(response, '사용자 통계 조회');
        
        expect(response.body.data.user_stats).toHaveProperty('account');
        expect(response.body.data.user_stats).toHaveProperty('complaints');
        expect(response.body.data.user_stats).toHaveProperty('visits');
        expect(response.body.data.user_stats).toHaveProperty('period_info');
        
        // 계정 정보 검증
        expect(response.body.data.user_stats.account).toHaveProperty('days_since_registration');
        expect(response.body.data.user_stats.account).toHaveProperty('email_verified');
        expect(response.body.data.user_stats.account).toHaveProperty('activity_score');
        expect(response.body.data.user_stats.account).toHaveProperty('profile_completion');
      });

      test('기간별 통계를 조회할 수 있어야 함', async () => {
        const user = await createTestUser({
          email: 'periodstats@test.com'
        });

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        // 7일 통계
        const response7 = await request(app)
          .get('/api/users/stats?period=7')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expectSuccess(response7, '7일 통계');
        expect(response7.body.data.user_stats.period_info.period_days).toBe(7);

        // 90일 통계
        const response90 = await request(app)
          .get('/api/users/stats?period=90')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expectSuccess(response90, '90일 통계');
        expect(response90.body.data.user_stats.period_info.period_days).toBe(90);
      });

      test('민원이 있는 사용자의 상세 통계를 조회할 수 있어야 함', async () => {
        const user = await createTestUser({
          email: 'complaintuser@test.com'
        });

        // 테스트용 민원 생성
        await global.testPool.query(
          `INSERT INTO complaints (user_id, title, content, category, priority, status)
           VALUES ($1, 'Test Complaint 1', 'Test Content', 'facility', 'high', 'pending'),
                  ($1, 'Test Complaint 2', 'Test Content', 'meal', 'medium', 'resolved')`,
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
          .get('/api/users/stats')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expectSuccess(response, '민원 통계 포함');
        
        const complaints = response.body.data.user_stats.complaints;
        expect(complaints.total_complaints).toBe(2);
        expect(complaints.pending_complaints).toBe(1);
        expect(complaints.resolved_complaints).toBe(1);
        expect(complaints.resolution_rate).toBe(50);
        
        // 우선순위별 분포 확인
        expect(complaints.priority_distribution.high).toBe(1);
        expect(complaints.priority_distribution.medium).toBe(1);
        
        // 카테고리별 분석 확인
        expect(complaints.category_breakdown).toHaveLength(2);
        expect(complaints.category_breakdown).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ category: 'facility', count: 1 }),
            expect.objectContaining({ category: 'meal', count: 1 })
          ])
        );
      });
    });

    describe('❌ 실패 케이스', () => {
      
      test('인증 토큰 없이 요청 시 실패', async () => {
        const response = await request(app)
          .get('/api/users/stats')
          .expect(401);

        expectError(response, '인증 필요');
      });

      test('잘못된 기간 파라미터로 요청 시 실패', async () => {
        const user = await createTestUser();
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        const response = await request(app)
          .get('/api/users/stats?period=invalid')
          .set('Authorization', `Bearer ${token}`)
          .expect(400);

        expectError(response, '잘못된 기간');
        expect(response.body.message).toContain('유효한 기간을 선택해주세요');
      });

      test('잘못된 토큰으로 요청 시 실패', async () => {
        const response = await request(app)
          .get('/api/users/stats')
          .set('Authorization', 'Bearer invalid_token')
          .expect(401);

        expectError(response, '유효하지 않은 토큰');
      });
    });
  });

  describe('POST /api/users/upload-avatar', () => {
    
    // 테스트 이미지 파일 경로
    const testImagePath = path.join(__dirname, '../fixtures/test-avatar.png');
    const testLargeImagePath = path.join(__dirname, '../fixtures/large-image.jpg');
    const testInvalidFilePath = path.join(__dirname, '../fixtures/test-document.txt');
    
    // 테스트 전에 fixtures 디렉토리와 테스트 파일 생성
    beforeAll(async () => {
      const fixturesDir = path.join(__dirname, '../fixtures');
      if (!fs.existsSync(fixturesDir)) {
        fs.mkdirSync(fixturesDir, { recursive: true });
      }
      
      // 작은 테스트 이미지 생성 (1x1 PNG)
      const smallImageBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
        0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);
      
      fs.writeFileSync(testImagePath, smallImageBuffer);
      
      // 큰 이미지 파일 생성 (6MB 더미 파일)
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024, 0);
      fs.writeFileSync(testLargeImagePath, largeBuffer);
      
      // 텍스트 파일 생성
      fs.writeFileSync(testInvalidFilePath, 'This is not an image file');
    });
    
    // 테스트 후 생성된 파일들 정리
    afterAll(async () => {
      const filesToDelete = [testImagePath, testLargeImagePath, testInvalidFilePath];
      filesToDelete.forEach(file => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });
    });

    describe('✅ 성공 케이스', () => {
      
      test('정상적으로 프로필 이미지를 업로드할 수 있어야 함', async () => {
        const user = await createTestUser({
          email: 'avatar@test.com',
          name: '아바타테스트'
        });

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        const response = await request(app)
          .post('/api/users/upload-avatar')
          .set('Authorization', `Bearer ${token}`)
          .attach('avatar', testImagePath)
          .expect(200);

        expectSuccess(response, '프로필 이미지 업로드');
        
        expect(response.body.data.profile_image).toMatch(/^\/uploads\/avatars\/avatar-\d+-\d+\.png$/);
        expect(response.body.data.metadata).toHaveProperty('filename');
        expect(response.body.data.metadata).toHaveProperty('mimetype');
        expect(response.body.data.metadata).toHaveProperty('size');
        expect(response.body.data.metadata).toHaveProperty('uploaded_at');
        expect(response.body.data.previous_image_deleted).toBe(false);
      });

      test('기존 프로필 이미지를 교체할 수 있어야 함', async () => {
        const user = await createTestUser({
          email: 'replaceavatar@test.com'
        });

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        // 첫 번째 이미지 업로드
        const firstUpload = await request(app)
          .post('/api/users/upload-avatar')
          .set('Authorization', `Bearer ${token}`)
          .attach('avatar', testImagePath)
          .expect(200);

        expectSuccess(firstUpload, '첫 번째 이미지 업로드');
        
        // 두 번째 이미지 업로드 (교체)
        const secondUpload = await request(app)
          .post('/api/users/upload-avatar')
          .set('Authorization', `Bearer ${token}`)
          .attach('avatar', testImagePath)
          .expect(200);

        expectSuccess(secondUpload, '이미지 교체');
        expect(secondUpload.body.data.previous_image_deleted).toBe(true);
        
        // 파일명이 다른지 확인
        expect(firstUpload.body.data.profile_image).not.toBe(secondUpload.body.data.profile_image);
      });

      test('업로드 후 프로필에서 이미지 경로가 업데이트되어야 함', async () => {
        const user = await createTestUser({
          email: 'profileupdate@test.com'
        });

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        // 이미지 업로드
        const uploadResponse = await request(app)
          .post('/api/users/upload-avatar')
          .set('Authorization', `Bearer ${token}`)
          .attach('avatar', testImagePath)
          .expect(200);

        // 프로필 조회로 확인
        const profileResponse = await request(app)
          .get('/api/users/profile')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(profileResponse.body.data.user.profile_image).toBe(uploadResponse.body.data.profile_image);
      });
    });

    describe('❌ 실패 케이스', () => {
      
      test('인증 토큰 없이 요청 시 실패', async () => {
        const response = await request(app)
          .post('/api/users/upload-avatar')
          .attach('avatar', testImagePath)
          .expect(401);

        expectError(response, '인증 필요');
      });

      test('파일 없이 요청 시 실패', async () => {
        const user = await createTestUser();
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        const response = await request(app)
          .post('/api/users/upload-avatar')
          .set('Authorization', `Bearer ${token}`)
          .expect(400);

        expectError(response, '파일 없음');
        expect(response.body.message).toBe('업로드할 이미지 파일을 선택해주세요.');
      });

      test('지원하지 않는 파일 형식으로 요청 시 실패', async () => {
        const user = await createTestUser();
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        const response = await request(app)
          .post('/api/users/upload-avatar')
          .set('Authorization', `Bearer ${token}`)
          .attach('avatar', testInvalidFilePath)
          .expect(400);

        expectError(response, '지원하지 않는 파일 형식');
        expect(response.body.message).toContain('JPEG, PNG, GIF 파일만 업로드 가능');
      });

      test('파일 크기가 너무 클 때 실패', async () => {
        const user = await createTestUser();
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        const response = await request(app)
          .post('/api/users/upload-avatar')
          .set('Authorization', `Bearer ${token}`)
          .attach('avatar', testLargeImagePath)
          .expect(400);

        expectError(response, '파일 크기 ��과');
        expect(response.body.message).toContain('5MB 이하의 파일만 업로드 가능');
      });

      test('잘못된 토큰으로 요청 시 실패', async () => {
        const response = await request(app)
          .post('/api/users/upload-avatar')
          .set('Authorization', 'Bearer invalid_token')
          .attach('avatar', testImagePath)
          .expect(401);

        expectError(response, '유효하지 않은 토큰');
      });
    });

    describe('🔍 파일 시스템 검증', () => {
      
      test('업로드된 파일이 실제로 저장되어야 함', async () => {
        const user = await createTestUser({
          email: 'filesystem@test.com'
        });

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        const uploadResponse = await request(app)
          .post('/api/users/upload-avatar')
          .set('Authorization', `Bearer ${token}`)
          .attach('avatar', testImagePath)
          .expect(200);

        // 파일이 실제로 존재하는지 확인
        const uploadedFilePath = path.join(__dirname, '../../..', uploadResponse.body.data.profile_image);
        expect(fs.existsSync(uploadedFilePath)).toBe(true);
        
        // 파일 크기가 0보다 큰지 확인
        const stats = fs.statSync(uploadedFilePath);
        expect(stats.size).toBeGreaterThan(0);
      });

      test('업로드 실패 시 임시 파일이 정리되어야 함', async () => {
        const user = await createTestUser();
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: user.originalPassword
          });

        const token = loginResponse.body.data.accessToken;

        // 잘못된 파일 타입으로 업로드 시도
        await request(app)
          .post('/api/users/upload-avatar')
          .set('Authorization', `Bearer ${token}`)
          .attach('avatar', testInvalidFilePath)
          .expect(400);

        // uploads 디렉토리에서 해당 파일이 정리되었는지 확인
        // (실제 구현에서는 multer가 임시 파일을 생성하고 실패시 정리)
        const uploadsDir = path.join(__dirname, '../../../uploads/avatars');
        if (fs.existsSync(uploadsDir)) {
          const files = fs.readdirSync(uploadsDir);
          // 텍스트 파일이 남아있지 않아야 함
          const textFiles = files.filter(file => file.endsWith('.txt'));
          expect(textFiles).toHaveLength(0);
        }
      });
    });
  });
});
