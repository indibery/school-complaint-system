/**
 * 📝 민원 컨트롤러
 * 
 * @description 민원 관리 관련 비즈니스 로직
 */

const { asyncHandler, createError } = require('../middleware/errorHandler');
const ComplaintModel = require('../models/ComplaintModel');
const logger = require('../utils/logger');

/**
 * @desc    민원 목록 조회
 * @route   GET /api/complaints
 * @access  Private
 */
const getComplaints = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status,
    category,
    priority,
    search,
    anonymous,
    sort = 'created_at',
    order = 'desc'
  } = req.query;

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    userId: req.user.id,
    userRole: req.user.role,
    status,
    category,
    priority,
    search,
    anonymous: anonymous ? (anonymous === 'true') : null,
    sortBy: sort,
    sortOrder: order.toUpperCase()
  };

  logger.info('민원 목록 조회 요청:', { 
    userId: req.user.id, 
    userRole: req.user.role,
    options 
  });
  
  try {
    const result = await ComplaintModel.findAll(options);
    
    res.json({
      success: true,
      message: '민원 목록 조회 성공',
      data: {
        complaints: result.complaints,
        pagination: result.pagination,
        filters: {
          status,
          category,
          priority,
          search,
          anonymous
        }
      }
    });
  } catch (error) {
    logger.error('민원 목록 조회 오류:', error);
    throw createError.internalServerError('민원 목록 조회 중 오류가 발생했습니다.');
  }
});

/**
 * @desc    민원 등록
 * @route   POST /api/complaints
 * @access  Private
 */
const createComplaint = asyncHandler(async (req, res) => {
  const { title, description, category, priority = 'medium', anonymous = false } = req.body;
  
  logger.info('민원 등록 요청:', { 
    userId: req.user.id, 
    title, 
    category, 
    priority, 
    anonymous 
  });

  try {
    // 민원 데이터 준비
    const complaintData = {
      user_id: req.user.id,
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      anonymous
    };

    // 민원 생성
    const complaint = await ComplaintModel.create(complaintData);

    logger.info('민원 등록 성공:', { 
      complaintId: complaint.id, 
      userId: req.user.id 
    });

    res.status(201).json({
      success: true,
      message: '민원이 성공적으로 등록되었습니다.',
      data: {
        complaint: {
          id: complaint.id,
          title: complaint.title,
          description: complaint.description,
          category: complaint.category,
          status: complaint.status,
          priority: complaint.priority,
          anonymous: complaint.anonymous,
          created_at: complaint.created_at,
          updated_at: complaint.updated_at
        }
      }
    });
  } catch (error) {
    logger.error('민원 등록 오류:', error);
    
    // 데이터베이스 제약조건 오류 처리
    if (error.code === '23505') { // Unique constraint violation
      throw createError.conflict('이미 동일한 민원이 존재합니다.');
    }
    
    if (error.code === '23503') { // Foreign key constraint violation
      throw createError.badRequest('유효하지 않은 사용자 정보입니다.');
    }
    
    throw createError.internalServerError('민원 등록 중 오류가 발생했습니다.');
  }
});

/**
 * @desc    민원 상세 조회
 * @route   GET /api/complaints/:id
 * @access  Private
 */
const getComplaintById = asyncHandler(async (req, res) => {
  // TODO: 민원 상세 조회 로직 구현
  const { id } = req.params;
  
  res.json({
    success: true,
    message: '민원 상세 조회 (구현 예정)',
    data: {
      complaint: {
        id,
        title: '샘플 민원',
        description: '구현 예정',
        status: 'pending'
      }
    }
  });
});

/**
 * @desc    민원 수정
 * @route   PUT /api/complaints/:id
 * @access  Private
 */
const updateComplaint = asyncHandler(async (req, res) => {
  // TODO: 민원 수정 로직 구현
  const { id } = req.params;
  
  res.json({
    success: true,
    message: '민원 수정 (구현 예정)',
    data: {
      complaint: {
        id,
        ...req.body,
        updated_at: new Date().toISOString()
      }
    }
  });
});

/**
 * @desc    민원 삭제
 * @route   DELETE /api/complaints/:id
 * @access  Private
 */
const deleteComplaint = asyncHandler(async (req, res) => {
  // TODO: 민원 삭제 로직 구현
  const { id } = req.params;
  
  res.json({
    success: true,
    message: '민원 삭제 (구현 예정)'
  });
});

/**
 * @desc    민원 상태 변경
 * @route   PATCH /api/complaints/:id/status
 * @access  Private (Teacher+)
 */
const updateComplaintStatus = asyncHandler(async (req, res) => {
  // TODO: 민원 상태 변경 로직 구현
  res.json({
    success: true,
    message: '민원 상태 변경 (구현 예정)'
  });
});

/**
 * @desc    민원 댓글 추가
 * @route   POST /api/complaints/:id/comment
 * @access  Private (Teacher+)
 */
const addComplaintComment = asyncHandler(async (req, res) => {
  // TODO: 민원 댓글 추가 로직 구현
  res.json({
    success: true,
    message: '민원 댓글 추가 (구현 예정)'
  });
});

/**
 * @desc    민원 댓글 목록 조회
 * @route   GET /api/complaints/:id/comments
 * @access  Private
 */
const getComplaintComments = asyncHandler(async (req, res) => {
  // TODO: 민원 댓글 목록 조회 로직 구현
  res.json({
    success: true,
    message: '민원 댓글 목록 조회 (구현 예정)',
    data: { comments: [] }
  });
});

/**
 * @desc    민원 첨부파일 추가
 * @route   POST /api/complaints/:id/attachment
 * @access  Private
 */
const addComplaintAttachment = asyncHandler(async (req, res) => {
  // TODO: 민원 첨부파일 추가 로직 구현
  res.json({
    success: true,
    message: '민원 첨부파일 추가 (구현 예정)'
  });
});

/**
 * @desc    민원 통계 조회
 * @route   GET /api/complaints/stats/overview
 * @access  Private (Teacher+)
 */
const getComplaintStats = asyncHandler(async (req, res) => {
  // TODO: 민원 통계 조회 로직 구현
  res.json({
    success: true,
    message: '민원 통계 조회 (구현 예정)',
    data: {
      stats: {
        total: 0,
        pending: 0,
        in_progress: 0,
        resolved: 0,
        closed: 0
      }
    }
  });
});

/**
 * @desc    민원 데이터 CSV 내보내기
 * @route   GET /api/complaints/export/csv
 * @access  Private (Admin)
 */
const exportComplaintsCSV = asyncHandler(async (req, res) => {
  // TODO: 민원 데이터 CSV 내보내기 로직 구현
  res.json({
    success: true,
    message: '민원 데이터 CSV 내보내기 (구현 예정)'
  });
});

module.exports = {
  getComplaints,
  createComplaint,
  getComplaintById,
  updateComplaint,
  deleteComplaint,
  updateComplaintStatus,
  addComplaintComment,
  getComplaintComments,
  addComplaintAttachment,
  getComplaintStats,
  exportComplaintsCSV
};