/**
 * 🔐 인증 보안 유틸리티
 * 
 * @description 인증 관련 보안 헬퍼 함수들
 */

const crypto = require('crypto');
const { query } = require('./database');
const logger = require('./logger');

/**
 * 보안 토큰 생성 (이메일 인증, 비밀번호 재설정 등)
 * @param {number} length - 토큰 길이 (기본값: 32)
 * @returns {string} 랜덤 토큰
 */
const generateSecureToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * 이메일 인증 토큰 생성 및 저장
 * @param {string} userId - 사용자 ID
 * @returns {string} 이메일 인증 토큰
 */
const generateEmailVerificationToken = async (userId) => {
  const token = generateSecureToken();
  
  await query(
    'UPDATE users SET email_verification_token = $1 WHERE id = $2',
    [token, userId]
  );

  logger.info('이메일 인증 토큰 생성', { userId, tokenLength: token.length });
  
  return token;
};

/**
 * 비밀번호 재설정 토큰 생성 및 저장
 * @param {string} userId - 사용자 ID
 * @param {number} expiresInMinutes - 만료 시간 (분, 기본값: 60)
 * @returns {string} 비밀번호 재설정 토큰
 */
const generatePasswordResetToken = async (userId, expiresInMinutes = 60) => {
  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
  
  await query(
    'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3',
    [token, expiresAt, userId]
  );

  logger.info('비밀번호 재설정 토큰 생성', { 
    userId, 
    expiresAt: expiresAt.toISOString() 
  });
  
  return token;
};

/**
 * 이메일 인증 토큰 검증
 * @param {string} token - 검증할 토큰
 * @returns {Object|null} 사용자 정보 또는 null
 */
