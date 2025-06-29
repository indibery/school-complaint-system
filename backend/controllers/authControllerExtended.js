/**
 * 🔐 인증 컨트롤러 추가 기능 (비밀번호 재설정 및 관리 기능)
 * 
 * @description 로그인/로그아웃 외 추가 인증 기능들
 */

const { asyncHandler, createError } = require('../middleware/errorHandler');
const { generateTokenPair, TokenBlacklist, invalidateAllUserTokens } = require('../utils/jwt');
const { hashPassword, verifyPassword } = require('../utils/crypto');
const { query, transaction } = require('../utils/database');
const { sendEmail } = require('../utils/email');
const { 
  generatePasswordResetToken,
  verifyPasswordResetToken,
  invalidatePasswordResetToken,
  unlockUserAccount,
  handleLoginSuccess
} = require('../utils/authSecurity');
const logger = require('../utils/logger');

/**
 * @desc    비밀번호 찾기
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const clientIp = req.ip || req.connection.remoteAddress;

  // 사용자 확인
  const result = await query(
    'SELECT id, name, email FROM users WHERE email = $1 AND is_active = true',
    [email]
  );

  // 보안을 위해 사용자 존재 여부와 관계없이 성공 응답
  if (result.rows.length === 0) {
    logger.warn('존재하지 않는 이메일로 비밀번호 재설정 요청:', {
      email,
      ip: clientIp
    });

    return res.json({
      success: true,
      message: '비밀번호 재설정 이메일을 발송했습니다.'
    });
  }

  const user = result.rows[0];

  // 비밀번호 재설정 토큰 생성 (60분 유효)
  const resetToken = await generatePasswordResetToken(user.id, 60);

  // 재설정 이메일 발송
  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  
  try {
    await sendEmail({
      to: email,
      subject: '🔐 비밀번호 재설정 요청',
      template: 'password_reset',
      data: {
        name: user.name,
        email: user.email,
        resetLink,
        resetCode: resetToken.substring(0, 8).toUpperCase(),
        expiresIn: '60분'
      }
    });

    logger.info('비밀번호 재설정 이메일 발송:', {
      userId: user.id,
      email: user.email,
      ip: clientIp
    });

  } catch (error) {
    logger.error('비밀번호 재설정 이메일 발송 실패:', {
      userId: user.id,
      email: user.email,
      error: error.message
    });

    throw createError.internal('이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.');
  }

  res.json({
    success: true,
    message: '비밀번호 재설정 이메일을 발송했습니다.',
    data: {
      email: user.email,
      expiresIn: '60분'
    }
  });
});

/**
 * @desc    비밀번호 재설정
 * @route   POST /api/auth/reset-password
 * @access  Public (Reset Token 필요)
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  const clientIp = req.ip || req.connection.remoteAddress;

  // 유효한 재설정 토큰 확인
  const user = await verifyPasswordResetToken(token);

  if (!user) {
    throw createError.badRequest('유효하지 않거나 만료된 재설정 토큰입니다.');
  }

  // 새 비밀번호 해싱
  const hashedPassword = await hashPassword(newPassword);

  // 트랜잭션으로 비밀번호 업데이트 및 보안 처리
  await transaction(async (client) => {
    // 비밀번호 업데이트
    await client.query(
      `UPDATE users 
       SET password_hash = $1, 
           updated_at = NOW()
       WHERE id = $2`,
      [hashedPassword, user.id]
    );

    // 재설정 토큰 무효화
    await invalidatePasswordResetToken(user.id);

    // 로그인 시도 횟수 초기화 및 계정 잠금 해제
    await client.query(
      'UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = $1',
      [user.id]
    );
  });

  // 모든 기존 토큰 무효화 (보안)
  await invalidateAllUserTokens(user.id, 'password_reset');

  logger.info('비밀번호 재설정 완료:', {
    userId: user.id,
    email: user.email,
    ip: clientIp
  });

  // 비밀번호 변경 알림 이메일 발송
  sendEmail({
    to: user.email,
    subject: '✅ 비밀번호가 변경되었습니다',
    template: 'password_changed',
    data: {
      name: user.name,
      changeTime: new Date().toLocaleString('ko-KR'),
      ip: clientIp,
      loginLink: `${process.env.FRONTEND_URL}/login`
    }
  }).catch(error => {
    logger.error('비밀번호 변경 알림 이메일 발송 실패:', error);
  });

  res.json({
    success: true,
    message: '비밀번호가 성공적으로 재설정되었습니다.',
    data: {
      email: user.email,
      resetTime: new Date().toISOString()
    }
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
  const userEmail = req.user.email;
  const clientIp = req.ip || req.connection.remoteAddress;

  // 현재 비밀번호 확인
  const result = await query(
    'SELECT password_hash, name FROM users WHERE id = $1',
    [userId]
  );

  const user = result.rows[0];
  const isValidPassword = await verifyPassword(currentPassword, user.password_hash);
  
  if (!isValidPassword) {
    logger.warn('잘못된 현재 비밀번호로 변경 시도:', {
      userId,
      email: userEmail,
      ip: clientIp
    });
    throw createError.badRequest('현재 비밀번호가 올바르지 않습니다.');
  }

  // 새 비밀번호와 현재 비밀번호가 같은지 확인
  const isSamePassword = await verifyPassword(newPassword, user.password_hash);
  if (isSamePassword) {
    throw createError.badRequest('새 비밀번호는 현재 비밀번호와 달라야 합니다.');
  }

  // 새 비밀번호 해싱 및 업데이트
  const hashedPassword = await hashPassword(newPassword);
  await query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [hashedPassword, userId]
  );

  logger.info('비밀번호 변경 완료:', {
    userId,
    email: userEmail,
    ip: clientIp
  });

  // 비밀번호 변경 알림 이메일 발송
  sendEmail({
    to: userEmail,
    subject: '🔒 비밀번호가 변경되었습니다',
    template: 'password_changed',
    data: {
      name: user.name,
      changeTime: new Date().toLocaleString('ko-KR'),
      ip: clientIp,
      loginLink: `${process.env.FRONTEND_URL}/login`
    }
  }).catch(error => {
    logger.error('비밀번호 변경 알림 이메일 발송 실패:', error);
  });

  res.json({
    success: true,
    message: '비밀번호가 성공적으로 변경되었습니다.',
    data: {
      changeTime: new Date().toISOString()
    }
  });
});

/**
 * @desc    계정 잠금 해제 (관리자 전용)
 * @route   POST /api/auth/unlock-account/:userId
 * @access  Private (Admin only)
 */
