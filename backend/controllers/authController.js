/**
 * 🔐 인증 컨트롤러 (로그인/로그아웃 포함 완전판)
 * 
 * @description 사용자 인증 관련 비즈니스 로직
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
  getUserAccountStatus
} = require('../utils/authSecurity');
const logger = require('../utils/logger');

// =================================
// 📝 회원가입 관련 컨트롤러
// =================================

/**
 * @desc    회원가입
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = asyncHandler(async (req, res) => {
  const { email, password, name, phone, role = 'parent' } = req.body;
  const clientIp = req.ip || req.connection.remoteAddress;

  // 브루트 포스 공격 감지
  if (detectBruteForceAttack(clientIp)) {
    throw createError.tooManyRequests('너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.');
  }

  // 트랜잭션으로 회원가입 처리
  const result = await transaction(async (client) => {
    // 이메일 중복 확인
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      throw createError.conflict('이미 등록된 이메일입니다.');
    }

    // 전화번호 중복 확인 (선택사항)
    if (phone) {
      const existingPhone = await client.query(
        'SELECT id FROM users WHERE phone = $1',
        [phone]
      );

      if (existingPhone.rows.length > 0) {
        throw createError.conflict('이미 등록된 전화번호입니다.');
      }
    }

    // 비밀번호 해싱
    const hashedPassword = await hashPassword(password);
    
    // 사용자 생성
    const userResult = await client.query(`
      INSERT INTO users (email, password_hash, name, phone, role, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id, email, name, phone, role, is_active, created_at
    `, [email, hashedPassword, name, phone, role, true]);

    const user = userResult.rows[0];

    // 이메일 인증 토큰 생성
    const verificationToken = await generateEmailVerificationToken(user.id);

    logger.info('새 사용자 등록 완료:', {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      ip: clientIp
    });

    return { user, verificationToken };
  });

  const { user, verificationToken } = result;

  // JWT 토큰 생성
  const tokens = generateTokenPair(user);

  // 환영 이메일 발송 (비동기)
  sendEmail({
    to: email,
    subject: '🏫 학교 민원시스템 가입을 환영합니다!',
    template: 'welcome',
    data: {
      name: user.name,
      email: user.email,
      role: user.role,
      verificationToken,
      verificationLink: `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`,
      loginLink: `${process.env.FRONTEND_URL}/login`
    }
  }).catch(error => {
    logger.error('환영 이메일 발송 실패:', {
      userId: user.id,
      email: user.email,
      error: error.message
    });
  });

  // 보안 헤더 생성
  const securityHeaders = generateSecurityHeaders(tokens.accessToken);
  
  // 응답 헤더 설정
  Object.entries(securityHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  res.status(201).json({
    success: true,
    message: '회원가입이 완료되었습니다. 이메일 인증을 확인해주세요.',
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isActive: user.is_active,
        createdAt: user.created_at,
        emailVerified: false
      },
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenType: 'Bearer',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
      }
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }
  });
});

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

  // JWT 토큰 생성 (rememberMe에 따라 만료시간 조정)
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

  // 리프레시 토큰으로 새 액세스 토큰 생성
  const result = await refreshAccessToken(token);

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

// =================================
// 📧 이메일 인증 관련 컨트롤러 (기존)
// =================================

/**
 * @desc    이메일 인증
 * @route   POST /api/auth/verify-email
 * @access  Public
 */
const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token) {
    throw createError.badRequest('인증 토큰이 필요합니다.');
  }

  // 이메일 인증 토큰 검증
  const user = await verifyEmailVerificationToken(token);

  if (!user) {
    throw createError.badRequest('유효하지 않거나 만료된 인증 토큰입니다.');
  }

  logger.info('이메일 인증 완료:', {
    userId: user.id,
    email: user.email
  });

  // 인증 완료 알림 이메일 발송 (선택사항)
  sendEmail({
    to: user.email,
    subject: '✅ 이메일 인증이 완료되었습니다',
    template: 'email_verified',
    data: {
      name: user.name,
      loginLink: `${process.env.FRONTEND_URL}/login`
    }
  }).catch(error => {
    logger.error('인증 완료 이메일 발송 실패:', error);
  });

  res.json({
    success: true,
    message: '이메일 인증이 완료되었습니다.',
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: true
      }
    }
  });
});

