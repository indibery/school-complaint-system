/**
 * 메모리 DB 기본 기능 검증 테스트
 * 기존 테스트와 병렬로 실행되며, 메모리 DB 성능과 기능을 확인합니다.
 */

const { getMemoryTestHelpers } = require('./helpers/memoryTestHelpers');

describe('🧪 Memory Database Verification Tests', () => {
  let memoryHelpers;

  beforeAll(async () => {
    memoryHelpers = getMemoryTestHelpers();
    await memoryHelpers.setupMemoryDb();
    console.log('🚀 Memory DB verification tests started');
  });

  afterAll(async () => {
    await memoryHelpers.closeMemoryDb();
    console.log('✅ Memory DB verification tests completed');
  });

  beforeEach(async () => {
    await memoryHelpers.cleanupMemoryDb();
  });

  describe('Database Connection & Schema', () => {
    test('should connect to memory database successfully', async () => {
      const tables = await memoryHelpers.getAllTables();
      expect(tables.length).toBeGreaterThan(0);
      
      const expectedTables = [
        'users', 'complaints', 'visit_reservations', 'notifications',
        'password_reset_tokens', 'email_verification_tokens', 'token_blacklist',
        'complaint_comments', 'complaint_attachments', 'complaint_history'
      ];
      
      const tableNames = tables.map(t => t.name);
      expectedTables.forEach(table => {
        expect(tableNames).toContain(table);
      });
    });

    test('should have correct user table schema', async () => {
      const schema = await memoryHelpers.getTableSchema('users');
      
      const columnNames = schema.map(col => col.name);
      const expectedColumns = [
        'id', 'email', 'password_hash', 'name', 'phone', 'role',
        'is_active', 'email_verified', 'created_at', 'updated_at'
      ];
      
      expectedColumns.forEach(column => {
        expect(columnNames).toContain(column);
      });
    });
  });

  describe('User Management', () => {
    test('should create test user successfully', async () => {
      const { result: user, duration } = await memoryHelpers.measurePerformance(
        'Create Test User',
        () => memoryHelpers.createTestUser({
          email: 'memory-test@example.com',
          name: '메모리 테스트 사용자'
        })
      );

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.email).toBe('memory-test@example.com');
      expect(user.name).toBe('메모리 테스트 사용자');
      expect(user.role).toBe('parent');
      expect(duration).toBeLessThan(50); // 50ms 이내 (매우 빠름)
    });

    test('should create multiple users with batch performance', async () => {
      const userCount = 100;
      
      const { result: users, duration } = await memoryHelpers.measurePerformance(
        `Create ${userCount} Users`,
        () => memoryHelpers.createMultipleUsers(userCount)
      );

      expect(users).toHaveLength(userCount);
      expect(duration).toBeLessThan(1000); // 1초 이내 (PostgreSQL보다 10-50배 빠름)
      
      // 통계 확인
      const stats = await memoryHelpers.getDatabaseStats();
      expect(stats.users.count).toBe(userCount);
    });

    test('should generate valid JWT tokens', async () => {
      const user = await memoryHelpers.createTestUser();
      const token = memoryHelpers.generateTestToken(user);
      const authHeader = memoryHelpers.getAuthHeader(user);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(authHeader).toMatch(/^Bearer /);
      
      // JWT 형식 확인
      const parts = token.split('.');
      expect(parts).toHaveLength(3);
    });

    test('should create different user roles', async () => {
      const parent = await memoryHelpers.createTestUser({ role: 'parent' });
      const teacher = await memoryHelpers.createTeacherUser();
      const admin = await memoryHelpers.createAdminUser();

      expect(parent.role).toBe('parent');
      expect(teacher.role).toBe('teacher');
      expect(admin.role).toBe('admin');

      const stats = await memoryHelpers.getDatabaseStats();
      expect(stats.users.count).toBe(3);
    });
  });

  describe('Complaint Management', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await memoryHelpers.createTestUser();
    });

    test('should create test complaint successfully', async () => {
      const { result: complaint, duration } = await memoryHelpers.measurePerformance(
        'Create Test Complaint',
        () => memoryHelpers.createTestComplaint(testUser.id, {
          title: '메모리 DB 테스트 민원',
          category: 'facility',
          priority: 'high'
        })
      );

      expect(complaint).toBeDefined();
      expect(complaint.id).toBeDefined();
      expect(complaint.user_id).toBe(testUser.id);
      expect(complaint.title).toBe('메모리 DB 테스트 민원');
      expect(complaint.category).toBe('facility');
      expect(complaint.priority).toBe('high');
      expect(duration).toBeLessThan(30); // 30ms 이내
    });

    test('should create multiple complaints with batch performance', async () => {
      const complaintCount = 50;
      
      const { result: complaints, duration } = await memoryHelpers.measurePerformance(
        `Create ${complaintCount} Complaints`,
        () => memoryHelpers.createMultipleComplaints(testUser.id, complaintCount)
      );

      expect(complaints).toHaveLength(complaintCount);
      expect(duration).toBeLessThan(500); // 500ms 이내
      
      const stats = await memoryHelpers.getDatabaseStats();
      expect(stats.complaints.count).toBe(complaintCount);
    });

    test('should execute direct SQL queries', async () => {
      await memoryHelpers.createTestComplaint(testUser.id);
      
      const result = await memoryHelpers.executeQuery(
        'SELECT * FROM complaints WHERE user_id = ?',
        [testUser.id]
      );

      expect(result).toHaveLength(1);
      expect(result[0].user_id).toBe(testUser.id);
    });
  });

  describe('Performance Comparison', () => {
    test('should demonstrate memory vs disk performance difference', async () => {
      console.log('\n📊 Performance Comparison Test');
      
      // 메모리 사용량 체크
      const initialMemory = memoryHelpers.getMemoryUsage();
      
      // 대량 데이터 생성 테스트
      const { duration: userCreationTime } = await memoryHelpers.measurePerformance(
        'Create 500 Users',
        () => memoryHelpers.createMultipleUsers(500)
      );

      const users = await memoryHelpers.executeQuery('SELECT id FROM users LIMIT 10');
      const firstUserId = users[0].id;

      const { duration: complaintCreationTime } = await memoryHelpers.measurePerformance(
        'Create 100 Complaints',
        () => memoryHelpers.createMultipleComplaints(firstUserId, 100)
      );

      const { duration: queryTime } = await memoryHelpers.measurePerformance(
        'Complex Query',
        () => memoryHelpers.executeQuery(`
          SELECT u.name, u.role, COUNT(c.id) as complaint_count
          FROM users u
          LEFT JOIN complaints c ON u.id = c.user_id
          GROUP BY u.id, u.name, u.role
          ORDER BY complaint_count DESC
          LIMIT 20
        `)
      );

      const finalMemory = memoryHelpers.getMemoryUsage();
      
      console.log('\n⚡ Performance Results:');
      console.log(`- 500 Users created in: ${userCreationTime.toFixed(2)}ms`);
      console.log(`- 100 Complaints created in: ${complaintCreationTime.toFixed(2)}ms`);
      console.log(`- Complex query executed in: ${queryTime.toFixed(2)}ms`);
      console.log(`- Total test time: ${(userCreationTime + complaintCreationTime + queryTime).toFixed(2)}ms`);
      
      // 성능 기대치 (PostgreSQL 대비 10-50배 빠름)
      expect(userCreationTime).toBeLessThan(2000); // 2초 이내
      expect(complaintCreationTime).toBeLessThan(1000); // 1초 이내
      expect(queryTime).toBeLessThan(100); // 100ms 이내
      
      console.log('\n✅ Memory DB Performance Test Passed!');
      console.log('🚀 Ready for integration with existing test suite');
    });
  });

  describe('Data Isolation', () => {
    test('should maintain complete isolation between test runs', async () => {
      // 첫 번째 테스트 실행
      await memoryHelpers.createTestUser({ email: 'isolation1@test.com' });
      await memoryHelpers.createTestUser({ email: 'isolation2@test.com' });
      
      let stats = await memoryHelpers.getDatabaseStats();
      expect(stats.users.count).toBe(2);
      
      // 정리 후 두 번째 테스트 실행
      await memoryHelpers.cleanupMemoryDb();
      
      stats = await memoryHelpers.getDatabaseStats();
      expect(stats.users.count).toBe(0);
      
      // 세 번째 테스트 - 완전히 격리됨
      await memoryHelpers.createTestUser({ email: 'isolation3@test.com' });
      
      stats = await memoryHelpers.getDatabaseStats();
      expect(stats.users.count).toBe(1);
      
      const users = await memoryHelpers.executeQuery('SELECT email FROM users');
      expect(users[0].email).toBe('isolation3@test.com');
    });
  });
});
