/**
 * 📝 민원 라우터
 * 
 * @description 민원 관리 관련 API 엔드포인트
 */

const express = require('express');
const { authenticateToken, requireTeacher, requireAdmin } = require('../middleware/auth');
const { 
  validateComplaintCreation, 
  validateIdParam, 
  validatePagination,
  validateSearch
} = require('../middleware/validation');
const complaintController = require('../controllers/complaintController');

const router = express.Router();

/**
 * @route   GET /api/complaints
 * @desc    민원 목록 조회 (본인 민원 또는 권한에 따른 전체 민원)
 * @access  Private
 */
router.get('/', 
  authenticateToken, 
  validatePagination,
  validateSearch,
  complaintController.getComplaints
);

/**
 * @route   POST /api/complaints
 * @desc    민원 등록
 * @access  Private
 */
router.post('/', 
  authenticateToken, 
  validateComplaintCreation, 
  complaintController.createComplaint
);

/**
 * @route   GET /api/complaints/:id
 * @desc    민원 상세 조회
 * @access  Private
 */
router.get('/:id', 
  authenticateToken, 
  validateIdParam, 
  complaintController.getComplaintById
);

/**
 * @route   PUT /api/complaints/:id
 * @desc    민원 수정 (본인 민원만)
 * @access  Private
 */
router.put('/:id', 
  authenticateToken, 
  validateIdParam, 
  complaintController.updateComplaint
);

/**
 * @route   DELETE /api/complaints/:id
 * @desc    민원 삭제 (본인 민원만)
 * @access  Private
 */
router.delete('/:id', 
  authenticateToken, 
  validateIdParam, 
  complaintController.deleteComplaint
);

/**
 * @route   PUT /api/complaints/:id/status
 * @desc    민원 상태 변경 (교사/관리자만)
 * @access  Private (Teacher+)
 */
router.put('/:id/status', 
  authenticateToken, 
  requireTeacher,
  validateIdParam, 
  complaintController.updateComplaintStatus
);

/**
 * @route   POST /api/complaints/:id/comment
 * @desc    민원에 댓글 추가 (교사/관리자만)
 * @access  Private (Teacher+)
 */
router.post('/:id/comment', 
  authenticateToken, 
  requireTeacher,
  validateIdParam, 
  complaintController.addComplaintComment
);

/**
 * @route   GET /api/complaints/:id/comments
 * @desc    민원 댓글 목록 조회
 * @access  Private
 */
router.get('/:id/comments', 
  authenticateToken, 
  validateIdParam, 
  complaintController.getComplaintComments
);

/**
 * @route   POST /api/complaints/:id/attachment
 * @desc    민원 첨부파일 추가
 * @access  Private
 */
router.post('/:id/attachment', 
  authenticateToken, 
  validateIdParam, 
  complaintController.addComplaintAttachment
);

/**
 * @route   GET /api/complaints/stats/overview
 * @desc    민원 통계 조회 (교사/관리자만)
 * @access  Private (Teacher+)
 */
router.get('/stats/overview', 
  authenticateToken, 
  requireTeacher, 
  complaintController.getComplaintStats
);

/**
 * @route   GET /api/complaints/export/csv
 * @desc    민원 데이터 CSV 내보내기 (관리자만)
 * @access  Private (Admin)
 */
router.get('/export/csv', 
  authenticateToken, 
  requireAdmin, 
  complaintController.exportComplaintsCSV
);

module.exports = router;