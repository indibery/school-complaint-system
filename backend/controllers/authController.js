/**
 * 🔐 인증 컨트롤러
 * 
 * @description 사용자 인증 관련 비즈니스 로직
 */

const { asyncHandler, createError } = require('../middleware/errorHandler');
const { generateTokens } = require('../middleware/auth');
const { hashPassword, verifyPassword, generateVerificationToken } = require('../utils/crypto');
const { query, transaction } = require('../utils/database');
const { sendEmail } = require('../utils/email');
const logger = require('../utils/logger');

/**
 * @desc    회원가입
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = asyncHandler(async (req, res) => {
  const { email, password, name, phone, role = 'parent' } = req.body;

  // 이메일 중복 확인
  const existingUser = await query(
    'SELECT id FROM users WHERE email = $1',
    [email]
  );

  if (existingUser.rows.length > 0) {
    throw createError.conflict('이미 등록된 이메일입니다.');
  }

  // 비밀번호 해싱
  const hashedPassword = await hashPassword(password);
  
  // 이메일 인증 토큰 생성
  const verificationToken = generateVerificationToken();

  // 사용자 생성
  const result = await query(`
    INSERT INTO users (email, password_hash, name, phone, role, email_verification_token)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, email, name, role, created_at
  `, [email, hashedPassword, name, phone, role, verificationToken]);

  const user = result.rows[0];

  // JWT 토큰 생성
  const tokens = generateTokens(user);

  // 환영 이메일 발송 (비동기)
  sendEmail(email, '🏫 학교 민원시스템 가입을 환영합니다!', 'welcome', {
    name,
    verificationToken
  }).catch(error => {
    logger.error('환영 이메일 발송 실패:', error);
  });

  logger.info('새 사용자 등록:', {
    userId: user.id,
    email: user.email,
    role: user.role
  });

  res.status(201).json({
    success: true,
    message: '회원가입이 완료되었습니다.',
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.created_at
      },
      tokens
    }
  });
});

/**
 * @desc    로그인
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // 사용자 조회
  const result = await query(
    'SELECT id, email, password_hash, name, role, is_active FROM users WHERE email = $1',
    [email]
  );

  if (result.rows.length === 0) {
    throw createError.unauthorized('이메일 또는 비밀번호가 올바르지 않습니다.');
  }

  const user = result.rows[0];

  // 계정 활성화 확인
  if (!user.is_active) {
    throw createError.forbidden('비활성화된 계정입니다. 관리자에게 문의하세요.');
  }

  // 비밀번호 확인
  const isValidPassword = await verifyPassword(password, user.password_hash);
  if (!isValidPassword) {
    throw createError.unauthorized('이메일 또는 비밀번호가 올바르지 않습니다.');
  }

  // 마지막 로그인 시간 업데이트
  await query(
    'UPDATE users SET last_login_at = NOW() WHERE id = $1',
    [user.id]
  );

  // JWT 토큰 생성
  const tokens = generateTokens(user);

  logger.info('사용자 로그인:', {
    userId: user.id,
    email: user.email,
    role: user.role
  });

  res.json({
    success: true,
    message: '로그인되었습니다.',
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      tokens
    }
  });
});

/**
 * @desc    토큰 갱신
 * @route   POST /api/auth/refresh
 * @access  Public (Refresh Token 필요)
 */
const refreshToken = asyncHandler(async (req, res) => {
  const user = req.user; // verifyRefreshToken 미들웨어에서 설정

  // 새 토큰 생성
  const tokens = generateTokens(user);

  logger.debug('토큰 갱신:', {
    userId: user.id,
    email: user.email
  });

  res.json({
    success: true,
    message: '토큰이 갱신되었습니다.',
    data: { tokens }
  });
});

