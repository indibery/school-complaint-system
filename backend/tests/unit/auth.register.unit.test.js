const bcrypt = require('bcryptjs');
const { 
  createTestUser, 
  dbHelpers 
} = require('../helpers/testHelpers');

// Jest의 fail 함수 대신 사용
const fail = (message) => {
  throw new Error(message);
};

describe('🔧 회원가입 관련 단위 테스트', () => {

  describe('사용자 데이터 검증', () => {
    
    test('비밀번호 해싱 검증', async () => {
      const plainPassword = 'TestPassword123!';
      const user = await createTestUser({
        password: plainPassword
      });

      // 데이터베이스에서 사용자 조회
      const dbUser = await dbHelpers.getUserById(user.id);
      
      // 해싱된 비밀번호 확인
      expect(dbUser.password).not.toBe(plainPassword);
      expect(dbUser.password).toMatch(/^\$2[ayb]\$\d+\$/); // bcrypt 해시 패턴
      
      // 비밀번호 검증
      const isValid = await bcrypt.compare(plainPassword, dbUser.password);
      expect(isValid).toBe(true);
    });

    test('이메일 정규화 검증', async () => {
      const testCases = [
        { input: 'Test@Example.Com', expected: 'test@example.com' },
        { input: 'USER+TAG@DOMAIN.COM', expected: 'user@domain.com' },
        { input: 'test.email@test.com', expected: 'test.email@test.com' }
      ];

      for (const testCase of testCases) {
        const user = await createTestUser({
          email: testCase.input
        });

        const dbUser = await dbHelpers.getUserById(user.id);
        expect(dbUser.email).toBe(testCase.expected);
      }
    });

    test('전화번호 정규화 검증', async () => {
      const testCases = [
        { input: '010-1234-5678', expected: '010-1234-5678' },
        { input: '01023456789', expected: '010-2345-6789' },
        { input: '010 3456 7890', expected: '010-3456-7890' }
      ];

      for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        const user = await createTestUser({
          email: `phone-test-${i}@test.com`,
          phone: testCase.input
        });

        const dbUser = await dbHelpers.getUserById(user.id);
        expect(dbUser.phone).toBe(testCase.expected);
      }
    });

    test('기본값 설정 검증', async () => {
      const user = await createTestUser({
        email: 'defaults@test.com',
        password: 'TestPassword123!',
        name: '기본값테스트'
        // role, is_active, is_email_verified 등은 기본값으로 설정
      });

      const dbUser = await dbHelpers.getUserById(user.id);
      
      expect(dbUser.role).toBe('parent'); // 기본 역할
      expect(dbUser.is_active).toBe(true); // 기본 활성화
      expect(dbUser.is_email_verified).toBe(true); // 테스트용 기본값
      expect(dbUser.login_attempts).toBe(0);
      expect(dbUser.token_version).toBe(0);
      expect(dbUser.created_at).toBeTruthy();
      expect(dbUser.updated_at).toBeTruthy();
    });

  });

  describe('데이터베이스 제약 조건 테스트', () => {
    
    test('이메일 고유성 제약 조건', async () => {
      const email = 'unique@test.com';
      
      // 첫 번째 사용자 생성 성공
      const firstUser = await createTestUser({ email });
      expect(firstUser.id).toBeTruthy();

      // 동일한 이메일로 두 번째 사용자 생성 시도 (직접 쿼리)
      try {
        await global.testPool.query(
          'INSERT INTO users (email, password, name, phone, role, is_active, is_email_verified) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [email, 'hashedpass', 'Test User', null, 'parent', true, true]
        );
        fail('중복 이메일로 사용자 생성이 성공해서는 안됩니다');
      } catch (error) {
        expect(error.message).toContain('duplicate key value');
      }
    });

    test('전화번호 고유성 제약 조건', async () => {
      const phone = '010-9999-9999';
      
      // 첫 번째 사용자 생성 성공
      const firstUser = await createTestUser({ phone });
      expect(firstUser.id).toBeTruthy();

      // 동일한 전화번호로 두 번째 사용자 생성 시도 (직접 쿼리)
      try {
        await global.testPool.query(
          'INSERT INTO users (email, password, name, phone, role, is_active, is_email_verified) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          ['different@test.com', 'hashedpass', 'Test User', phone, 'parent', true, true]
        );
        fail('중복 전화번호로 사용자 생성이 성공해서는 안됩니다');
      } catch (error) {
        expect(error.message).toContain('duplicate key value');
      }
    });

    test('필수 필드 NOT NULL 제약 조건', async () => {
      // 이메일 누락
      try {
        await global.testPool.query(
          'INSERT INTO users (email, password, name, role) VALUES ($1, $2, $3, $4)',
          [null, 'password', 'name', 'parent']
        );
        fail('이메일 없이 사용자 생성이 성공해서는 안됩니다');
      } catch (error) {
        expect(error.message).toContain('null value');
      }

      // 비밀번호 누락
      try {
        await global.testPool.query(
          'INSERT INTO users (email, password, name, role) VALUES ($1, $2, $3, $4)',
          ['test@test.com', null, 'name', 'parent']
        );
        fail('비밀번호 없이 사용자 생성이 성공해서는 안됩니다');
      } catch (error) {
        expect(error.message).toContain('null value');
      }

      // 이름 누락
      try {
        await global.testPool.query(
          'INSERT INTO users (email, password, name, role) VALUES ($1, $2, $3, $4)',
          ['test@test.com', 'password', null, 'parent']
        );
        fail('이름 없이 사용자 생성이 성공해서는 안됩니다');
      } catch (error) {
        expect(error.message).toContain('null value');
      }
    });

  });

  describe('인덱스 성능 테스트', () => {
    
    test('이메일 인덱스 성능', async () => {
      // 여러 사용자 생성
      const users = [];
      for (let i = 0; i < 100; i++) {
        users.push(await createTestUser({
          email: `performance${i}@test.com`
        }));
      }

      // 이메일로 검색 성능 측정
      const startTime = Date.now();
      const result = await global.testPool.query(
        'SELECT * FROM users WHERE email = $1',
        ['performance50@test.com']
      );
      const endTime = Date.now();

      expect(result.rows.length).toBe(1);
      expect(endTime - startTime).toBeLessThan(50); // 50ms 이내
    });

    test('역할별 인덱스 성능', async () => {
      // 다양한 역할의 사용자 생성
      const roles = ['parent', 'teacher', 'admin', 'guard'];
      for (let i = 0; i < 100; i++) {
        await createTestUser({
          email: `role${i}@test.com`,
          role: roles[i % roles.length]
        });
      }

      // 역할별 검색 성능 측정
      const startTime = Date.now();
      const result = await global.testPool.query(
        'SELECT * FROM users WHERE role = $1 LIMIT 10',
        ['parent']
      );
      const endTime = Date.now();

      expect(result.rows.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(50); // 50ms 이내
    });

  });

  describe('데이터 일관성 검증', () => {
    
    test('사용자 생성 후 카운트 검증', async () => {
      const initialCount = await dbHelpers.getUsersCount();
      
      await createTestUser();
      await createTestUser();
      await createTestUser();

      const finalCount = await dbHelpers.getUsersCount();
      expect(finalCount).toBe(initialCount + 3);
    });

    test('역할별 사용자 분포 검증', async () => {
      // 각 역할별로 사용자 생성
      await createTestUser({ role: 'parent' });
      await createTestUser({ role: 'parent' });
      await createTestUser({ role: 'teacher' });
      await createTestUser({ role: 'admin' });
      await createTestUser({ role: 'guard' });

      // 역할별 카운트 확인
      const parentCount = await global.testPool.query(
        'SELECT COUNT(*) FROM users WHERE role = $1', ['parent']
      );
      const teacherCount = await global.testPool.query(
        'SELECT COUNT(*) FROM users WHERE role = $1', ['teacher']
      );
      const adminCount = await global.testPool.query(
        'SELECT COUNT(*) FROM users WHERE role = $1', ['admin']
      );
      const guardCount = await global.testPool.query(
        'SELECT COUNT(*) FROM users WHERE role = $1', ['guard']
      );

      expect(parseInt(parentCount.rows[0].count)).toBeGreaterThanOrEqual(2);
      expect(parseInt(teacherCount.rows[0].count)).toBeGreaterThanOrEqual(1);
      expect(parseInt(adminCount.rows[0].count)).toBeGreaterThanOrEqual(1);
      expect(parseInt(guardCount.rows[0].count)).toBeGreaterThanOrEqual(1);
    });

  });

});
