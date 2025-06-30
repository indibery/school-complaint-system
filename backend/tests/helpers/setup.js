// 테스트 환경 변수 설정
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing-only';
process.env.EMAIL_HOST = 'smtp.test.com';
process.env.EMAIL_PORT = '587';
process.env.EMAIL_USER = 'test@test.com';
process.env.EMAIL_PASS = 'test-password';
process.env.FROM_EMAIL = 'test@school.com';

// 데이터베이스 모킹을 위한 설정
process.env.DB_HOST = 'mock-host';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'mock-test-db';
process.env.DB_USER = 'mock-user';
process.env.DB_PASSWORD = 'mock-password';

// 인메모리 테스트 데이터 저장소
global.testData = {
  users: new Map(),
  tokens: new Map(),
  nextUserId: 1,
  nextTokenId: 1
};

// 테스트용 데이터베이스 모킹
global.testPool = {
  async query(text, params) {
    // 간단한 SQL 파싱 및 실행 시뮬레이션
    return await mockDatabase(text, params);
  },
  async end() {
    // 연결 종료 시뮬레이션
    return true;
  }
};

// 모킹된 데이터베이스 함수
async function mockDatabase(sql, params = []) {
  const sqlLower = sql.toLowerCase().trim();
  
  // INSERT 문 처리
  if (sqlLower.startsWith('insert into users')) {
    const userId = global.testData.nextUserId++;
    const user = {
      id: userId,
      email: params[0],
      password: params[1],
      name: params[2],
      phone: params[3] || null,
      role: params[4] || 'parent',
      is_active: params[5] !== undefined ? params[5] : true,
      is_email_verified: params[6] !== undefined ? params[6] : false,
      email_verification_token: null,
      email_verification_expires: null,
      password_reset_token: null,
      password_reset_expires: null,
      last_login: null,
      login_attempts: 0,
      locked_until: null,
      token_version: 0,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    global.testData.users.set(userId, user);
    return { rows: [user] };
  }
  
  // SELECT 문 처리
  if (sqlLower.startsWith('select')) {
    if (sqlLower.includes('where email = $1')) {
      const email = params[0];
      for (const user of global.testData.users.values()) {
        if (user.email === email) {
          return { rows: [user] };
        }
      }
      return { rows: [] };
    }
    
    if (sqlLower.includes('where id = $1')) {
      const id = params[0];
      const user = global.testData.users.get(id);
      return { rows: user ? [user] : [] };
    }
    
    if (sqlLower.includes('count(*)')) {
      return { rows: [{ count: global.testData.users.size.toString() }] };
    }
    
    // 기본 SELECT (모든 사용자)
    return { rows: Array.from(global.testData.users.values()) };
  }
  
  // DELETE 문 처리
  if (sqlLower.startsWith('delete')) {
    if (sqlLower.includes('from users')) {
      global.testData.users.clear();
    }
    if (sqlLower.includes('from token_blacklist')) {
      global.testData.tokens.clear();
    }
    return { rows: [] };
  }
  
  // UPDATE 문 처리
  if (sqlLower.startsWith('update users')) {
    const userId = params[params.length - 1]; // 마지막 파라미터가 보통 WHERE 조건의 ID
    const user = global.testData.users.get(userId);
    if (user) {
      // 간단한 업데이트 시뮬레이션
      if (sqlLower.includes('email_verification_token')) {
        user.email_verification_token = params[0];
        user.email_verification_expires = params[1];
        if (params.length > 3) user.is_email_verified = params[2];
      }
      global.testData.users.set(userId, user);
    }
    return { rows: [] };
  }
  
  // ALTER SEQUENCE (자동 ID 초기화)
  if (sqlLower.includes('alter sequence')) {
    global.testData.nextUserId = 1;
    global.testData.nextTokenId = 1;
    return { rows: [] };
  }
  
  // 기타 CREATE, CREATE INDEX 등은 무시
  return { rows: [] };
}

// 테스트 전 설정
beforeAll(async () => {
  console.log('✅ Mock test database initialized');
});

// 각 테스트 전 설정
beforeEach(async () => {
  // 테스트 데이터 초기화
  await cleanupTestData();
});

// 각 테스트 후 정리
afterEach(async () => {
  // 테스트 데이터 정리
  await cleanupTestData();
  
  // IP 기반 브루트포스 추적 정리
  if (global.ipAttempts) {
    global.ipAttempts.clear();
  }
});

// 테스트 후 정리
afterAll(async () => {
  console.log('✅ Mock test database cleaned up');
});

// 테스트 데이터 정리 함수
async function cleanupTestData() {
  global.testData.users.clear();
  global.testData.tokens.clear();
  global.testData.nextUserId = 1;
  global.testData.nextTokenId = 1;
}

// 테스트 헬퍼 함수들을 전역으로 사용할 수 있도록 설정
global.cleanupTestData = cleanupTestData;

// dbHelpers 객체 생성 (호환성을 위해)
global.dbHelpers = {
  setup: async () => {
    console.log('✅ Mock database setup completed');
    return await cleanupTestData();
  },
  cleanup: async () => {
    console.log('✅ Mock database cleanup completed');
    return await cleanupTestData();
  }
};

// Jest timeout 설정
jest.setTimeout(30000);

// 확장된 모킹 시스템 로드
require('./mockExtensions');
