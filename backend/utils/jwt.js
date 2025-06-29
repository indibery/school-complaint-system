/**
 * 🔐 JWT 토큰 유틸리티
 * 
 * @description JWT 토큰 생성, 검증, 관리를 위한 전용 유틸리티
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('./database');
const logger = require('./logger');

/**
 * JWT 토큰 생성
 * @param {Object} user - 사용자 정보
 * @param {string} tokenType - 'access' | 'refresh'
 * @returns {string} JWT 토큰
 */
const generateToken = (user, tokenType = 'access') => {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    tokenType,
    iat: Math.floor(Date.now() / 1000),
    jti: crypto.randomUUID() // JWT ID for token tracking
  };

  const secret = tokenType === 'access' 
    ? process.env.JWT_SECRET 
    : process.env.JWT_REFRESH_SECRET;
    
  const expiresIn = tokenType === 'access'
    ? process.env.JWT_EXPIRES_IN || '24h'
    : process.env.JWT_REFRESH_EXPIRES_IN || '7d';

  if (!secret) {
    throw new Error(`JWT ${tokenType} secret이 설정되지 않았습니다.`);
  }

  return jwt.sign(payload, secret, { 
    expiresIn,
    algorithm: 'HS256',
    issuer: 'school-complaint-system',
    audience: 'school-system-users'
  });
};

/**
 * 액세스 토큰과 리프레시 토큰 쌍 생성
 * @param {Object} user - 사용자 정보
 * @returns {Object} { accessToken, refreshToken }
 */
const generateTokenPair = (user) => {
  const accessToken = generateToken(user, 'access');
  const refreshToken = generateToken(user, 'refresh');

  logger.info('토큰 쌍 생성 완료', {
    userId: user.id,
    email: user.email,
    role: user.role
  });

  return { accessToken, refreshToken };
};

/**
 * JWT 토큰 검증
 * @param {string} token - 검증할 토큰
 * @param {string} tokenType - 'access' | 'refresh'
 * @returns {Object} 디코딩된 페이로드
 */
const verifyToken = (token, tokenType = 'access') => {
  const secret = tokenType === 'access'
    ? process.env.JWT_SECRET
    : process.env.JWT_REFRESH_SECRET;

  if (!secret) {
    throw new Error(`JWT ${tokenType} secret이 설정되지 않았습니다.`);
  }

  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      issuer: 'school-complaint-system',
      audience: 'school-system-users'
    });

    // 토큰 타입 검증
    if (decoded.tokenType !== tokenType) {
      throw new Error('잘못된 토큰 타입입니다.');
    }

    return decoded;
  } catch (error) {
    logger.warn('토큰 검증 실패', {
      tokenType,
      error: error.message,
      token: token?.substring(0, 20) + '...'
    });
    throw error;
  }
};

/**
 * 토큰에서 사용자 ID 추출
 * @param {string} token - JWT 토큰
 * @returns {string} 사용자 ID
 */
const extractUserIdFromToken = (token) => {
  try {
    const decoded = jwt.decode(token);
    return decoded?.userId;
  } catch (error) {
    logger.error('토큰에서 사용자 ID 추출 실패', error);
    return null;
  }
};

/**
 * 토큰 만료 시간 확인
 * @param {string} token - JWT 토큰
 * @returns {Date|null} 만료 시간
 */
const getTokenExpiration = (token) => {
  try {
    const decoded = jwt.decode(token);
    return decoded?.exp ? new Date(decoded.exp * 1000) : null;
  } catch (error) {
    logger.error('토큰 만료 시간 확인 실패', error);
    return null;
  }
};

/**
 * 토큰 블랙리스트 관리 (Redis 없이 DB 사용)
 */
