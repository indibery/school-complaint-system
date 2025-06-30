const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

/**
 * 테스트용 사용자 생성 헬퍼
 */
async function createTestUser(userData = {}) {
  const defaultData = {
    email: `test-${uuidv4()}@test.com`,
    password: 'TestPassword123!',
    name: 'Test User',
    phone: `010-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
    role: 'parent',
    is_active: true,
    is_email_verified: true
  };

  const user = { ...defaultData, ...userData };
  
  // 데이터 정규화
  // 이메일 정규화 (+ 제거, 소문자 변환)
  user.email = user.email.toLowerCase();
  if (user.email.includes('+')) {
    const [local, domain] = user.email.split('@');
    const cleanLocal = local.split('+')[0];
    user.email = `${cleanLocal}@${domain}`;
  }
  
  // 전화번호 정규화 (한국 형식으로)
  if (user.phone) {
    user.phone = user.phone.replace(/[^\d]/g, ''); // 숫자만 추출
    if (user.phone.length === 11 && user.phone.startsWith('010')) {
      user.phone = user.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
    }
  }
  
  // 비밀번호 해싱
  const hashedPassword = await bcrypt.hash(user.password, 10);
  
  const result = await global.testPool.query(
    `INSERT INTO users (email, password, name, phone, role, is_active, is_email_verified, token_version) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [user.email, hashedPassword, user.name, user.phone, user.role, user.is_active, user.is_email_verified, user.token_version || 0]
  );

  // 원본 비밀번호도 함께 반환 (테스트용)
  return {
    ...result.rows[0],
    originalPassword: user.password
  };
}

/**
 * 테스트용 민원 생성 헬퍼
 */
