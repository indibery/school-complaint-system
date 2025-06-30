/**
 * ✅ 유효성 검증 미들웨어
 * 
 * @description express-validator 기반 입력 데이터 검증
 */

const { body, param, query, validationResult } = require('express-validator');
const { createError } = require('./errorHandler');

/**
 * 유효성 검증 결과 확인 미들웨어
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));

    return next(createError.badRequest('입력 데이터가 유효하지 않습니다.', {
      code: 'VALIDATION_ERROR',
      errors: errorMessages
    }));
  }
  
  next();
};

/**
 * 사용자 등록 유효성 검증
 */
const validateUserRegistration = [
  body('email')
    .isEmail()
    .withMessage('유효한 이메일 주소를 입력해주세요.')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('비밀번호는 최소 8자리여야 합니다.')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])[A-Za-z\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/)
    .withMessage('비밀번호는 대소문자, 숫자, 특수문자를 포함해야 합니다.'),
  
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('이름은 2-50자 사이여야 합니다.'),
  
  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .isMobilePhone('ko-KR')
    .withMessage('유효한 한국 전화번호를 입력해주세요.'),
  
  body('role')
    .optional()
    .isIn(['parent', 'teacher', 'admin', 'security'])
    .withMessage('유효한 역할을 선택해주세요.'),
  
  handleValidationErrors
];

/**
 * 로그인 유효성 검증
 */
const validateLogin = [
  body('email')
    .isEmail()
    .withMessage('유효한 이메일 주소를 입력해주세요.')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('비밀번호를 입력해주세요.'),
  
  handleValidationErrors
];

/**
 * 민원 등록 유효성 검증
 */
const validateComplaintCreation = [
  body('title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('제목은 5-200자 사이여야 합니다.'),
  
  body('description')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('내용은 10-2000자 사이여야 합니다.'),
  
  body('category')
    .isIn(['facility', 'meal', 'safety', 'education', 'administration', 'bullying', 'academic', 'other'])
    .withMessage('유효한 카테고리를 선택해주세요.'),
  
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('유효한 우선순위를 선택해주세요.'),
  
  body('anonymous')
    .optional()
    .isBoolean()
    .withMessage('익명 여부는 true/false여야 합니다.'),
  
  handleValidationErrors
];

/**
 * 방문 예약 유효성 검증
 */
const validateVisitReservation = [
  body('visitor_name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('방문자 이름은 2-50자 사이여야 합니다.'),
  
  body('visitor_phone')
    .isMobilePhone('ko-KR')
    .withMessage('유효한 한국 전화번호를 입력해주세요.'),
  
  body('visit_date')
    .isISO8601()
    .withMessage('유효한 날짜 형식을 입력해주세요.')
    .custom((value) => {
      const visitDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (visitDate < today) {
        throw new Error('과거 날짜는 선택할 수 없습니다.');
      }
      
      return true;
    }),
  
  body('visit_time')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('유효한 시간 형식(HH:MM)을 입력해주세요.'),
  
  body('purpose')
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('방문 목적은 5-500자 사이여야 합니다.'),
  
  body('visitor_count')
    .isInt({ min: 1, max: 10 })
    .withMessage('방문자 수는 1-10명 사이여야 합니다.'),
  
  handleValidationErrors
];

/**
 * 사용자 업데이트 유효성 검증
 */
const validateUserUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('이름은 2-50자 사이여야 합니다.'),
  
  body('phone')
    .optional()
    .isMobilePhone('ko-KR')
    .withMessage('유효한 한국 전화번호를 입력해주세요.'),
  
  body('profile_image')
    .optional()
    .isURL()
    .withMessage('유효한 프로필 이미지 URL을 입력해주세요.'),
  
  handleValidationErrors
];

/**
 * 비밀번호 변경 유효성 검증
 */
const validatePasswordChange = [
  body('currentPassword')
    .notEmpty()
    .withMessage('현재 비밀번호를 입력해주세요.'),
  
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
];

/**
 * 페이지네이션 쿼리 유효성 검증
 */
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('페이지 번호는 1 이상이어야 합니다.'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('페이지 크기는 1-100 사이여야 합니다.'),
  
  query('sort')
    .optional()
    .isIn(['created_at', 'updated_at', 'title', 'status', 'priority'])
    .withMessage('유효한 정렬 필드를 선택해주세요.'),
  
  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('정렬 순서는 asc 또는 desc여야 합니다.'),
  
  handleValidationErrors
];

/**
 * ID 파라미터 유효성 검증
 */
const validateIdParam = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('유효한 ID 형식이 아닙니다.'),
  
  handleValidationErrors
];

/**
 * 검색 쿼리 유효성 검증
 */
