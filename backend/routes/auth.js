/**
 * 🔐 인증 라우터 (완전히 개선된 버전)
 * 
 * @description 사용자 인증 관련 API 엔드포인트
 */

const express = require('express');
const { 
  authenticateToken, 
  verifyRefreshToken, 
  requireAdmin,
  loginProtection 
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

module.exports = router;