async function createTestComplaint(complaintData = {}) {
  const defaultData = {
    user_id: 1,
    title: `테스트 민원 ${uuidv4().substring(0, 8)}`,
    description: '테스트용 민원 설명입니다.',
    category: 'meal',
    priority: 'medium',
    status: 'submitted',
    anonymous: false
  };

  const complaint = { ...defaultData, ...complaintData };
  
  const result = await global.testPool.query(
    `INSERT INTO complaints (user_id, title, description, category, priority, status, anonymous) 
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [complaint.user_id, complaint.title, complaint.description, complaint.category, complaint.priority, complaint.status, complaint.anonymous]
  );

  return result.rows[0];
}

/**
 * 여러 테스트 사용자 생성
 */
async function createMultipleTestUsers(count = 3) {
  const users = [];
  const roles = ['parent', 'teacher', 'admin'];
  
  for (let i = 0; i < count; i++) {
    const user = await createTestUser({
      email: `test-user-${i}@test.com`,
      name: `Test User ${i}`,
      role: roles[i % roles.length]
    });
    users.push(user);
  }
  
  return users;
}

/**
 * JWT 토큰 생성 헬퍼
 */
function generateTestTokens(userId, tokenVersion = 0) {
  const accessTokenPayload = {
    userId,
    email: 'test@example.com',
    role: 'parent',
    tokenType: 'access',
    tokenVersion,
    iat: Math.floor(Date.now() / 1000),
    jti: uuidv4()
  };
  
  const refreshTokenPayload = {
    userId,
    email: 'test@example.com',
    role: 'parent',
    tokenType: 'refresh',
    tokenVersion,
    iat: Math.floor(Date.now() / 1000),
    jti: uuidv4()
  };

  const accessToken = jwt.sign(
    accessTokenPayload,
    process.env.JWT_SECRET,
    { 
      expiresIn: '24h',
      algorithm: 'HS256',
      issuer: 'school-complaint-system',
      audience: 'school-system-users'
    }
  );

  const refreshToken = jwt.sign(
    refreshTokenPayload,
    process.env.JWT_REFRESH_SECRET,
    { 
      expiresIn: '7d',
      algorithm: 'HS256',
      issuer: 'school-complaint-system',
      audience: 'school-system-users'
    }
  );

  return {
    accessToken,
    refreshToken,
    accessTokenPayload,
    refreshTokenPayload
  };
}

/**
 * 인증 헤더 생성
 */
function createAuthHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

/**
 * 토큰 블랙리스트 추가
 */
async function addTokenToBlacklist(tokenJti, userId, tokenType = 'access') {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24hours
  
  await global.testPool.query(
    'INSERT INTO token_blacklist (token_jti, user_id, token_type, expires_at) VALUES ($1, $2, $3, $4)',
    [tokenJti, userId, tokenType, expiresAt]
  );
}

/**
 * 계정 잠금 설정
 */
async function lockUserAccount(userId, lockDuration = 30) { // 30분
  const lockedUntil = new Date(Date.now() + lockDuration * 60 * 1000);
  
  await global.testPool.query(
    'UPDATE users SET locked_until = $1, login_attempts = 5 WHERE id = $2',
    [lockedUntil, userId]
  );
}

/**
 * 이메일 인증 토큰 설정
 */
async function setEmailVerificationToken(userId) {
  const token = uuidv4();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24시간
  
  await global.testPool.query(
    'UPDATE users SET email_verification_token = $1, email_verification_expires = $2, is_email_verified = false WHERE id = $3',
    [token, expires, userId]
  );
  
  return token;
}

/**
 * 비밀번호 재설정 토큰 설정
 */
async function setPasswordResetToken(userId) {
  const token = uuidv4();
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1시간
  
  await global.testPool.query(
    'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3',
    [token, expires, userId]
  );
  
  return token;
}

/**
 * API 응답 검증 헬퍼
 */
const expectSuccess = (response, expectedStatus = 200) => {
  expect(response.status).toBe(expectedStatus);
  expect(response.body.success).toBe(true);
  return response.body;
};

const expectError = (response, expectedStatus = 400) => {
  expect(response.status).toBe(expectedStatus);
  expect(response.body.success).toBe(false);
  expect(response.body.message).toBeDefined();
  return response.body;
};

/**
 * 데이터베이스 헬퍼
 */
const dbHelpers = {
  async getUserById(id) {
    const result = await global.testPool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0];
  },

  async getUserByEmail(email) {
    const result = await global.testPool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0];
  },

  async getTokenFromBlacklist(jti) {
    const result = await global.testPool.query('SELECT * FROM token_blacklist WHERE token_id = $1', [jti]);
    return result.rows[0];
  },

  async getUsersCount() {
    const result = await global.testPool.query('SELECT COUNT(*) FROM users');
    return parseInt(result.rows[0].count);
  },

  async getComplaintById(id) {
    const result = await global.testPool.query('SELECT * FROM complaints WHERE id = $1', [id]);
    return result.rows[0];
  },

  async getComplaintsCount() {
    const result = await global.testPool.query('SELECT COUNT(*) FROM complaints');
    return parseInt(result.rows[0].count);
  },

  async cleanup() {
    // 테스트 후 정리 작업
    try {
      await global.testPool.query('DELETE FROM complaint_comments');
      await global.testPool.query('DELETE FROM complaint_attachments');
      await global.testPool.query('DELETE FROM complaint_history');
      await global.testPool.query('DELETE FROM complaints');
      await global.testPool.query('DELETE FROM token_blacklist');
      await global.testPool.query('DELETE FROM users WHERE email LIKE \'%test%\'');
      
      // 시퀀스 리셋
      await global.testPool.query('ALTER SEQUENCE users_id_seq RESTART WITH 1');
      await global.testPool.query('ALTER SEQUENCE complaints_id_seq RESTART WITH 1');
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
};

/**
 * 시간 헬퍼
 */
const timeHelpers = {
  addMinutes(minutes) {
    return new Date(Date.now() + minutes * 60 * 1000);
  },

  subtractMinutes(minutes) {
    return new Date(Date.now() - minutes * 60 * 1000);
  },

  addHours(hours) {
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  },

  subtractHours(hours) {
    return new Date(Date.now() - hours * 60 * 60 * 1000);
  }
};

module.exports = {
  createTestUser,
  createTestComplaint,
  createMultipleTestUsers,
  generateTestTokens,
  createAuthHeader,
  addTokenToBlacklist,
  lockUserAccount,
  setEmailVerificationToken,
  setPasswordResetToken,
  expectSuccess,
  expectError,
  dbHelpers,
  timeHelpers
};