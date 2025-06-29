/**
 * 🛡️ 에러 처리 미들웨어
 * 
 * @description Express 애플리케이션의 에러 처리 및 404 핸들러
 */

const logger = require('../utils/logger');

/**
 * 404 Not Found 핸들러
 */
const notFoundHandler = (req, res, next) => {
  const error = {
    status: 404,
    message: `요청하신 경로 '${req.originalUrl}'를 찾을 수 없습니다.`,
    code: 'NOT_FOUND',
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    ip: req.ip
  };

  logger.warn('404 Not Found:', error);
  res.status(404).json(error);
};

/**
 * 글로벌 에러 핸들러
 */
const errorHandler = (err, req, res, next) => {
  // 기본 에러 상태 코드
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || '서버 내부 오류가 발생했습니다.';
  let code = err.code || 'INTERNAL_SERVER_ERROR';

  // 에러 타입별 처리
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = '입력 데이터가 유효하지 않습니다.';
    code = 'VALIDATION_ERROR';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = '유효하지 않은 토큰입니다.';
    code = 'INVALID_TOKEN';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = '토큰이 만료되었습니다.';
    code = 'TOKEN_EXPIRED';
  } else if (err.code === '23505') { // PostgreSQL unique constraint
    statusCode = 409;
    message = '이미 존재하는 데이터입니다.';
    code = 'DUPLICATE_ENTRY';
  } else if (err.code === '23503') { // PostgreSQL foreign key constraint
    statusCode = 400;
    message = '참조 무결성 제약 조건 위반입니다.';
    code = 'FOREIGN_KEY_VIOLATION';
  } else if (err.code === '23502') { // PostgreSQL not null constraint
    statusCode = 400;
    message = '필수 입력 필드가 누락되었습니다.';
    code = 'MISSING_REQUIRED_FIELD';
  }

  // 에러 로그 기록
  const errorInfo = {
    status: statusCode,
    message,
    code,
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id || null,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  };

  // 로그 레벨 결정
  if (statusCode >= 500) {
    logger.error('Server Error:', errorInfo);
  } else if (statusCode >= 400) {
    logger.warn('Client Error:', errorInfo);
  }

  // 개발 환경에서는 더 자세한 정보 제공
  const response = {
    status: statusCode,
    message,
    code,
    timestamp: errorInfo.timestamp
  };

  if (process.env.NODE_ENV === 'development') {
    response.details = {
      originalError: err.message,
      stack: err.stack,
      path: req.originalUrl,
      method: req.method
    };
  }

  res.status(statusCode).json(response);
};

/**
 * 비동기 함수 에러 캐치 래퍼
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 커스텀 에러 클래스
 */
class CustomError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'CustomError';
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 일반적인 에러 생성 함수들
 */
const createError = {
  badRequest: (message = '잘못된 요청입니다.', code = 'BAD_REQUEST') => {
    return new CustomError(message, 400, code);
  },
  
  unauthorized: (message = '인증이 필요합니다.', code = 'UNAUTHORIZED') => {
    return new CustomError(message, 401, code);
  },
  
  forbidden: (message = '접근 권한이 없습니다.', code = 'FORBIDDEN') => {
    return new CustomError(message, 403, code);
  },
  
  notFound: (message = '요청한 리소스를 찾을 수 없습니다.', code = 'NOT_FOUND') => {
    return new CustomError(message, 404, code);
  },
  
  conflict: (message = '리소스 충돌이 발생했습니다.', code = 'CONFLICT') => {
    return new CustomError(message, 409, code);
  },
  
  tooManyRequests: (message = '너무 많은 요청입니다.', code = 'TOO_MANY_REQUESTS') => {
    return new CustomError(message, 429, code);
  },
  
  internal: (message = '서버 내부 오류입니다.', code = 'INTERNAL_SERVER_ERROR') => {
    return new CustomError(message, 500, code);
  }
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  CustomError,
  createError
};