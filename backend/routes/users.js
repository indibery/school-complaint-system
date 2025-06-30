/**
 * 👤 사용자 관리 라우터
 * 
 * @description 사용자 프로필, 설정, 통계 관련 API 엔드포인트
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const { 
  authenticateToken, 
  requireAdmin,
  optionalAuth
} = require('../middleware/auth');
const { 
  validateProfileUpdate,
  validatePasswordChange,
  validateSettings,
  handleValidationErrors
} = require('../middleware/validation');
const { body, query } = require('express-validator');
const userController = require('../controllers/userController');

const router = express.Router();

// =================================
// 📁 파일 업로드 설정 (프로필 이미지)
// =================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/avatars/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + req.user.id + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('프로필 이미지는 JPEG, JPG, PNG, GIF 형식만 지원됩니다.'));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB 제한
  fileFilter: fileFilter
});

// =================================
// 👤 사용자 프로필 관리 라우트
// =================================

/**
 * @route   GET /api/users/profile
 * @desc    내 프로필 조회
 * @access  Private
 */
router.get('/profile', 
  authenticateToken,
  userController.getProfile
);

/**
 * @route   PUT /api/users/profile
 * @desc    프로필 수정
 * @access  Private
 */
router.put('/profile',
  authenticateToken,
  [
    body('name')
      .optional()
      .isLength({ min: 2, max: 50 })
      .withMessage('이름은 2자 이상 50자 이하여야 합니다.')
      .matches(/^[가-힣a-zA-Z\s]+$/)
      .withMessage('이름은 한글, 영문, 공백만 사용할 수 있습니다.'),
    body('phone')
      .optional()
      .matches(/^01[0-9]-[0-9]{4}-[0-9]{4}$/)
      .withMessage('전화번호 형식이 올바르지 않습니다. (예: 010-1234-5678)')
  ],
  handleValidationErrors,
  userController.updateProfile
);

/**
 * @route   PUT /api/users/password
 * @desc    비밀번호 변경
 * @access  Private
 */
router.put('/password',
  authenticateToken,
  [
    body('currentPassword')
      .notEmpty()
      .withMessage('현재 비밀번호를 입력해주세요.'),
    body('newPassword')
      .isLength({ min: 8, max: 100 })
      .withMessage('새 비밀번호는 8자 이상 100자 이하여야 합니다.')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('새 비밀번호는 대문자, 소문자, 숫자, 특수문자를 모두 포함해야 합니다.'),
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error('비밀번호 확인이 일치하지 않습니다.');
        }
        return true;
      })
  ],
  handleValidationErrors,
  userController.changePassword
);

/**
 * @route   PUT /api/users/settings
 * @desc    계정 설정 변경
 * @access  Private
 */
router.put('/settings',
  authenticateToken,
  [
    body('email_notifications')
      .optional()
      .isBoolean()
      .withMessage('이메일 알림 설정은 true/false 값이어야 합니다.'),
    body('sms_notifications')
      .optional()
      .isBoolean()
      .withMessage('SMS 알림 설정은 true/false 값이어야 합니다.'),
    body('language')
      .optional()
      .isIn(['ko', 'en'])
      .withMessage('언어 설정은 ko 또는 en만 가능합니다.'),
    body('timezone')
      .optional()
      .isIn(['Asia/Seoul', 'UTC'])
      .withMessage('시간대 설정이 올바르지 않습니다.'),
    body('privacy_level')
      .optional()
      .isIn(['public', 'private', 'friends'])
      .withMessage('개인정보 보호 수준은 public, private, friends 중 하나여야 합니다.'),
    body('two_factor_enabled')
      .optional()
      .isBoolean()
      .withMessage('2단계 인증 설정은 true/false 값이어야 합니다.')
  ],
  handleValidationErrors,
  userController.updateSettings
);

/**
 * @route   DELETE /api/users/account
 * @desc    계정 삭제
 * @access  Private
 */
router.delete('/account',
  authenticateToken,
  [
    body('password')
      .notEmpty()
      .withMessage('계정 삭제를 위해 비밀번호를 입력해주세요.'),
    body('confirmation')
      .equals('DELETE_MY_ACCOUNT')
      .withMessage('계정 삭제 확인을 위해 "DELETE_MY_ACCOUNT"를 입력해주세요.')
  ],
  handleValidationErrors,
  userController.deleteAccount
);

/**
 * @route   GET /api/users/stats
 * @desc    사용자 통계 조회
 * @access  Private
 */
router.get('/stats',
  authenticateToken,
  [
    query('period')
      .optional()
      .isIn(['7', '30', '90', '365'])
      .withMessage('기간은 7, 30, 90, 365일 중 하나여야 합니다.')
  ],
  handleValidationErrors,
  userController.getUserStats
);

/**
 * @route   POST /api/users/upload-avatar
 * @desc    프로필 이미지 업로드
 * @access  Private
 */
router.post('/upload-avatar',
  authenticateToken,
  upload.single('avatar'),
  userController.uploadAvatar
);

module.exports = router;
