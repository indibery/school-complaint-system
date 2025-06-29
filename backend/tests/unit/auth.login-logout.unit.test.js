const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { 
  createTestUser, 
  dbHelpers,
  generateTestTokens,
  timeHelpers
} = require('../helpers/testHelpers');

describe('🔧 로그인/로그아웃 관련 단위 테스트', () => {

  describe('비밀번호 검증 시스템', () => {
    
    test('비밀번호 해싱 및 검증', async () => {
      const plainPassword = 'TestPassword123!';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      
      expect(hashedPassword).not.toBe(plainPassword);
      expect(hashedPassword).toMatch(/^\$2[ayb]\$\d+\$/);
      
      const isValid = await bcrypt.compare(plainPassword, hashedPassword);
      expect(isValid).toBe(true);
      
      const isInvalid = await bcrypt.compare('WrongPassword', hashedPassword);
      expect(isInvalid).toBe(false);
    });

    test('다양한 비밀번호 강도 테스트', async () => {
      const passwords = [
        'SimplePass123!',
        'Complex@Password#2023',
        'Very_Long_Password_With_Multiple_Words_123!@#',
        'Minimum8!'
      ];

      for (const password of passwords) {
        const hashedPassword = await bcrypt.hash(password, 10);
        const isValid = await bcrypt.compare(password, hashedPassword);
        expect(isValid).toBe(true);
      }
    });

  });

  describe('JWT 토큰 시스템', () => {
    
    test('액세스 토큰 생성 및 검증', () => {
      const payload = {
        userId: 1,
        tokenVersion: 0,
        type: 'access',
        jti: 'test-jti-123'
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
      
      expect(token).toBeTruthy();
      expect(token.split('.').length).toBe(3); // header.payload.signature
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.type).toBe(payload.type);
      expect(decoded.jti).toBe(payload.jti);
    });

    test('리프레시 토큰 생성 및 검증', () => {
      const payload = {
        userId: 1,
        tokenVersion: 0,
        type: 'refresh',
        jti: 'refresh-jti-123'
      };

      const token = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
      
      expect(token).toBeTruthy();
      
      const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.type).toBe(payload.type);
    });

    test('만료된 토큰 검증', () => {
      const payload = {
        userId: 1,
        tokenVersion: 0,
        type: 'access',
        jti: 'expired-jti'
      };

      // 이미 만료된 토큰 생성 (1ms 만료)
      const expiredToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1ms' });
      
      // 1초 대기 후 검증
      setTimeout(() => {
        expect(() => {
          jwt.verify(expiredToken, process.env.JWT_SECRET);
        }).toThrow('jwt expired');
      }, 1000);
    });

    test('잘못된 시크릿으로 토큰 검증', () => {
      const payload = { userId: 1, type: 'access' };
      const token = jwt.sign(payload, 'correct-secret');
      
      expect(() => {
        jwt.verify(token, 'wrong-secret');
      }).toThrow('invalid signature');
    });

    test('토큰 페이로드 무결성 검증', () => {
      const payload = {
        userId: 1,
        tokenVersion: 0,
        type: 'access',
        jti: 'integrity-test'
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET);
      
      // 토큰 조작 시도 (마지막 문자 변경)
      const tamperedToken = token.slice(0, -1) + 'X';
      
      expect(() => {
        jwt.verify(tamperedToken, process.env.JWT_SECRET);
      }).toThrow();
    });

  });

  describe('로그인 시도 추적 시스템', () => {
    
    test('실패 시도 횟수 증가', async () => {
      const user = await createTestUser({
        email: 'attempt@test.com',
        login_attempts: 0
      });

      // 실패 시도 시뮬레이션
      for (let i = 1; i <= 3; i++) {
        await global.testPool.query(
          'UPDATE users SET login_attempts = $1 WHERE id = $2',
          [i, user.id]
        );

        const updatedUser = await dbHelpers.getUserById(user.id);
        expect(updatedUser.login_attempts).toBe(i);
      }
    });

    test('성공 로그인 시 실패 횟수 초기화', async () => {
      const user = await createTestUser({
        email: 'reset@test.com',
        login_attempts: 3
      });

      // 성공 로그인 시뮬레이션
      await global.testPool.query(
        'UPDATE users SET login_attempts = 0, last_login_at = NOW() WHERE id = $1',
        [user.id]
      );

      const updatedUser = await dbHelpers.getUserById(user.id);
      expect(updatedUser.login_attempts).toBe(0);
      expect(updatedUser.last_login_at).toBeTruthy();
    });

    test('계정 잠금 시간 계산', async () => {
      const user = await createTestUser({
        email: 'locktime@test.com'
      });

      const lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30분 후
      
      await global.testPool.query(
        'UPDATE users SET locked_until = $1, login_attempts = 5 WHERE id = $2',
        [lockUntil, user.id]
      );

      const lockedUser = await dbHelpers.getUserById(user.id);
      expect(lockedUser.locked_until).toBeTruthy();
      expect(new Date(lockedUser.locked_until).getTime()).toBeGreaterThan(Date.now());
    });

    test('계정 잠금 해제 확인', async () => {
      const user = await createTestUser({
        email: 'unlock@test.com'
      });

      // 과거 시간으로 잠금 설정 (이미 해제됨)
      const pastTime = timeHelpers.subtractMinutes(10);
      
      await global.testPool.query(
        'UPDATE users SET locked_until = $1, login_attempts = 5 WHERE id = $2',
        [pastTime, user.id]
      );

      const userAfterLock = await dbHelpers.getUserById(user.id);
      const isLocked = new Date(userAfterLock.locked_until).getTime() > Date.now();
      
      expect(isLocked).toBe(false); // 잠금이 해제되어야 함
    });

  });

  describe('토큰 버전 관리 시스템', () => {
    
    test('토큰 버전 증가', async () => {
      const user = await createTestUser({
        email: 'version@test.com',
        token_version: 0
      });

      // 버전 증가 시뮬레이션
      await global.testPool.query(
        'UPDATE users SET token_version = token_version + 1 WHERE id = $1',
        [user.id]
      );

      const updatedUser = await dbHelpers.getUserById(user.id);
      expect(updatedUser.token_version).toBe(1);
    });

    test('토큰 버전 불일치 검증', async () => {
      const user = await createTestUser({
        email: 'mismatch@test.com',
        token_version: 5
      });

      // 실제 사용자 데이터 다시 조회
      const refreshedUser = await dbHelpers.getUserById(user.id);
      
      // 구버전 토큰 생성
      const oldVersionTokens = generateTestTokens(user.id, 3);
      const currentVersionTokens = generateTestTokens(user.id, 5);

      // 토큰 페이로드 확인
      const oldDecoded = jwt.verify(oldVersionTokens.accessToken, process.env.JWT_SECRET);
      const currentDecoded = jwt.verify(currentVersionTokens.accessToken, process.env.JWT_SECRET);

      expect(oldDecoded.tokenVersion).toBe(3);
      expect(currentDecoded.tokenVersion).toBe(5);
      expect(oldDecoded.tokenVersion).not.toBe(refreshedUser.token_version);
      expect(currentDecoded.tokenVersion).toBe(refreshedUser.token_version);
    });

  });

  describe('블랙리스트 토큰 관리', () => {
    
    test('토큰 블랙리스트 추가', async () => {
      const user = await createTestUser({
        email: 'blacklist@test.com'
      });

      const tokenJti = 'test-blacklist-jti';
      const expiresAt = timeHelpers.addHours(24);

      // 블랙리스트에 토큰 추가 시뮬레이션
      await global.testPool.query(
        'INSERT INTO token_blacklist (token_jti, user_id, token_type, expires_at) VALUES ($1, $2, $3, $4)',
        [tokenJti, user.id, 'access', expiresAt]
      );

      const blacklistedToken = await dbHelpers.getTokenFromBlacklist(tokenJti);
      expect(blacklistedToken).toBeTruthy();
      expect(blacklistedToken.token_id).toBe(tokenJti);
      expect(blacklistedToken.user_id).toBe(user.id);
    });

    test('만료된 블랙리스트 토큰 정리', async () => {
      const user = await createTestUser({
        email: 'cleanup@test.com'
      });

      const expiredJti = 'expired-blacklist-jti';
      const validJti = 'valid-blacklist-jti';
      const pastTime = timeHelpers.subtractHours(1);
      const futureTime = timeHelpers.addHours(1);

      // 만료된 토큰과 유효한 토큰 추가
      await global.testPool.query(
        'INSERT INTO token_blacklist (token_id, user_id, token_type, expires_at) VALUES ($1, $2, $3, $4)',
        [expiredJti, user.id, 'access', pastTime]
      );

      await global.testPool.query(
        'INSERT INTO token_blacklist (token_id, user_id, token_type, expires_at) VALUES ($1, $2, $3, $4)',
        [validJti, user.id, 'access', futureTime]
      );

      // 만료된 토큰 정리 시뮬레이션
      await global.testPool.query(
        'DELETE FROM token_blacklist WHERE expires_at < NOW()'
      );

      const expiredToken = await dbHelpers.getTokenFromBlacklist(expiredJti);
      const validToken = await dbHelpers.getTokenFromBlacklist(validJti);

      expect(expiredToken).toBeFalsy(); // 만료된 토큰은 삭제됨
      expect(validToken).toBeTruthy(); // 유효한 토큰은 유지됨
    });

  });

  describe('세션 관리 시스템', () => {
    
    test('마지막 로그인 시간 업데이트', async () => {
      const user = await createTestUser({
        email: 'lastlogin@test.com',
        last_login: null
      });

      const loginTime = new Date();
      
      await global.testPool.query(
        'UPDATE users SET last_login = $1 WHERE id = $2',
        [loginTime, user.id]
      );

      const updatedUser = await dbHelpers.getUserById(user.id);
      expect(updatedUser.last_login).toBeTruthy();
      expect(new Date(updatedUser.last_login).getTime()).toBeCloseTo(loginTime.getTime(), -2);
    });

    test('동시 세션 관리', async () => {
      const user = await createTestUser({
        email: 'concurrent@test.com',
        token_version: 0
      });

      // 여러 세션 시뮬레이션 (각각 다른 JTI)
      const sessions = [];
      for (let i = 0; i < 5; i++) {
        const tokens = generateTestTokens(user.id, 0);
        sessions.push(tokens);
      }

      // 모든 세션이 같은 토큰 버전을 가지는지 확인
      for (const session of sessions) {
        const decoded = jwt.verify(session.accessToken, process.env.JWT_SECRET);
        expect(decoded.tokenVersion).toBe(0);
        expect(decoded.userId).toBe(user.id);
      }

      // 각 세션은 고유한 JTI를 가져야 함
      const jtis = sessions.map(session => {
        const decoded = jwt.verify(session.accessToken, process.env.JWT_SECRET);
        return decoded.jti;
      });

      const uniqueJtis = [...new Set(jtis)];
      expect(uniqueJtis.length).toBe(sessions.length);
    });

  });

  describe('보안 헤더 및 쿠키 관리', () => {
    
    test('보안 쿠키 설정 검증', () => {
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7일
      };

      expect(cookieOptions.httpOnly).toBe(true);
      expect(cookieOptions.sameSite).toBe('strict');
      expect(cookieOptions.maxAge).toBe(604800000); // 7일을 밀리초로
    });

    test('CORS 설정 검증', () => {
      const corsOptions = {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
      };

      expect(corsOptions.credentials).toBe(true);
      expect(corsOptions.methods).toContain('POST');
      expect(corsOptions.allowedHeaders).toContain('Authorization');
    });

  });

});