/**
 * @desc    로그아웃
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = asyncHandler(async (req, res) => {
  // TODO: 토큰 블랙리스트 구현 (Redis 사용)
  
  logger.info('사용자 로그아웃:', {
    userId: req.user.id,
    email: req.user.email
  });

  res.json({
    success: true,
    message: '로그아웃되었습니다.'
  });
});

/**
 * @desc    비밀번호 찾기
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  // 사용자 확인
  const result = await query(
    'SELECT id, name FROM users WHERE email = $1 AND is_active = true',
    [email]
  );

  // 보안을 위해 사용자 존재 여부와 관계없이 성공 응답
  if (result.rows.length === 0) {
    return res.json({
      success: true,
      message: '비밀번호 재설정 이메일을 발송했습니다.'
    });
  }

  const user = result.rows[0];
  const resetToken = generateVerificationToken();
  const resetExpires = new Date(Date.now() + 3600000); // 1시간 후 만료

  // 재설정 토큰 저장
  await query(
    'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3',
    [resetToken, resetExpires, user.id]
  );

  // 재설정 이메일 발송
  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  await sendEmail(email, '🔐 비밀번호 재설정', 'password_reset', {
    name: user.name,
    resetLink,
    resetCode: resetToken.substring(0, 8).toUpperCase()
  });

  logger.info('비밀번호 재설정 요청:', {
    userId: user.id,
    email
  });

  res.json({
    success: true,
    message: '비밀번호 재설정 이메일을 발송했습니다.'
  });
});

/**
 * @desc    비밀번호 재설정
 * @route   POST /api/auth/reset-password
 * @access  Public (Reset Token 필요)
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  // 유효한 재설정 토큰 확인
  const result = await query(`
    SELECT id, email FROM users 
    WHERE password_reset_token = $1 
    AND password_reset_expires > NOW()
    AND is_active = true
  `, [token]);

  if (result.rows.length === 0) {
    throw createError.badRequest('유효하지 않거나 만료된 재설정 토큰입니다.');
  }

  const user = result.rows[0];
  const hashedPassword = await hashPassword(newPassword);

  // 비밀번호 업데이트 및 토큰 삭제
  await query(`
    UPDATE users 
    SET password_hash = $1, 
        password_reset_token = NULL, 
        password_reset_expires = NULL,
        updated_at = NOW()
    WHERE id = $2
  `, [hashedPassword, user.id]);

  logger.info('비밀번호 재설정 완료:', {
    userId: user.id,
    email: user.email
  });

  res.json({
    success: true,
    message: '비밀번호가 성공적으로 재설정되었습니다.'
  });
});

/**
 * @desc    비밀번호 변경
 * @route   PUT /api/auth/change-password
 * @access  Private
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  // 현재 비밀번호 확인
  const result = await query(
    'SELECT password_hash FROM users WHERE id = $1',
    [userId]
  );

  const user = result.rows[0];
  const isValidPassword = await verifyPassword(currentPassword, user.password_hash);
  
  if (!isValidPassword) {
    throw createError.badRequest('현재 비밀번호가 올바르지 않습니다.');
  }

  // 새 비밀번호 해싱 및 업데이트
  const hashedPassword = await hashPassword(newPassword);
  await query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [hashedPassword, userId]
  );

  logger.info('비밀번호 변경:', {
    userId,
    email: req.user.email
  });

  res.json({
    success: true,
    message: '비밀번호가 성공적으로 변경되었습니다.'
  });
});

/**
 * @desc    이메일 인증
 * @route   POST /api/auth/verify-email
 * @access  Public
 */
const verifyEmail = asyncHandler(async (req, res) => {
  // TODO: 이메일 인증 로직 구현
  res.json({
    success: true,
    message: '이메일 인증이 완료되었습니다.'
  });
});

/**
 * @desc    인증 이메일 재발송
 * @route   POST /api/auth/resend-verification
 * @access  Private
 */
const resendVerification = asyncHandler(async (req, res) => {
  // TODO: 인증 이메일 재발송 로직 구현
  res.json({
    success: true,
    message: '인증 이메일을 재발송했습니다.'
  });
});

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  verifyEmail,
  resendVerification
};