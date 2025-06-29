/**
 * 🔐 인증 미들웨어 (개선된 버전)
 * 
 * @description JWT 기반 인증 및 권한 확인 미들웨어
 */

const { createError } = require('./errorHandler');
const { query } = require('../utils/database');
const { 
  verifyToken, 
  TokenBlacklist, 
  generateTokenPair,
  refreshAccessToken 
} = require('../utils/jwt');
const logger = require('../utils/logger');

/**
 * JWT 토큰 검증 미들웨어 (개선된 버전)
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      throw createError.unauthorized('액세스 토큰이 필요합니다.');
    }

    // 토큰 블랙리스트 확인
    if (await TokenBlacklist.isBlacklisted(token)) {
      throw createError.unauthorized('무효화된 토큰입니다.');
    }

    // JWT 토큰 검증
    const decoded = verifyToken(token, 'access');
    
    // 사용자 정보 조회
    const userResult = await query(
      'SELECT id, email, name, role, is_active, token_version, locked_until FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      throw createError.unauthorized('유효하지 않은 사용자입니다.');
    }

    const user = userResult.rows[0];

    // 계정 상태 확인
    if (!user.is_active) {
      throw createError.forbidden('비활성화된 계정입니다.');
    }

    // 계정 잠금 확인
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw createError.forbidden('잠금된 계정입니다.');
    }

    // 토큰 버전 확인 (보안 강화)
    if (user.token_version && decoded.tokenVersion && 
        user.token_version !== decoded.tokenVersion) {
      throw createError.unauthorized('토큰이 무효화되었습니다. 다시 로그인해주세요.');
    }

    // 요청 객체에 사용자 정보 추가
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tokenId: decoded.jti
    };

    // 마지막 활동 시간 업데이트 (선택적)
    if (process.env.UPDATE_LAST_ACTIVITY === 'true') {
      await query(
        'UPDATE users SET last_login_at = NOW() WHERE id = $1',
        [user.id]
      );
    }

    logger.debug('사용자 인증 성공:', {
      userId: user.id,
      email: user.email,
      role: user.role,
      tokenId: decoded.jti
    });

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      next(createError.unauthorized('유효하지 않은 토큰입니다.'));
    } else if (error.name === 'TokenExpiredError') {
      next(createError.unauthorized('토큰이 만료되었습니다.'));
    } else {
      next(error);
    }
  }
};

/**
 * 선택적 토큰 검증 (토큰이 있으면 검증, 없어도 통과)
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      // 블랙리스트 확인
      if (!(await TokenBlacklist.isBlacklisted(token))) {
        const decoded = verifyToken(token, 'access');
        
        const userResult = await query(
          'SELECT id, email, name, role, is_active, locked_until FROM users WHERE id = $1',
          [decoded.userId]
        );

        if (userResult.rows.length > 0) {
          const user = userResult.rows[0];
          
          if (user.is_active && 
              (!user.locked_until || new Date(user.locked_until) <= new Date())) {
            req.user = {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              tokenId: decoded.jti
            };
          }
        }
      }
    }

    next();
  } catch (error) {
    // 선택적 인증에서는 토큰 오류를 무시하고 진행
    next();
  }
};

/**
 * 역할 기반 권한 확인 미들웨어
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(createError.unauthorized('인증이 필요합니다.'));
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      logger.warn('권한 부족:', {
        userId: req.user.id,
        userRole,
        requiredRoles: allowedRoles,
        path: req.originalUrl,
        method: req.method
      });
      
      return next(createError.forbidden('접근 권한이 없습니다.'));
    }

    logger.debug('권한 확인 통과:', {
      userId: req.user.id,
      userRole,
      requiredRoles: allowedRoles
    });

    next();
  };
};

/**
 * 관리자 권한 확인
 */
const requireAdmin = requireRole(['admin']);

/**
 * 교사 이상 권한 확인
 */
const requireTeacher = requireRole(['admin', 'teacher']);

/**
 * 교문 지킴이 권한 확인
 */
const requireSecurity = requireRole(['admin', 'security']);

/**
 * 본인 또는 관리자 권한 확인
 */
const requireOwnerOrAdmin = (req, res, next) => {
  if (!req.user) {
    return next(createError.unauthorized('인증이 필요합니다.'));
  }

  const targetUserId = req.params.userId || req.params.id || req.body.userId;
  const isOwner = req.user.id.toString() === targetUserId?.toString();
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isAdmin) {
    logger.warn('소유자/관리자 권한 부족:', {
      userId: req.user.id,
      targetUserId,
      userRole: req.user.role,
      path: req.originalUrl
    });
    
    return next(createError.forbidden('본인 또는 관리자만 접근할 수 있습니다.'));
  }

  next();
};

/**
 * API 키 검증 미들웨어 (내부 시스템용)
 */
const requireApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.API_KEY;

  if (!validApiKey) {
    return next(createError.internal('API 키가 설정되지 않았습니다.'));
  }

  if (!apiKey || apiKey !== validApiKey) {
    logger.warn('API 키 검증 실패:', {
      providedKey: apiKey?.substring(0, 10) + '...',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    return next(createError.unauthorized('유효하지 않은 API 키입니다.'));
  }

  next();
};

/**
 * 리프레시 토큰 검증 미들웨어
 */
const verifyRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw createError.unauthorized('리프레시 토큰이 필요합니다.');
    }

    // 토큰 블랙리스트 확인
    if (await TokenBlacklist.isBlacklisted(refreshToken)) {
      throw createError.unauthorized('무효화된 리프레시 토큰입니다.');
    }

    // 리프레시 토큰 검증
    const decoded = verifyToken(refreshToken, 'refresh');
    
    // 사용자 정보 조회
    const userResult = await query(
      'SELECT id, email, name, role, is_active, token_version, locked_until FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      throw createError.unauthorized('유효하지 않은 사용자입니다.');
    }

    const user = userResult.rows[0];

    // 계정 상태 확인
    if (!user.is_active) {
      throw createError.forbidden('비활성화된 계정입니다.');
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw createError.forbidden('잠금된 계정입니다.');
    }

    // 토큰 버전 확인
    if (user.token_version && decoded.tokenVersion && 
        user.token_version !== decoded.tokenVersion) {
      throw createError.unauthorized('토큰이 무���화되었습니다.');
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tokenId: decoded.jti
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      next(createError.unauthorized('유효하지 않은 리프레시 토큰입니다.'));
    } else {
      next(error);
    }
  }
};

/**
 * Rate limiting과 함께 사용하는 로그인 보호
 */
const loginProtection = async (req, res, next) => {
  const { email } = req.body;
  
  if (!email) {
    return next();
  }

  try {
    // 계정 잠금 확인
    const userResult = await query(
      'SELECT id, login_attempts, locked_until FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      
      // 계정이 잠겨있는지 확인
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        const lockTime = Math.ceil((new Date(user.locked_until) - new Date()) / 1000 / 60);
        return next(createError.tooManyRequests(`계정이 잠겨있습니다. ${lockTime}분 후 다시 시도해주세요.`));
      }
    }

    next();
  } catch (error) {
    logger.error('로그인 보호 미들웨어 오류:', error);
    next();
  }
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireRole,
  requireAdmin,
  requireTeacher,
  requireSecurity,
  requireOwnerOrAdmin,
  requireApiKey,
  verifyRefreshToken,
  loginProtection,
  generateTokenPair
};
