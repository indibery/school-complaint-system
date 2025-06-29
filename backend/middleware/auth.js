/**
 * 🔐 인증 미들웨어
 * 
 * @description JWT 기반 인증 및 권한 확인 미들웨어
 */

const jwt = require('jsonwebtoken');
const { createError } = require('./errorHandler');
const { query } = require('../utils/database');
const logger = require('../utils/logger');

/**
 * JWT 토큰 검증 미들웨어
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      throw createError.unauthorized('액세스 토큰이 필요합니다.');
    }

    // JWT 토큰 검증
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 사용자 정보 조회
    const userResult = await query(
      'SELECT id, email, name, role, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      throw createError.unauthorized('유효하지 않은 사용자입니다.');
    }

    const user = userResult.rows[0];

    // 비활성화된 사용자 확인
    if (!user.is_active) {
      throw createError.forbidden('비활성화된 계정입니다.');
    }

    // 요청 객체에 사용자 정보 추가
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    };

    logger.debug('사용자 인증 성공:', {
      userId: user.id,
      email: user.email,
      role: user.role
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
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const userResult = await query(
        'SELECT id, email, name, role, is_active FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (userResult.rows.length > 0 && userResult.rows[0].is_active) {
        req.user = {
          id: userResult.rows[0].id,
          email: userResult.rows[0].email,
          name: userResult.rows[0].name,
          role: userResult.rows[0].role
        };
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
        path: req.originalUrl
      });
      
      return next(createError.forbidden('접근 권한이 없습니다.'));
    }

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

  const userId = req.params.userId || req.params.id;
  const isOwner = req.user.id === userId;
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isAdmin) {
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
    return next(createError.unauthorized('유효하지 않은 API 키입니다.'));
  }

  next();
};

/**
 * 리프레시 토큰 검증
 */
const verifyRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw createError.unauthorized('리프레시 토큰이 필요합니다.');
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    // 사용자 정보 조회
    const userResult = await query(
      'SELECT id, email, name, role, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      throw createError.unauthorized('유효하지 않은 사용자입니다.');
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      throw createError.forbidden('비활성화된 계정입니다.');
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
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
 * JWT 토큰 생성
 */
const generateTokens = (user) => {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role
  };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  });

  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  });

  return { accessToken, refreshToken };
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
  generateTokens
};