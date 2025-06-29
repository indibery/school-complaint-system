/**
 * 🔐 인증 컨트롤러 (완전 통합판)
 * 
 * @description 사용자 인증 관련 모든 비즈니스 로직 통합
 */

const { asyncHandler, createError } = require('../middleware/errorHandler');
const { generateTokenPair, refreshAccessToken, TokenBlacklist, invalidateAllUserTokens } = require('../utils/jwt');
const { hashPassword, verifyPassword } = require('../utils/crypto');
const { query, transaction } = require('../utils/database');
const { sendEmail } = require('../utils/email');
const { 
  generateEmailVerificationToken,
  generatePasswordResetToken,
  verifyEmailVerificationToken,
  verifyPasswordResetToken,
  invalidatePasswordResetToken,
  handleLoginFailure,
  handleLoginSuccess,
  detectBruteForceAttack,
  generateSecurityHeaders,
  getUserAccountStatus,
  unlockUserAccount
} = require('../utils/authSecurity');
const logger = require('../utils/logger');

// 기존 회원가입 기능들과 새로운 로그인/로그아웃 기능들을 통합
const authControllerExtended = require('./authControllerExtended');

// =================================
// 🔑 로그인/로그아웃 관련 컨트롤러
// =================================

/**
 * @desc    로그인
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = asyncHandler(async (req, res) => {
  const { email, password, rememberMe = false } = req.body;
  const clientIp = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'unknown';

  // 브루트 포스 공격 감지
  if (detectBruteForceAttack(clientIp)) {
    throw createError.tooManyRequests('너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.');
  }

  // 사용자 조회
  const userResult = await query(
    `SELECT 
       id, email, password_hash, name, phone, role, is_active,
       login_attempts, locked_until, email_verified_at, last_login_at
     FROM users WHERE email = $1`,
    [email]
  );

  if (userResult.rows.length === 0) {
    // 로그인 실패 처리 (존재하지 않는 사용자)
    await handleLoginFailure(email, clientIp);
    throw createError.unauthorized('이메일 또는 비밀번호가 올바르지 않습니다.');
  }

  const user = userResult.rows[0];

  // 계정 상태 확인
  if (!user.is_active) {
    logger.warn('비활성화된 계정 로그인 시도:', {
      email: user.email,
      ip: clientIp
    });
    throw createError.forbidden('비활성화된 계정입니다. 관리자에게 문의하세요.');
  }

  // 계정 잠금 확인
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const lockTime = Math.ceil((new Date(user.locked_until) - new Date()) / 1000 / 60);
    logger.warn('잠긴 계정 로그인 시도:', {
      email: user.email,
      lockUntil: user.locked_until,
      ip: clientIp
    });
    throw createError.tooManyRequests(`계정이 잠겨있습니다. ${lockTime}분 후 다시 시도해주세요.`);
  }

  // 비밀번호 확인
  const isValidPassword = await verifyPassword(password, user.password_hash);
  if (!isValidPassword) {
    // 로그인 실패 처리
    const failureResult = await handleLoginFailure(email, clientIp);
    
    if (failureResult.isLocked) {
      throw createError.tooManyRequests(
        `로그인 시도가 너무 많습니다. 계정이 ${failureResult.lockDurationMinutes}분 동안 잠겼습니다.`
      );
    }

    const remainingAttempts = failureResult.remainingAttempts || 0;
    throw createError.unauthorized(
      `이메일 또는 비밀번호가 올바르지 않습니다. ${remainingAttempts}번의 기회가 남았습니다.`
    );
  }

  // 로그인 성공 처리
  await handleLoginSuccess(user.id, clientIp, userAgent);

  // JWT 토큰 생성
  const tokens = generateTokenPair(user);

  // 보안 헤더 생성
  const securityHeaders = generateSecurityHeaders(tokens.accessToken);
  
  // 응답 헤더 설정
  Object.entries(securityHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  logger.info('사용자 로그인 성공:', {
    userId: user.id,
    email: user.email,
    role: user.role,
    ip: clientIp,
    userAgent: userAgent.substring(0, 100),
    rememberMe
  });

  res.json({
    success: true,
    message: '로그인되었습니다.',
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        emailVerified: !!user.email_verified_at,
        lastLoginAt: user.last_login_at
      },
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenType: 'Bearer',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
      },
      session: {
        rememberMe,
        loginTime: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }
    },
    meta: {
      timestamp: new Date().toISOString(),
      ip: clientIp
    }
  });
});

/**
 * @desc    토큰 갱신
 * @route   POST /api/auth/refresh
 * @access  Public (Refresh Token 필요)
 */
