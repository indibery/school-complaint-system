/**
 * 📅 방문 예약 라우터
 * 
 * @description 방문 예약 관리 관련 API 엔드포인트
 */

const express = require('express');
const { authenticateToken, requireTeacher, requireAdmin } = require('../middleware/auth');
const { 
  validateVisitReservation, 
  validateIdParam, 
  validatePagination,
  validateDateRange
} = require('../middleware/validation');
const visitController = require('../controllers/visitController');

const router = express.Router();

/**
 * @route   GET /api/visits
 * @desc    방문 예약 목록 조회 (본인 예약 또는 권한에 따른 전체 예약)
 * @access  Private
 */
router.get('/', 
  authenticateToken, 
  validatePagination,
  validateDateRange,
  visitController.getVisits
);

/**
 * @route   POST /api/visits
 * @desc    방문 예약 등록
 * @access  Private
 */
router.post('/', 
  authenticateToken, 
  validateVisitReservation, 
  visitController.createVisit
);

/**
 * @route   GET /api/visits/:id
 * @desc    방문 예약 상세 조회
 * @access  Private
 */
router.get('/:id', 
  authenticateToken, 
  validateIdParam, 
  visitController.getVisitById
);

/**
 * @route   PUT /api/visits/:id
 * @desc    방문 예약 수정 (본인 예약만, 승인 전에만 가능)
 * @access  Private
 */
router.put('/:id', 
  authenticateToken, 
  validateIdParam, 
  visitController.updateVisit
);

/**
 * @route   DELETE /api/visits/:id
 * @desc    방문 예약 취소 (본인 예약만)
 * @access  Private
 */
router.delete('/:id', 
  authenticateToken, 
  validateIdParam, 
  visitController.cancelVisit
);

/**
 * @route   PUT /api/visits/:id/approve
 * @desc    방문 예약 승인 (교사/관리자만)
 * @access  Private (Teacher+)
 */
router.put('/:id/approve', 
  authenticateToken, 
  requireTeacher,
  validateIdParam, 
  visitController.approveVisit
);

/**
 * @route   PUT /api/visits/:id/reject
 * @desc    방문 예약 거부 (교사/관리자만)
 * @access  Private (Teacher+)
 */
router.put('/:id/reject', 
  authenticateToken, 
  requireTeacher,
  validateIdParam, 
  visitController.rejectVisit
);

/**
 * @route   GET /api/visits/:id/qr
 * @desc    방문 예약 QR코드 조회 (승인된 예약만)
 * @access  Private
 */
router.get('/:id/qr', 
  authenticateToken, 
  validateIdParam, 
  visitController.getVisitQR
);

/**
 * @route   POST /api/visits/:id/regenerate-qr
 * @desc    방문 예약 QR코드 재생성
 * @access  Private
 */
router.post('/:id/regenerate-qr', 
  authenticateToken, 
  validateIdParam, 
  visitController.regenerateQR
);

/**
 * @route   GET /api/visits/calendar/availability
 * @desc    날짜별 예약 가능 시간 조회
 * @access  Private
 */
router.get('/calendar/availability', 
  authenticateToken, 
  visitController.getAvailableSlots
);

/**
 * @route   GET /api/visits/today/schedule
 * @desc    오늘 방문 예정자 조회 (교사/관리자만)
 * @access  Private (Teacher+)
 */
router.get('/today/schedule', 
  authenticateToken, 
  requireTeacher, 
  visitController.getTodaySchedule
);

/**
 * @route   GET /api/visits/stats/overview
 * @desc    방문 예약 통계 조회 (교사/관리자만)
 * @access  Private (Teacher+)
 */
router.get('/stats/overview', 
  authenticateToken, 
  requireTeacher, 
  visitController.getVisitStats
);

/**
 * @route   POST /api/visits/bulk/approve
 * @desc    방문 예약 일괄 승인 (관리자만)
 * @access  Private (Admin)
 */
router.post('/bulk/approve', 
  authenticateToken, 
  requireAdmin, 
  visitController.bulkApproveVisits
);

/**
 * @route   GET /api/visits/export/csv
 * @desc    방문 예약 데이터 CSV 내보내기 (관리자만)
 * @access  Private (Admin)
 */
router.get('/export/csv', 
  authenticateToken, 
  requireAdmin, 
  visitController.exportVisitsCSV
);

module.exports = router;