const verifyEmailVerificationToken = async (token) => {
  try {
    const result = await query(
      'SELECT id, email, name FROM users WHERE email_verification_token = $1 AND is_active = true',
      [token]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    
    // 토큰 사용 완료 처리
    await query(
      'UPDATE users SET email_verification_token = NULL, email_verified_at = NOW() WHERE id = $1',
      [user.id]
    );

    logger.info('이메일 인증 완료', { 
      userId: user.id, 
      email: user.email 
    });

    return user;
  } catch (error) {
    logger.error('이메일 인증 토큰 검증 실패', error);
    return null;
  }
};

/**
 * 비밀번호 재설정 토큰 검증
 * @param {string} token - 검증할 토큰
 * @returns {Object|null} 사용자 정보 또는 null
 */
const verifyPasswordResetToken = async (token) => {
  try {
    const result = await query(
      `SELECT id, email, name FROM users 
       WHERE password_reset_token = $1 
       AND password_reset_expires > NOW() 
       AND is_active = true`,
      [token]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    logger.error('비밀번호 재설정 토큰 검증 실패', error);
    return null;
  }
};

/**
 * 비밀번호 재설정 토큰 무효화
 * @param {string} userId - 사용자 ID
 */
const invalidatePasswordResetToken = async (userId) => {
  await query(
    'UPDATE users SET password_reset_token = NULL, password_reset_expires = NULL WHERE id = $1',
    [userId]
  );

  logger.info('비밀번호 재설정 토큰 무효화', { userId });
};

/**
 * 로그인 실패 처리
 * @param {string} email - 사용자 이메일
 * @param {string} ip - 클라이언트 IP
 * @returns {Object} { attempts, isLocked, lockUntil }
 */
const handleLoginFailure = async (email, ip = 'unknown') => {
  const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
  const lockDurationMinutes = parseInt(process.env.ACCOUNT_LOCK_DURATION_MINUTES) || 30;

  try {
    // 현재 시도 횟수 증가
    const result = await query(
      `UPDATE users 
       SET login_attempts = login_attempts + 1,
           updated_at = NOW()
       WHERE email = $1 
       RETURNING id, login_attempts, locked_until`,
      [email]
    );

    if (result.rows.length === 0) {
      return { attempts: 0, isLocked: false, lockUntil: null };
    }

    const user = result.rows[0];
    const attempts = user.login_attempts;

    // 최대 시도 횟수 초과시 계정 잠금
    if (attempts >= maxAttempts) {
      const lockUntil = new Date(Date.now() + lockDurationMinutes * 60 * 1000);
      
      await query(
        'UPDATE users SET locked_until = $1 WHERE id = $2',
        [lockUntil, user.id]
      );

      logger.warn('계정 잠금 처리', {
        userId: user.id,
        email,
        attempts,
        lockUntil: lockUntil.toISOString(),
        ip
      });

      return { 
        attempts, 
        isLocked: true, 
        lockUntil,
        lockDurationMinutes 
      };
    }

    logger.warn('로그인 실패', {
      email,
      attempts,
      remainingAttempts: maxAttempts - attempts,
      ip
    });

    return { 
      attempts, 
      isLocked: false, 
      lockUntil: null,
      remainingAttempts: maxAttempts - attempts
    };
  } catch (error) {
    logger.error('로그인 실패 처리 오류', error);
    return { attempts: 0, isLocked: false, lockUntil: null };
  }
};

/**
 * 로그인 성공 처리
 * @param {string} userId - 사용자 ID
 * @param {string} ip - 클라이언트 IP
 * @param {string} userAgent - 사용자 에이전트
 */
const handleLoginSuccess = async (userId, ip = 'unknown', userAgent = 'unknown') => {
  try {
    await query(
      `UPDATE users 
       SET login_attempts = 0, 
           locked_until = NULL, 
           last_login_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );

    logger.info('로그인 성공', {
      userId,
      ip,
      userAgent: userAgent.substring(0, 100) // 길이 제한
    });
  } catch (error) {
    logger.error('로그인 성공 처리 오류', error);
  }
};

/**
 * 사용자 계정 잠금 해제
 * @param {string} userId - 사용자 ID
 */
const unlockUserAccount = async (userId) => {
  try {
    await query(
      'UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = $1',
      [userId]
    );

    logger.info('계정 잠금 해제', { userId });
  } catch (error) {
    logger.error('계정 잠금 해제 실패', error);
    throw error;
  }
};

/**
 * 사용자 계정 상태 확인
 * @param {string} userId - 사용자 ID
 * @returns {Object} 계정 상태 정보
 */
const getUserAccountStatus = async (userId) => {
  try {
    const result = await query(
      `SELECT 
         is_active, 
         login_attempts, 
         locked_until,
         email_verified_at,
         last_login_at,
         created_at,
         CASE 
           WHEN locked_until > NOW() THEN 'locked'
           WHEN is_active = false THEN 'inactive'
           WHEN email_verified_at IS NULL THEN 'unverified'
           ELSE 'active'
         END as status
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    
    return {
      isActive: user.is_active,
      loginAttempts: user.login_attempts,
      lockedUntil: user.locked_until,
      emailVerifiedAt: user.email_verified_at,
      lastLoginAt: user.last_login_at,
      createdAt: user.created_at,
      status: user.status,
      isLocked: user.locked_until && new Date(user.locked_until) > new Date(),
      isEmailVerified: !!user.email_verified_at
    };
  } catch (error) {
    logger.error('계정 상태 확인 실패', error);
    return null;
  }
};

/**
 * IP 기반 브루트 포스 공격 ��지
 * @param {string} ip - 클라이언트 IP
 * @returns {boolean} 공격 여부
 */
const detectBruteForceAttack = (ip) => {
  // 메모리 기반 간단한 구현 (실제 환경에서는 Redis 사용 권장)
  const ipAttempts = global.ipAttempts || new Map();
  const maxAttemptsPerIP = parseInt(process.env.MAX_ATTEMPTS_PER_IP) || 20;
  const windowMinutes = parseInt(process.env.BRUTE_FORCE_WINDOW_MINUTES) || 15;
  
  const now = Date.now();
  const windowStart = now - (windowMinutes * 60 * 1000);
  
  // IP별 시도 기록 가져오기 또는 초기화
  let attempts = ipAttempts.get(ip) || [];
  
  // 윈도우 시간 외의 시도 기록 제거
  attempts = attempts.filter(timestamp => timestamp > windowStart);
  
  // 현재 시도 추가
  attempts.push(now);
  
  // 업데이트된 시도 기록 저장
  ipAttempts.set(ip, attempts);
  global.ipAttempts = ipAttempts;
  
  // 최대 시도 횟수 초과 확인
  if (attempts.length > maxAttemptsPerIP) {
    logger.warn('브루트 포스 공격 감지', {
      ip,
      attempts: attempts.length,
      windowMinutes
    });
    return true;
  }
  
  return false;
};

/**
 * 보안 헤더 생성
 * @param {string} tokenId - 토큰 ID
 * @returns {Object} 보안 관련 헤더
 */
const generateSecurityHeaders = (tokenId) => {
  return {
    'X-Token-ID': tokenId,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  };
};

module.exports = {
  generateSecureToken,
  generateEmailVerificationToken,
  generatePasswordResetToken,
  verifyEmailVerificationToken,
  verifyPasswordResetToken,
  invalidatePasswordResetToken,
  handleLoginFailure,
  handleLoginSuccess,
  unlockUserAccount,
  getUserAccountStatus,
  detectBruteForceAttack,
  generateSecurityHeaders
};