const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken: token } = req.body;
  const clientIp = req.ip || req.connection.remoteAddress;

  if (!token) {
    throw createError.badRequest('리프레시 토큰이 필요합니다.');
  }

  // Authorization 헤더에서 기존 액세스 토큰 추출
  let oldAccessToken = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    oldAccessToken = authHeader.substring(7);
  }

  // 리프레시 토큰으로 새 액세스 토큰 생성
  const result = await refreshAccessToken(token, oldAccessToken);

  logger.info('토큰 갱신 성공:', {
    userId: result.user.id,
    email: result.user.email,
    ip: clientIp
  });

  res.json({
    success: true,
    message: '토큰이 갱신되었습니다.',
    data: {
      accessToken: result.accessToken,
      tokenType: 'Bearer',
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      user: result.user
    },
    meta: {
      timestamp: new Date().toISOString(),
      refreshedAt: new Date().toISOString()
    }
  });
});

/**
 * @desc    로그아웃
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = asyncHandler(async (req, res) => {
  const user = req.user;
  const token = req.headers.authorization?.split(' ')[1];
  const clientIp = req.ip || req.connection.remoteAddress;

  if (token) {
    // 현재 토큰을 블랙리스트에 추가
    await TokenBlacklist.addToBlacklist(token, 'logout');
  }

  logger.info('사용자 로그아웃:', {
    userId: user.id,
    email: user.email,
    ip: clientIp,
    tokenId: user.tokenId
  });

  res.json({
    success: true,
    message: '로그아웃되었습니다.',
    meta: {
      timestamp: new Date().toISOString(),
      logoutTime: new Date().toISOString()
    }
  });
});

/**
 * @desc    모든 디바이스에서 로그아웃
 * @route   POST /api/auth/logout-all
 * @access  Private
 */
const logoutAll = asyncHandler(async (req, res) => {
  const user = req.user;
  const clientIp = req.ip || req.connection.remoteAddress;

  // 사용자의 모든 토큰 무효화
  await invalidateAllUserTokens(user.id, 'logout_all_devices');

  logger.info('모든 디바이스에서 로그아웃:', {
    userId: user.id,
    email: user.email,
    ip: clientIp
  });

  res.json({
    success: true,
    message: '모든 디바이스에서 로그아웃되었습니다.',
    meta: {
      timestamp: new Date().toISOString(),
      logoutAllTime: new Date().toISOString()
    }
  });
});

/**
 * @desc    현재 사용자 정보 조회
 * @route   GET /api/auth/me
 * @access  Private
 */
