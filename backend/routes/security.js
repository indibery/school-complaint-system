/**
 * 🚪 교문 관리 라우터
 * 
 * @description 교문 지킴이 및 방문자 체크인/아웃 관련 API 엔드포인트
 */

const express = require('express');
const { authenticateToken, requireSecurity, requireTeacher } = require('../middleware/auth');
const { 
  validateCheckInOut, 
  validateIdParam, 
  validatePagination,
  validateDateRange
} = require('../middleware/validation');
const securityController = require('../controllers/securityController');

const router = express.Router();

/**
 * @route   GET /api/security/visitors/current
 * @desc    현재 교내 체류 중인 방문자 목록
 * @access  Private (Security+)
 */
router.get('/visitors/current', 
  authenticateToken, 
  requireSecurity, 
  securityController.getCurrentVisitors
);

/**
 * @route   GET /api/security/visitors/today
 * @desc    오늘 방문 예정자 목록
 * @access  Private (Security+)
 */
router.get('/visitors/today', 
  authenticateToken, 
  requireSecurity, 
  securityController.getTodayVisitors
);

/**
 * @route   POST /api/security/checkin
 * @desc    방문자 체크인 (QR코드 스캔)
 * @access  Private (Security+)
 */
router.post('/checkin', 
  authenticateToken, 
  requireSecurity,
  validateCheckInOut, 
  securityController.checkInVisitor
);

/**
 * @route   POST /api/security/checkout
 * @desc    방문자 체크아웃
 * @access  Private (Security+)
 */
router.post('/checkout', 
  authenticateToken, 
  requireSecurity,
  validateCheckInOut, 
  securityController.checkOutVisitor
);

/**
 * @route   POST /api/security/qr/validate
 * @desc    QR코드 유효성 검증
 * @access  Private (Security+)
 */
router.post('/qr/validate', 
  authenticateToken, 
  requireSecurity, 
  securityController.validateQRCode
);

/**
 * @route   GET /api/security/stats/today
 * @desc    오늘 방문자 통계
 * @access  Private (Security+)
 */
router.get('/stats/today', 
  authenticateToken, 
  requireSecurity, 
  securityController.getTodayStats
);

/**
 * @route   GET /api/security/stats/period
 * @desc    기간별 방문자 통계
 * @access  Private (Teacher+)
 */
router.get('/stats/period', 
  authenticateToken, 
  requireTeacher, 
  validateDateRange,
  securityController.getPeriodStats
);

/**
 * @route   GET /api/security/history
 * @desc    방문자 출입 기록 조회
 * @access  Private (Security+)
 */
router.get('/history', 
  authenticateToken, 
  requireSecurity, 
  validatePagination,
  validateDateRange,
  securityController.getVisitHistory
);

/**
 * @route   GET /api/security/alerts
 * @desc    보안 알림 목록 (장시간 체류자, 예약 없는 방문자 등)
 * @access  Private (Security+)
 */
router.get('/alerts', 
  authenticateToken, 
  requireSecurity, 
  securityController.getSecurityAlerts
);

/**
 * @route   POST /api/security/alerts/:id/resolve
 * @desc    보안 알림 해결 처리
 * @access  Private (Security+)
 */
router.post('/alerts/:id/resolve', 
  authenticateToken, 
  requireSecurity,
  validateIdParam, 
  securityController.resolveSecurityAlert
);

/**
 * @route   GET /api/security/dashboard
 * @desc    교문 지킴이 대시보드 데이터
 * @access  Private (Security+)
 */
router.get('/dashboard', 
  authenticateToken, 
  requireSecurity, 
  securityController.getSecurityDashboard
);

/**
 * @route   POST /api/security/emergency/lockdown
 * @desc    비상 상황 교문 폐쇄
 * @access  Private (Security+)
 */
router.post('/emergency/lockdown', 
  authenticateToken, 
  requireSecurity, 
  securityController.emergencyLockdown
);

/**
 * @route   POST /api/security/emergency/unlock
 * @desc    비상 상황 해제
 * @access  Private (Security+)
 */
router.post('/emergency/unlock', 
  authenticateToken, 
  requireSecurity, 
  securityController.emergencyUnlock
);

/**
 * @route   GET /api/security/reports/daily
 * @desc    일일 보안 보고서 생성
 * @access  Private (Security+)
 */
router.get('/reports/daily', 
  authenticateToken, 
  requireTeacher, 
  securityController.generateDailyReport
);

/**
 * @route   GET /api/security/export/csv
 * @desc    방문자 출입 기록 CSV 내보내기
 * @access  Private (Teacher+)
 */
router.get('/export/csv', 
  authenticateToken, 
  requireTeacher, 
  validateDateRange,
  securityController.exportSecurityCSV
);

module.exports = router;