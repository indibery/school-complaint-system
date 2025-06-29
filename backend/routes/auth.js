/**
 * 🔐 인증 라우터
 * 
 * @description 사용자 인증 관련 API 엔드포인트
 */

const express = require('express');
const { authenticateToken, verifyRefreshToken } = require('../middleware/auth');
const { 
  validateUserRegistration, 
  validateLogin, 
  validatePasswordChange 
} = require('../middleware/validation');
const authController = require('../controllers/authController');

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    회원가입
 * @access  Public
 */
router.post('/register', validateUserRegistration, authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    로그인
 * @access  Public
 */
router.post('/login', validateLogin, authController.login);

/**
 * @route   POST /api/auth/refresh
 * @desc    토큰 갱신
 * @access  Public (Refresh Token 필요)
 */
router.post('/refresh', verifyRefreshToken, authController.refreshToken);

/**
 * @route   POST /api/auth/logout
 * @desc    로그아웃
 * @access  Private
 */
router.post('/logout', authenticateToken, authController.logout);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    비밀번호 찾기
 * @access  Public
 */
router.post('/forgot-password', authController.forgotPassword);

/**
 * @route   POST /api/auth/reset-password
 * @desc    비밀번호 재설정
 * @access  Public (Reset Token 필요)
 */
router.post('/reset-password', authController.resetPassword);

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

/**
 * @route   POST /api/auth/verify-email
 * @desc    이메일 인증
 * @access  Public
 */
router.post('/verify-email', authController.verifyEmail);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    인증 이메일 재발송
 * @access  Private
 */
router.post('/resend-verification', authenticateToken, authController.resendVerification);

module.exports = router;