const getCurrentUser = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // 상세한 사용자 정보 조회
  const userResult = await query(
    `SELECT 
       id, email, name, phone, role, is_active,
       email_verified_at, last_login_at, created_at, updated_at
     FROM users WHERE id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw createError.notFound('사용자를 찾을 수 없습니다.');
  }

  const user = userResult.rows[0];
  const accountStatus = await getUserAccountStatus(userId);

  res.json({
    success: true,
    message: '사용자 정보 조회 성공',
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isActive: user.is_active,
        emailVerified: !!user.email_verified_at,
        emailVerifiedAt: user.email_verified_at,
        lastLoginAt: user.last_login_at,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      },
      accountStatus: {
        status: accountStatus?.status || 'active',
        isLocked: accountStatus?.isLocked || false,
        isEmailVerified: accountStatus?.isEmailVerified || false,
        loginAttempts: accountStatus?.loginAttempts || 0
      }
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestedBy: req.user.email
    }
  });
});

/**
 * @desc    인증 상태 확인
 * @route   GET /api/auth/status
 * @access  Public
 */
const getAuthStatus = asyncHandler(async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  let isAuthenticated = false;
  let user = null;

  if (token) {
    try {
      // 토큰 간단 검증 (블랙리스트 확인 없이)
      const decoded = require('jsonwebtoken').decode(token);
      if (decoded && decoded.exp > Date.now() / 1000) {
        isAuthenticated = true;
        user = {
          id: decoded.userId,
          email: decoded.email,
          role: decoded.role
        };
      }
    } catch (error) {
      // 토큰이 유효하지 않음
    }
  }

  res.json({
    success: true,
    message: '인증 상태 확인 완료',
    data: {
      isAuthenticated,
      user,
      serverTime: new Date().toISOString(),
      tokenProvided: !!token
    }
  });
});

// 기존 authControllerExtended의 함수들을 가져옴
const {
  forgotPassword,
  resetPassword,
  changePassword,
  unlockAccount,
  getAuthStats
} = authControllerExtended;

// 기존 회원가입 관련 함수들 (간소화된 버전)
const register = asyncHandler(async (req, res) => {
  const { email, password, name, phone, role = 'parent' } = req.body;
  const clientIp = req.ip || req.connection.remoteAddress;

  if (detectBruteForceAttack(clientIp)) {
    throw createError.tooManyRequests('너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.');
  }

  const result = await transaction(async (client) => {
    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      throw createError.conflict('이미 등록된 이메일입니다.');
    }

    const hashedPassword = await hashPassword(password);
    const userResult = await client.query(`
      INSERT INTO users (email, password_hash, name, phone, role, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id, email, name, phone, role, is_active, created_at
    `, [email, hashedPassword, name, phone, role, true]);

    const user = userResult.rows[0];
    const verificationToken = await generateEmailVerificationToken(user.id);

    return { user, verificationToken };
  });

  const { user, verificationToken } = result;
  const tokens = generateTokenPair(user);

  sendEmail({
    to: email,
    template: 'welcome',
    data: {
      name: user.name,
      email: user.email,
      role: user.role,
      verificationToken,
      verificationLink: `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`,
      loginLink: `${process.env.FRONTEND_URL}/login`
    }
  }).catch(error => logger.error('환영 이메일 발송 실패:', error));

  res.status(201).json({
    success: true,
    message: '회원가입이 완료되었습니다.',
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        emailVerified: false
      },
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenType: 'Bearer'
      }
    }
  });
});

const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.body;
  const user = await verifyEmailVerificationToken(token);
  if (!user) {
    throw createError.badRequest('유효하지 않거나 만료된 인증 토큰입니다.');
  }
  res.json({
    success: true,
    message: '이메일 인증이 완료되었습니다.',
    data: { user: { id: user.id, email: user.email, name: user.name, emailVerified: true } }
  });
});

const resendVerification = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const verificationToken = await generateEmailVerificationToken(userId);
  
  await sendEmail({
    to: req.user.email,
    template: 'resend_verification',
    data: {
      name: req.user.name,
      verificationToken,
      verificationLink: `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`
    }
  });

  res.json({ success: true, message: '인증 이메일을 재발송했습니다.' });
});

const validateRegistration = asyncHandler(async (req, res) => {
  const { email, phone } = req.body;
  const issues = [];

  if (email) {
    const existingEmail = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingEmail.rows.length > 0) {
      issues.push({ field: 'email', message: '이미 등록된 이메일입니다.' });
    }
  }

  if (phone) {
    const existingPhone = await query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (existingPhone.rows.length > 0) {
      issues.push({ field: 'phone', message: '이미 등록된 전화번호입니다.' });
    }
  }

  res.json({
    success: true,
    message: '유효성 검증 완료',
    data: { isValid: issues.length === 0, issues }
  });
});

const updateAccountStatus = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { isActive, reason } = req.body;

  if (req.user.role !== 'admin') {
    throw createError.forbidden('관리자만 계정 상태를 변경할 수 있습니다.');
  }

  const result = await query(
    'UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING email, name',
    [isActive, userId]
  );

  if (result.rows.length === 0) {
    throw createError.notFound('사용자를 찾을 수 없습니다.');
  }

  if (!isActive) {
    await invalidateAllUserTokens(userId, 'account_deactivated');
  }

  res.json({
    success: true,
    message: `계정이 ${isActive ? '활성화' : '비활성화'}되었습니다.`,
    data: { userId, isActive, reason }
  });
});

module.exports = {
  // 회원가입 관련
  register,
  verifyEmail,
  resendVerification,
  validateRegistration,
  updateAccountStatus,
  
  // 로그인/로그아웃 관련
  login,
  logout,
  logoutAll,
  refreshToken,
  getCurrentUser,
  getAuthStatus,
  
  // 비밀번호 관리
  forgotPassword,
  resetPassword,
  changePassword,
  
  // 계정 관리 (관리자)
  unlockAccount,
  getAuthStats
};
