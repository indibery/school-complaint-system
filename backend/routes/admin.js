/**
 * 🔧 관리자용 사용자 관리 라우터
 * 
 * @description 관리자 권한이 필요한 사용자 관리 API 엔드포인트
 */

const express = require('express');
const { 
  requireAdmin,
  authenticateToken
} = require('../middleware/auth');
const { 
  handleValidationErrors
} = require('../middleware/validation');
const { body, query } = require('express-validator');
const userController = require('../controllers/userController');

const router = express.Router();

// 모든 관리자 라우트에 인증 및 관리자 권한 확인 적용
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * @route   GET /api/admin/users
 * @desc    사용자 목록 조회 (관리자용)
 * @access  Admin
 */
router.get('/users',
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('페이지 번호는 1 이상의 정수여야 합니다.'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('제한 수는 1-100 사이의 정수여야 합니다.'),
    query('role')
      .optional()
      .isIn(['parent', 'teacher', 'admin', 'security', 'user'])
      .withMessage('유효한 역할을 선택해주세요.'),
    query('status')
      .optional()
      .isIn(['active', 'inactive'])
      .withMessage('상태는 active 또는 inactive여야 합니다.'),
    query('sortBy')
      .optional()
      .isIn(['created_at', 'updated_at', 'last_login_at', 'name', 'email'])
      .withMessage('유효한 정렬 필드를 선택해주세요.'),
    query('sortOrder')
      .optional()
      .isIn(['ASC', 'DESC', 'asc', 'desc'])
      .withMessage('정렬 순서는 ASC 또는 DESC여야 합니다.'),
    query('dateFrom')
      .optional()
      .isISO8601()
      .withMessage('시작 날짜는 유효한 ISO 8601 형식이어야 합니다.'),
    query('dateTo')
      .optional()
      .isISO8601()
      .withMessage('종료 날짜는 유효한 ISO 8601 형식이어야 합니다.')
  ],
  handleValidationErrors,
  userController.getAllUsers
);

/**
 * @route   GET /api/admin/users/:id
 * @desc    특정 사용자 상세 정보 조회 (관리자용)
 * @access  Admin
 */
router.get('/users/:id',
  [
    body('id')
      .isInt({ min: 1 })
      .withMessage('유효한 사용자 ID를 입력해주세요.')
  ],
  handleValidationErrors,
  userController.getUserById
);

/**
 * @route   PUT /api/admin/users/:id
 * @desc    사용자 정보 수정 (관리자용)
 * @access  Admin
 */
router.put('/users/:id',
  [
    body('name')
      .optional()
      .isLength({ min: 2, max: 50 })
      .withMessage('이름은 2자 이상 50자 이하여야 합니다.')
      .matches(/^[가-힣a-zA-Z\s]+$/)
      .withMessage('이름은 한글, 영문, 공백만 사용할 수 있습니다.'),
    body('email')
      .optional()
      .isEmail()
      .withMessage('유효한 이메일 주소를 입력해주세요.')
      .normalizeEmail(),
    body('phone')
      .optional()
      .matches(/^01[0-9]-[0-9]{4}-[0-9]{4}$/)
      .withMessage('전화번호 형식이 올바르지 않습니다. (예: 010-1234-5678)'),
    body('role')
      .optional()
      .isIn(['parent', 'teacher', 'admin', 'security', 'user'])
      .withMessage('유효한 역할을 선택해주세요.'),
    body('is_active')
      .optional()
      .isBoolean()
      .withMessage('활성 상태는 true/false 값이어야 합니다.'),
    body('email_verified')
      .optional()
      .isBoolean()
      .withMessage('이메일 인증 상태는 true/false 값이어야 합니다.')
  ],
  handleValidationErrors,
  userController.updateUserById
);

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    사용자 삭제 (관리자용)
 * @access  Admin
 */
router.delete('/users/:id',
  [
    body('reason')
      .optional()
      .isLength({ min: 10, max: 500 })
      .withMessage('삭제 사유는 10자 이상 500자 이하여야 합니다.'),
    body('confirmation')
      .equals('ADMIN_DELETE_USER')
      .withMessage('관리자 삭제 확인을 위해 "ADMIN_DELETE_USER"를 입력해주세요.')
  ],
  handleValidationErrors,
  userController.deleteUserById
);

/**
 * @route   POST /api/admin/users/:id/reset-password
 * @desc    사용자 비밀번호 초기화 (관리자용)
 * @access  Admin
 */
router.post('/users/:id/reset-password',
  [
    body('new_password')
      .isLength({ min: 8, max: 100 })
      .withMessage('새 비밀번호는 8자 이상 100자 이하여야 합니다.')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('새 비밀번호는 대문자, 소문자, 숫자, 특수문자를 모두 포함해야 합니다.'),
    body('send_notification')
      .optional()
      .isBoolean()
      .withMessage('알림 발송 여부는 true/false 값이어야 합니다.')
  ],
  handleValidationErrors,
  userController.adminResetPassword
);

/**
 * @route   POST /api/admin/users/:id/unlock
 * @desc    사용자 계정 잠금 해제 (관리자용)
 * @access  Admin
 */
router.post('/users/:id/unlock',
  userController.unlockUserAccount
);

/**
 * @route   GET /api/admin/users/stats
 * @desc    사용자 관리 통계 (관리자용)
 * @access  Admin
 */
router.get('/users/stats',
  [
    query('period')
      .optional()
      .isIn(['7', '30', '90', '365'])
      .withMessage('기간은 7, 30, 90, 365일 중 하나여야 합니다.')
  ],
  handleValidationErrors,
  userController.getAdminUserStats
);

module.exports = router;