const validateSearch = [
  query('q')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('검색어는 1-100자 사이여야 합니다.'),
  
  query('category')
    .optional()
    .isIn(['facility', 'meal', 'safety', 'education', 'administration', 'bullying', 'academic', 'other'])
    .withMessage('유효한 카테고리를 선택해주세요.'),
  
  query('status')
    .optional()
    .isIn(['submitted', 'in_progress', 'resolved', 'closed'])
    .withMessage('유효한 상태를 선택해주세요.'),
  
  handleValidationErrors
];

/**
 * 체크인/체크아웃 유효성 검증
 */
const validateCheckInOut = [
  body('reservation_id')
    .isUUID()
    .withMessage('유효한 예약 ID를 입력해주세요.'),
  
  body('qr_code')
    .optional()
    .isLength({ min: 10, max: 200 })
    .withMessage('유효한 QR 코드를 입력해주세요.'),
  
  handleValidationErrors
];

/**
 * 알림 설정 유효성 검증
 */
const validateNotificationSettings = [
  body('email_enabled')
    .optional()
    .isBoolean()
    .withMessage('이메일 알림 설정은 true/false여야 합니다.'),
  
  body('push_enabled')
    .optional()
    .isBoolean()
    .withMessage('푸시 알림 설정은 true/false여야 합니다.'),
  
  body('sms_enabled')
    .optional()
    .isBoolean()
    .withMessage('SMS 알림 설정은 true/false여야 합니다.'),
  
  handleValidationErrors
];

/**
 * 파일 업로드 유효성 검증
 */
const validateFileUpload = (req, res, next) => {
  if (!req.file) {
    return next(createError.badRequest('파일을 선택해주세요.'));
  }

  const allowedTypes = process.env.UPLOAD_ALLOWED_TYPES?.split(',') || [
    'image/jpeg',
    'image/png',
    'image/jpg',
    'application/pdf'
  ];

  if (!allowedTypes.includes(req.file.mimetype)) {
    return next(createError.badRequest('허용되지 않는 파일 형식입니다.'));
  }

  const maxSize = parseInt(process.env.UPLOAD_MAX_SIZE) || 5242880; // 5MB
  if (req.file.size > maxSize) {
    return next(createError.badRequest('파일 크기가 너무 큽니다.'));
  }

  next();
};

/**
 * 날짜 범위 유효성 검증
 */
const validateDateRange = [
  query('start_date')
    .optional()
    .isISO8601()
    .withMessage('유효한 시작 날짜 형식을 입력해주세요.'),
  
  query('end_date')
    .optional()
    .isISO8601()
    .withMessage('유효한 종료 날짜 형식을 입력해주세요.')
    .custom((value, { req }) => {
      if (req.query.start_date && value) {
        const startDate = new Date(req.query.start_date);
        const endDate = new Date(value);
        
        if (endDate < startDate) {
          throw new Error('종료 날짜는 시작 날짜보다 늦어야 합니다.');
        }
      }
      return true;
    }),
  
  handleValidationErrors
];

/**
 * 민원 수정 유효성 검증
 */
const validateComplaintUpdate = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('제목은 5-200자 사이여야 합니다.'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('내용은 10-2000자 사이여야 합니다.'),
  
  body('category')
    .optional()
    .isIn(['facility', 'meal', 'safety', 'education', 'administration', 'bullying', 'academic', 'other'])
    .withMessage('유효한 카테고리를 선택해주세요.'),
  
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('유효한 우선순위를 선택해주세요.'),
  
  body('anonymous')
    .optional()
    .isBoolean()
    .withMessage('익명 여부는 true/false여야 합니다.'),
  
  handleValidationErrors
];

/**
 * 민원 상태 변경 유효성 검증
 */
const validateComplaintStatusUpdate = [
  body('status')
    .isIn(['submitted', 'in_progress', 'resolved', 'closed'])
    .withMessage('유효한 상태를 선택해주세요.'),
  
  body('assigned_to')
    .optional()
    .isInt({ min: 1 })
    .withMessage('유효한 담당자 ID를 입력해주세요.'),
  
  body('response')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('응답 내용은 2000자를 초과할 수 없습니다.'),
  
  handleValidationErrors
];

/**
 * 민원 댓글 추가 유효성 검증
 */
const validateComplaintComment = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('댓글 내용은 1-1000자 사이여야 합니다.'),
  
  body('is_internal')
    .optional()
    .isBoolean()
    .withMessage('내부 댓글 여부는 true/false여야 합니다.'),
  
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateUserRegistration,
  validateLogin,
  validateComplaintCreation,
  validateComplaintUpdate,
  validateComplaintStatusUpdate,
  validateComplaintComment,
  validateVisitReservation,
  validateUserUpdate,
  validatePasswordChange,
  validatePagination,
  validateIdParam,
  validateSearch,
  validateCheckInOut,
  validateNotificationSettings,
  validateFileUpload,
  validateDateRange
};