/**
 * 🔐 인증 라우터 (로그인/로그아웃 포함 완전판)
 * 
 * @description 사용자 인증 관련 API 엔드포인트
 */

const express = require('express');
const { 
  authenticateToken, 
  verifyRefreshToken, 
  requireAdmin,
  loginProtection,
  optionalAuth
} = require('../middleware/auth');
const { 
  validateUserRegistration, 
  validateLogin, 
  validatePasswordChange,
  handleValidationErrors
} = require('../middleware/validation');
const { body } = require('express-validator');
const authController = require('../controllers/authController');

const router = express.Router();

// =================================
// 📝 회원가입 관련 라우트
// =================================

/**
 * @route   POST /api/auth/register
 * @desc    회원가입
 * @access  Public
 */
router.post('/register', 
  validateUserRegistration, 
  authController.register
);

/**
 * @route   POST /api/auth/validate-registration
 * @desc    회원가입 유효성 사전 검증
 * @access  Public
 */
router.post('/validate-registration',
  [
    body('email')
      .optional()
      .isEmail()
      .withMessage('유효한 이메일 주소를 입력해주세요.')
      .normalizeEmail(),
    
    body('phone')
      .optional()
      .isMobilePhone('ko-KR')
      .withMessage('유효한 한국 전화번호를 입력해주세요.'),
    
    handleValidationErrors
  ],
  authController.validateRegistration
);

/**
 * @route   POST /api/auth/verify-email
 * @desc    이메일 인증
 * @access  Public
 */
router.post('/verify-email',
  [
    body('token')
      .notEmpty()
      .withMessage('인증 토큰이 필요합니다.')
      .isLength({ min: 10, max: 200 })
      .withMessage('유효하지 않은 토큰 형식입니다.'),
    
    handleValidationErrors
  ],
  authController.verifyEmail
);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    인증 이메일 재발송
 * @access  Private
 */
router.post('/resend-verification',
  authenticateToken,
  authController.resendVerification
);

// =================================
// 🔑 로그인/로그아웃 관련 라우트
// =================================

/**
 * @route   POST /api/auth/login
 * @desc    로그인
 * @access  Public
 */
router.post('/login', 
  loginProtection,
  [
    body('email')
      .isEmail()
      .withMessage('유효한 이메일 주소를 입력해주세요.')
      .normalizeEmail(),
    
    body('password')
      .notEmpty()
      .withMessage('비밀번호를 입력해주세요.')
      .isLength({ min: 1 })
      .withMessage('비밀번호는 필수입니다.'),
    
    body('rememberMe')
      .optional()
      .isBoolean()
      .withMessage('기억하기 옵션은 true/false여야 합니다.'),
    
    handleValidationErrors
  ],
  authController.login
);

/**
 * @route   POST /api/auth/refresh
 * @desc    토큰 갱신
 * @access  Public (Refresh Token 필요)
 */
router.post('/refresh', 
  [
    body('refreshToken')
      .notEmpty()
      .withMessage('리프레시 토큰이 필요합니다.')
      .isJWT()
      .withMessage('유효하지 않은 리프레시 토큰 형식입니다.'),
    
    handleValidationErrors
  ],
  authController.refreshToken
);

/**
 * @route   POST /api/auth/logout
 * @desc    로그아웃
 * @access  Private
 */
router.post('/logout', 
  authenticateToken, 
  authController.logout
);

/**
 * @route   POST /api/auth/logout-all
 * @desc    모든 디바이스에서 로그아웃
 * @access  Private
 */
router.post('/logout-all',
  authenticateToken,
  authController.logoutAll
);

// =================================
// 👤 사용자 정보 관련 라우트
// =================================

/**
 * @route   GET /api/auth/me
 * @desc    현재 사용자 정보 조회
 * @access  Private
 */
router.get('/me',
  authenticateToken,
  authController.getCurrentUser
);

/**
 * @route   GET /api/auth/status
 * @desc    인증 상태 확인
 * @access  Public (토큰 있으면 검증)
 */
router.get('/status',
  optionalAuth,
  authController.getAuthStatus
);

// =================================
// 🔒 비밀번호 관련 라우트
// =================================

/**
 * @route   POST /api/auth/forgot-password
 * @desc    비밀번호 찾기
 * @access  Public
 */
router.post('/forgot-password',
  [
    body('email')
      .isEmail()
      .withMessage('유효한 이메일 주소를 입력해주세요.')
      .normalizeEmail(),
    
    handleValidationErrors
  ],
  authController.forgotPassword
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    비밀번호 재설정
 * @access  Public (Reset Token 필요)
 */
router.post('/reset-password',
  [
    body('token')
      .notEmpty()
      .withMessage('재설정 토큰이 필요합니다.')
      .isLength({ min: 10, max: 200 })
      .withMessage('유효하지 않은 토큰 형식입니다.'),
    
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('새 비밀번호는 최소 8자리여야 합니다.')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('새 비밀번호는 대소문자, 숫자, 특수문자를 포함해야 합니다.'),
    
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error('비밀번호 확인이 일치하지 않습니다.');
        }
        return true;
      }),
    
    handleValidationErrors
  ],
  authController.resetPassword
);

/**
 * @route   PUT /api/auth/change-password
 * @desc    비밀번호 변경
 * @access  Private
 */
router.put('/change-password', 
  authenticateToken,
  validatePasswordChange, 
  authController.changePassword
);

// =================================
// 👥 계정 관리 라우트 (관리자용)
// =================================

/**
 * @route   PUT /api/auth/account/:userId/status
 * @desc    사용자 계정 활성화/비활성화
 * @access  Private (Admin only)
 */
router.put('/account/:userId/status',
  authenticateToken,
  requireAdmin,
  [
    body('isActive')
      .isBoolean()
      .withMessage('활성화 상태는 true/false여야 합니다.'),
    
    body('reason')
      .optional()
      .trim()
      .isLength({ min: 3, max: 200 })
      .withMessage('사유는 3-200자 사이여야 합니다.'),
    
    handleValidationErrors
  ],
  authController.updateAccountStatus
);

/**
 * @route   POST /api/auth/unlock-account/:userId
 * @desc    사용자 계정 잠금 해제
 * @access  Private (Admin only)
 */
router.post('/unlock-account/:userId',
  authenticateToken,
  requireAdmin,
  [
    body('reason')
      .optional()
      .trim()
      .isLength({ min: 3, max: 200 })
      .withMessage('해제 사유는 3-200자 사이여야 합니다.'),
    
    handleValidationErrors
  ],
  authController.unlockAccount
);

// =================================
// 📊 관리 및 모니터링 라우트
// =================================

/**
 * @route   GET /api/auth/health
 * @desc    인증 시스템 헬스체크
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '인증 시스템이 정상 작동 중입니다.',
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        database: 'connected',
        jwt: 'active',
        email: process.env.EMAIL_USER ? 'configured' : 'not_configured'
      }
    }
  });
});

/**
 * @route   GET /api/auth/stats
 * @desc    인증 시스템 통계 (관리자 전용)
 * @access  Private (Admin only)
 */
router.get('/stats',
  authenticateToken,
  requireAdmin,
  authController.getAuthStats
);

module.exports = router;
