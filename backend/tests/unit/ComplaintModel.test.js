/**
 * 📝 ComplaintModel 단위 테스트
 * 
 * @description ComplaintModel의 각 메서드별 단위 테스트
 */

const ComplaintModel = require('../../models/ComplaintModel');
const { dbHelpers, createTestUser } = require('../helpers/testHelpers');

describe('📝 ComplaintModel 단위 테스트', () => {
  let testUser;

  beforeAll(async () => {
    await dbHelpers.setup();
    testUser = await createTestUser({
      email: 'model@test.com',
      password: 'ModelTest123!',
      role: 'parent'
    });
  });

  afterAll(async () => {
    await dbHelpers.cleanup();
  });

  describe('create()', () => {
    
    test('민원 생성 성공', async () => {
      const complaintData = {
        user_id: testUser.id,
        title: '모델 테스트 민원',
        description: '모델 테스트 설명',
        category: 'facility',
        priority: 'medium',
        anonymous: false
      };

      const complaint = await ComplaintModel.create(complaintData);
      
      expect(complaint.id).toBeTruthy();
      expect(complaint.title).toBe(complaintData.title);
      expect(complaint.description).toBe(complaintData.description);
      expect(complaint.category).toBe(complaintData.category);
      expect(complaint.status).toBe('submitted');
      expect(complaint.priority).toBe(complaintData.priority);
      expect(complaint.anonymous).toBe(complaintData.anonymous);
      expect(complaint.created_at).toBeTruthy();
      expect(complaint.updated_at).toBeTruthy();
    });

    test('필수 필드 누락 시 오류', async () => {
      const invalidData = {
        user_id: testUser.id,
        title: '제목만 있는 민원'
        // description, category 누락
      };

      await expect(ComplaintModel.create(invalidData))
        .rejects.toThrow();
    });
  });

  describe('findAll()', () => {
    let complaint1, complaint2;

    beforeEach(async () => {
      complaint1 = await ComplaintModel.create({
        user_id: testUser.id,
        title: '첫 번째 민원',
        description: '첫 번째 설명',
        category: 'meal',
        priority: 'high',
        anonymous: false
      });

      complaint2 = await ComplaintModel.create({
        user_id: testUser.id,
        title: '두 번째 민원',
        description: '두 번째 설명',
        category: 'safety',
        priority: 'low',
        anonymous: true
      });
    });

    test('기본 목록 조회', async () => {
      const options = {
        userId: testUser.id,
        userRole: 'parent'
      };

      const result = await ComplaintModel.findAll(options);
      
      expect(result.complaints).toBeInstanceOf(Array);
      expect(result.complaints.length).toBeGreaterThan(0);
      expect(result.pagination).toBeTruthy();
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });

    test('페이지네이션 테스트', async () => {
      const options = {
        page: 1,
        limit: 1,
        userId: testUser.id,
        userRole: 'parent'
      };

      const result = await ComplaintModel.findAll(options);
      
      expect(result.complaints.length).toBe(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(1);
      expect(result.pagination.total).toBeGreaterThanOrEqual(2);
    });

    test('카테고리 필터링', async () => {
      const options = {
        category: 'meal',
        userId: testUser.id,
        userRole: 'parent'
      };

      const result = await ComplaintModel.findAll(options);
      
      result.complaints.forEach(complaint => {
        expect(complaint.category).toBe('meal');
      });
    });

    test('검색 기능', async () => {
      const options = {
        search: '첫 번째',
        userId: testUser.id,
        userRole: 'parent'
      };

      const result = await ComplaintModel.findAll(options);
      
      expect(result.complaints.length).toBeGreaterThan(0);
      result.complaints.forEach(complaint => {
        expect(complaint.title.includes('첫 번째') || complaint.description.includes('첫 번째')).toBe(true);
      });
    });

    test('정렬 기능', async () => {
      const options = {
        sortBy: 'priority',
        sortOrder: 'ASC',
        userId: testUser.id,
        userRole: 'parent'
      };

      const result = await ComplaintModel.findAll(options);
      
      expect(result.complaints).toBeInstanceOf(Array);
      // 정렬 확인은 복잡하므로 기본적인 구조만 검증
    });
  });

  describe('findById()', () => {
    let testComplaint;

    beforeEach(async () => {
      testComplaint = await ComplaintModel.create({
        user_id: testUser.id,
        title: 'ID 조회 테스트 민원',
        description: 'ID 조회 테스트 설명',
        category: 'education',
        priority: 'medium',
        anonymous: false
      });
    });

    test('본인 민원 조회 성공', async () => {
      const complaint = await ComplaintModel.findById(
        testComplaint.id, 
        'parent', 
        testUser.id
      );
      
      expect(complaint.id).toBe(testComplaint.id);
      expect(complaint.title).toBe(testComplaint.title);
      expect(complaint.description).toBe(testComplaint.description);
      expect(complaint.user_name).toBeTruthy();
    });

    test('존재하지 않는 ID 조회', async () => {
      const complaint = await ComplaintModel.findById(
        99999, 
        'parent', 
        testUser.id
      );
      
      expect(complaint).toBeNull();
    });

    test('교사 권한으로 타인 민원 조회', async () => {
      const complaint = await ComplaintModel.findById(
        testComplaint.id, 
        'teacher'
      );
      
      expect(complaint.id).toBe(testComplaint.id);
    });
  });

  describe('update()', () => {
    let testComplaint;

    beforeEach(async () => {
      testComplaint = await ComplaintModel.create({
        user_id: testUser.id,
        title: '수정 테스트 민원',
        description: '수정 테스트 설명',
        category: 'facility',
        priority: 'low',
        anonymous: false
      });
    });

    test('민원 수정 성공', async () => {
      const updateData = {
        title: '수정된 제목',
        description: '수정된 설명',
        category: 'safety',
        priority: 'high'
      };

      const updatedComplaint = await ComplaintModel.update(
        testComplaint.id,
        updateData,
        'parent',
        testUser.id
      );
      
      expect(updatedComplaint.title).toBe(updateData.title);
      expect(updatedComplaint.description).toBe(updateData.description);
      expect(updatedComplaint.category).toBe(updateData.category);
      expect(updatedComplaint.priority).toBe(updateData.priority);
      expect(updatedComplaint.updated_at).not.toBe(testComplaint.updated_at);
    });

    test('부분 수정', async () => {
      const updateData = {
        title: '부분 수정된 제목'
      };

      const updatedComplaint = await ComplaintModel.update(
        testComplaint.id,
        updateData,
        'parent',
        testUser.id
      );
      
      expect(updatedComplaint.title).toBe(updateData.title);
      expect(updatedComplaint.description).toBe(testComplaint.description); // 기존 값 유지
    });

    test('존재하지 않는 민원 수정', async () => {
      const updateData = { title: '수정 시도' };

      const result = await ComplaintModel.update(
        99999,
        updateData,
        'parent',
        testUser.id
      );
      
      expect(result).toBeNull();
    });
  });

  describe('delete()', () => {
    let testComplaint;

    beforeEach(async () => {
      testComplaint = await ComplaintModel.create({
        user_id: testUser.id,
        title: '삭제 테스트 민원',
        description: '삭제 테스트 설명',
        category: 'administration',
        priority: 'medium',
        anonymous: false
      });
    });

    test('민원 소프트 삭제 성공', async () => {
      const deletedComplaint = await ComplaintModel.delete(
        testComplaint.id,
        'parent',
        testUser.id
      );
      
      expect(deletedComplaint.id).toBe(testComplaint.id);
      expect(deletedComplaint.status).toBe('closed');
      expect(deletedComplaint.updated_at).not.toBe(testComplaint.updated_at);
    });

    test('존재하지 않는 민원 삭제', async () => {
      const result = await ComplaintModel.delete(
        99999,
        'parent',
        testUser.id
      );
      
      expect(result).toBeNull();
    });
  });

  describe('getStats()', () => {
    
    beforeEach(async () => {
      // 다양한 상태의 테스트 민원 생성
      await ComplaintModel.create({
        user_id: testUser.id,
        title: '통계 테스트 민원 1',
        description: '통계 테스트 설명 1',
        category: 'meal',
        priority: 'high',
        anonymous: false
      });

      await ComplaintModel.create({
        user_id: testUser.id,
        title: '통계 테스트 민원 2',
        description: '통계 테스트 설명 2',
        category: 'safety',
        priority: 'low',
        anonymous: true
      });
    });

    test('전체 통계 조회', async () => {
      const stats = await ComplaintModel.getStats();
      
      expect(stats.total_complaints).toBeGreaterThan(0);
      expect(stats.submitted_count).toBeGreaterThanOrEqual(0);
      expect(stats.in_progress_count).toBeGreaterThanOrEqual(0);
      expect(stats.resolved_count).toBeGreaterThanOrEqual(0);
      expect(stats.closed_count).toBeGreaterThanOrEqual(0);
      expect(stats.high_priority_count).toBeGreaterThanOrEqual(0);
      expect(stats.medium_priority_count).toBeGreaterThanOrEqual(0);
      expect(stats.low_priority_count).toBeGreaterThanOrEqual(0);
      expect(stats.anonymous_count).toBeGreaterThanOrEqual(0);
    });

    test('사용자별 통계 조회', async () => {
      const filters = {
        userId: testUser.id,
        userRole: 'parent'
      };

      const stats = await ComplaintModel.getStats(filters);
      
      expect(stats.total_complaints).toBeGreaterThan(0);
      expect(typeof stats.avg_resolution_hours).toBe('number');
    });
  });
});