class TokenBlacklist {
  /**
   * 토큰을 블랙리스트에 추가
   * @param {string} token - 블랙리스트에 추가할 토큰
   * @param {string} reason - 블랙리스트 추가 사유
   */
  static async addToBlacklist(token, reason = 'logout') {
    try {
      const decoded = jwt.decode(token);
      if (!decoded) return;

      const expiresAt = new Date(decoded.exp * 1000);
      const jti = decoded.jti;

      await query(`
        INSERT INTO token_blacklist (token_id, user_id, reason, expires_at, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (token_id) DO NOTHING
      `, [jti, decoded.userId, reason, expiresAt]);

      logger.info('토큰 블랙리스트 추가', {
        userId: decoded.userId,
        tokenId: jti,
        reason,
        expiresAt
      });
    } catch (error) {
      logger.error('토큰 블랙리스트 추가 실패', error);
    }
  }

  /**
   * 토큰이 블랙리스트에 있는지 확인
   * @param {string} token - 확인할 토큰
   * @returns {boolean} 블랙리스트 포함 여부
   */
  static async isBlacklisted(token) {
    try {
      const decoded = jwt.decode(token);
      if (!decoded?.jti) return false;

      const result = await query(
        'SELECT 1 FROM token_blacklist WHERE token_id = $1 AND expires_at > NOW()',
        [decoded.jti]
      );

      return result.rows.length > 0;
    } catch (error) {
      logger.error('토큰 블랙리스트 확인 실패', error);
      return false;
    }
  }

  /**
   * 만료된 블랙리스트 토큰 정리
   */
  static async cleanupExpiredTokens() {
    try {
      const result = await query(
        'DELETE FROM token_blacklist WHERE expires_at <= NOW()'
      );
      
      if (result.rowCount > 0) {
        logger.info('만료된 블랙리스트 토큰 정리 완료', {
          deletedCount: result.rowCount
        });
      }
    } catch (error) {
      logger.error('블랙리스트 토큰 정리 실패', error);
    }
  }
}

/**
 * 사용자의 모든 토큰 무효화 (비밀번호 변경, 계정 잠금 등)
 * @param {string} userId - 사용자 ID
 * @param {string} reason - 무효화 사유
 */
const invalidateAllUserTokens = async (userId, reason = 'security') => {
  try {
    // 사용자의 token_version 업데이트
    await query(
      'UPDATE users SET token_version = token_version + 1, updated_at = NOW() WHERE id = $1',
      [userId]
    );

    logger.info('사용자 모든 토큰 무효화', {
      userId,
      reason
    });
  } catch (error) {
    logger.error('사용자 토큰 무효화 실패', error);
    throw error;
  }
};

/**
 * 리프레시 토큰으로 새로운 액세스 토큰 생성
 * @param {string} refreshToken - 리프레시 토큰
 * @returns {Object} { accessToken, user }
 */
const refreshAccessToken = async (refreshToken) => {
  try {
    // 리프레시 토큰 검증
    const decoded = verifyToken(refreshToken, 'refresh');
    
    // 블랙리스트 확인
    if (await TokenBlacklist.isBlacklisted(refreshToken)) {
      throw new Error('무효화된 토큰입니다.');
    }

    // 사용자 정보 조회
    const userResult = await query(
      'SELECT id, email, name, role, is_active, token_version FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      throw new Error('비활성화된 계정입니다.');
    }

    // 토큰 버전 확인 (선택적 보안 강화)
    if (user.token_version && decoded.tokenVersion && 
        user.token_version !== decoded.tokenVersion) {
      throw new Error('토큰이 무효화되었습니다.');
    }

    // 새로운 액세스 토큰 생성
    const accessToken = generateToken(user, 'access');

    logger.info('액세스 토큰 갱신 성공', {
      userId: user.id,
      email: user.email
    });

    return { 
      accessToken, 
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    };
  } catch (error) {
    logger.warn('액세스 토큰 갱신 실패', {
      error: error.message
    });
    throw error;
  }
};

/**
 * 토큰 정보 디코딩 (검증 없이)
 * @param {string} token - 디코딩��� 토큰
 * @returns {Object|null} 디코딩된 정보
 */
const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    logger.error('토큰 디코딩 실패', error);
    return null;
  }
};

module.exports = {
  generateToken,
  generateTokenPair,
  verifyToken,
  extractUserIdFromToken,
  getTokenExpiration,
  TokenBlacklist,
  invalidateAllUserTokens,
  refreshAccessToken,
  decodeToken
};