/**
 * @desc    인증 이메일 재발송
 * @route   POST /api/auth/resend-verification
 * @access  Private
 */
const resendVerification = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const userEmail = req.user.email;
  const userName = req.user.name;

  // 이미 인증된 사용자 확인
  const userCheck = await query(
    'SELECT email_verified_at FROM users WHERE id = $1',
    [userId]
  );

  if (userCheck.rows[0]?.email_verified_at) {
    throw createError.badRequest('이미 인증된 이메일입니다.');
  }

  // 새로운 인증 토큰 생성
  const verificationToken = await generateEmailVerificationToken(userId);

  // 인증 이메일 재발송
  await sendEmail({
    to: userEmail,
    subject: '📧 이메일 인증 재발송',
    template: 'resend_verification',
    data: {
      name: userName,
      verificationToken,
      verificationLink: `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`
    }
  });

  logger.info('인증 이메일 재발송:', {
    userId,
    email: userEmail
  });

  res.json({
    success: true,
    message: '인증 이메일을 재발송했습니다.'
  });
});

/**
 * @desc    회원가입 유효성 사전 검증
 * @route   POST /api/auth/validate-registration
 * @access  Public
 */
const validateRegistration = asyncHandler(async (req, res) => {
  const { email, phone } = req.body;
  const issues = [];

  // 이메일 중복 확인
  if (email) {
    const existingEmail = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    
    if (existingEmail.rows.length > 0) {
      issues.push({
        field: 'email',
        message: '이미 등록된 이메일입니다.'
      });
    }
  }

  // 전화번호 중복 확인
  if (phone) {
    const existingPhone = await query(
      'SELECT id FROM users WHERE phone = $1',
      [phone]
    );
    
    if (existingPhone.rows.length > 0) {
      issues.push({
        field: 'phone',
        message: '이미 등록된 전화번호입니다.'
      });
    }
  }

  res.json({
    success: true,
    message: '유효성 검증 완료',
    data: {
      isValid: issues.length === 0,
      issues
    }
  });
});

/**
 * @desc    사용자 계정 활성화/비활성화
 * @route   PUT /api/auth/account/:userId/status
 * @access  Private (Admin only)
 */
const updateAccountStatus = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { isActive, reason } = req.body;

  // 관리자 권한 확인 (미들웨어에서 처리되지만 추가 확인)
  if (req.user.role !== 'admin') {
    throw createError.forbidden('관리자만 계정 상태를 변경할 수 있습니다.');
  }

  // 자기 자신의 계정은 비활성화할 수 없음
  if (req.user.id.toString() === userId.toString()) {
    throw createError.badRequest('자기 자신의 계정은 비활성화할 수 없습니다.');
  }

  // 계정 상태 업데이트
  const result = await query(
    'UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING email, name',
    [isActive, userId]
  );

  if (result.rows.length === 0) {
    throw createError.notFound('사용자를 찾을 수 없습니다.');
  }

  const user = result.rows[0];

  // 계정 비활성화시 모든 토큰 무효화
  if (!isActive) {
    await invalidateAllUserTokens(userId, 'account_deactivated');
  }

  logger.info('계정 상태 변경:', {
    adminId: req.user.id,
    targetUserId: userId,
    targetEmail: user.email,
    isActive,
    reason
  });

  // 상태 변경 알림 이메일 발송
  const statusText = isActive ? '활성화' : '비활성화';
  sendEmail({
    to: user.email,
    subject: `🔔 계정이 ${statusText}되었습니다`,
    template: 'account_status_change',
    data: {
      name: user.name,
      statusText,
      reason,
      contactEmail: process.env.ADMIN_EMAIL
    }
  }).catch(error => {
    logger.error('계정 상태 변경 이메일 발송 실패:', error);
  });

  res.json({
    success: true,
    message: `계정이 ${statusText}되었습니다.`,
    data: {
      userId,
      isActive,
      reason
    }
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
  getAuthStatus
};