const unlockAccount = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { reason } = req.body;
  const adminId = req.user.id;
  const adminEmail = req.user.email;

  // 대상 사용자 정보 조회
  const userResult = await query(
    'SELECT email, name, locked_until FROM users WHERE id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw createError.notFound('사용자를 찾을 수 없습니다.');
  }

  const user = userResult.rows[0];

  // 이미 잠금이 해제된 경우
  if (!user.locked_until || new Date(user.locked_until) <= new Date()) {
    throw createError.badRequest('이미 잠금이 해제된 계정입니다.');
  }

  // 계정 잠금 해제
  await unlockUserAccount(userId);

  logger.info('관리자에 의한 계정 잠금 해제:', {
    adminId,
    adminEmail,
    targetUserId: userId,
    targetEmail: user.email,
    reason: reason || '관리자 해제'
  });

  // 잠금 해제 알림 이메일 발송
  sendEmail({
    to: user.email,
    subject: '🔓 계정 잠금이 해제되었습니다',
    template: 'account_unlocked',
    data: {
      name: user.name,
      unlockTime: new Date().toLocaleString('ko-KR'),
      reason: reason || '관리자에 의한 해제',
      loginLink: `${process.env.FRONTEND_URL}/login`
    }
  }).catch(error => {
    logger.error('계정 잠금 해제 알림 이메일 발송 실패:', error);
  });

  res.json({
    success: true,
    message: '계정 잠금이 해제되었습니다.',
    data: {
      userId,
      email: user.email,
      unlockTime: new Date().toISOString(),
      reason: reason || '관리자 해제'
    }
  });
});

/**
 * @desc    인증 시스템 통계 (관리자 전용)
 * @route   GET /api/auth/stats
 * @access  Private (Admin only)
 */
const getAuthStats = asyncHandler(async (req, res) => {
  // 기본 사용자 통계
  const userStatsResult = await query(`
    SELECT 
      COUNT(*) as total_users,
      COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
      COUNT(CASE WHEN email_verified_at IS NOT NULL THEN 1 END) as verified_users,
      COUNT(CASE WHEN locked_until > NOW() THEN 1 END) as locked_users,
      COUNT(CASE WHEN role = 'parent' THEN 1 END) as parents,
      COUNT(CASE WHEN role = 'teacher' THEN 1 END) as teachers,
      COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins,
      COUNT(CASE WHEN role = 'security' THEN 1 END) as security_guards
    FROM users
  `);

  // 최근 로그인 통계 (지난 30일)
  const recentLoginResult = await query(`
    SELECT 
      COUNT(CASE WHEN last_login_at > NOW() - INTERVAL '1 day' THEN 1 END) as logins_today,
      COUNT(CASE WHEN last_login_at > NOW() - INTERVAL '7 days' THEN 1 END) as logins_week,
      COUNT(CASE WHEN last_login_at > NOW() - INTERVAL '30 days' THEN 1 END) as logins_month
    FROM users
    WHERE last_login_at IS NOT NULL
  `);

  // 토큰 블랙리스트 통계
  const tokenStatsResult = await query(`
    SELECT 
      COUNT(*) as total_blacklisted,
      COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as active_blacklisted,
      COUNT(CASE WHEN reason = 'logout' THEN 1 END) as logout_tokens,
      COUNT(CASE WHEN reason = 'security' THEN 1 END) as security_tokens
    FROM token_blacklist
  `);

  const userStats = userStatsResult.rows[0];
  const recentLogin = recentLoginResult.rows[0];
  const tokenStats = tokenStatsResult.rows[0];

  logger.info('인증 시스템 통계 조회:', {
    adminId: req.user.id,
    adminEmail: req.user.email
  });

  res.json({
    success: true,
    message: '인증 시스템 통계',
    data: {
      users: {
        total: parseInt(userStats.total_users),
        active: parseInt(userStats.active_users),
        verified: parseInt(userStats.verified_users),
        locked: parseInt(userStats.locked_users),
        byRole: {
          parents: parseInt(userStats.parents),
          teachers: parseInt(userStats.teachers),
          admins: parseInt(userStats.admins),
          securityGuards: parseInt(userStats.security_guards)
        }
      },
      recentActivity: {
        loginsToday: parseInt(recentLogin.logins_today),
        loginsThisWeek: parseInt(recentLogin.logins_week),
        loginsThisMonth: parseInt(recentLogin.logins_month)
      },
      tokens: {
        totalBlacklisted: parseInt(tokenStats.total_blacklisted),
        activeBlacklisted: parseInt(tokenStats.active_blacklisted),
        logoutTokens: parseInt(tokenStats.logout_tokens),
        securityTokens: parseInt(tokenStats.security_tokens)
      },
      systemHealth: {
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      }
    }
  });
});

module.exports = {
  forgotPassword,
  resetPassword,
  changePassword,
  unlockAccount,
  getAuthStats
};
