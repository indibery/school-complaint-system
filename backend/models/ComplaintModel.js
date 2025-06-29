/**
 * 📝 민원 모델
 * 
 * @description 민원 데이터 액세스 레이어
 */

const { query, transaction, buildPaginationQuery, buildSearchCondition } = require('../utils/database');
const { createError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

class ComplaintModel {
  /**
   * 민원 생성
   */
  static async create(complaintData) {
    try {
      const {
        user_id,
        title,
        description,
        category,
        priority = 'medium',
        anonymous = false
      } = complaintData;

      const result = await query(`
        INSERT INTO complaints (user_id, title, description, category, priority, anonymous, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'submitted')
        RETURNING id, user_id, title, description, category, status, priority, anonymous, 
                  attachments, created_at, updated_at
      `, [user_id, title, description, category, priority, anonymous]);

      return result.rows[0];
    } catch (error) {
      logger.error('민원 생성 오류:', error);
      throw error;
    }
  }

  /**
   * 민원 목록 조회 (페이지네이션, 필터링, 검색 지원)
   */
  static async findAll(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        userId = null,
        status = null,
        category = null,
        priority = null,
        search = null,
        anonymous = null,
        sortBy = 'created_at',
        sortOrder = 'DESC',
        userRole = 'parent'
      } = options;
      let baseQuery = `
        SELECT c.id, c.user_id, c.title, c.description, c.category, c.status, c.priority, 
               c.anonymous, c.attachments, c.assigned_to, c.response, c.created_at, c.updated_at, c.resolved_at,
               u.name as user_name, u.email as user_email,
               assigned_user.name as assigned_name
        FROM complaints c
        LEFT JOIN users u ON c.user_id = u.id
        LEFT JOIN users assigned_user ON c.assigned_to = assigned_user.id
        WHERE 1=1
      `;

      const queryParams = [];
      let paramIndex = 1;

      // 권한별 필터링
      if (userRole === 'parent' && userId) {
        // 학부모는 본인 민원만 조회 가능
        baseQuery += ` AND c.user_id = $${paramIndex}`;
        queryParams.push(userId);
        paramIndex++;
      }

      // 필터 조건 추가
      if (status) {
        baseQuery += ` AND c.status = $${paramIndex}`;
        queryParams.push(status);
        paramIndex++;
      }

      if (category) {
        baseQuery += ` AND c.category = $${paramIndex}`;
        queryParams.push(category);
        paramIndex++;
      }

      if (priority) {
        baseQuery += ` AND c.priority = $${paramIndex}`;
        queryParams.push(priority);
        paramIndex++;
      }

      if (anonymous !== null) {
        baseQuery += ` AND c.anonymous = $${paramIndex}`;
        queryParams.push(anonymous);
        paramIndex++;
      }
      // 검색 조건 추가
      if (search) {
        const searchCondition = buildSearchCondition(search, ['c.title', 'c.description']);
        if (searchCondition.condition) {
          baseQuery += ` AND ${searchCondition.condition}`;
          queryParams.push(...searchCondition.params.map(param => `%${search}%`));
        }
      }

      // 페이지네이션 쿼리 생성
      const paginationQuery = buildPaginationQuery(
        baseQuery,
        page,
        limit,
        `c.${sortBy}`,
        sortOrder
      );

      // 전체 개수 조회
      const countResult = await query(paginationQuery.countQuery, queryParams);
      const total = parseInt(countResult.rows[0].count);

      // 데이터 조회
      const dataResult = await query(
        paginationQuery.query,
        [...queryParams, ...paginationQuery.params]
      );

      return {
        complaints: dataResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('민원 목록 조회 오류:', error);
      throw error;
    }
  }
  /**
   * ID로 민원 조회
   */
  static async findById(id, userRole = 'parent', userId = null) {
    try {
      let query_text = `
        SELECT c.id, c.user_id, c.title, c.description, c.category, c.status, c.priority, 
               c.anonymous, c.attachments, c.assigned_to, c.response, c.created_at, c.updated_at, c.resolved_at,
               u.name as user_name, u.email as user_email,
               assigned_user.name as assigned_name
        FROM complaints c
        LEFT JOIN users u ON c.user_id = u.id
        LEFT JOIN users assigned_user ON c.assigned_to = assigned_user.id
        WHERE c.id = $1
      `;

      const queryParams = [id];

      // 학부모는 본인 민원만 조회 가능
      if (userRole === 'parent' && userId) {
        query_text += ` AND c.user_id = $2`;
        queryParams.push(userId);
      }

      const result = await query(query_text, queryParams);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('민원 조회 오류:', error);
      throw error;
    }
  }

  /**
   * 민원 수정
   */
  static async update(id, updateData, userRole = 'parent', userId = null) {
    try {
      // 권한 확인
      const complaint = await this.findById(id, userRole, userId);
      if (!complaint) {
        throw createError.notFound('민원을 찾을 수 없습니다.');
      }

      // 학부모는 본인 민원만 수정 가능, 그리고 submitted 상태만 수정 가능
      if (userRole === 'parent') {
        if (complaint.user_id !== userId) {
          throw createError.forbidden('본인의 민원만 수정할 수 있습니다.');
        }
        if (complaint.status !== 'submitted') {
          throw createError.badRequest('처리 중인 민원은 수정할 수 없습니다.');
        }
      }
      const fields = [];
      const values = [];
      let paramIndex = 1;

      // 동적 쿼리 생성
      const allowedFields = ['title', 'description', 'category', 'priority', 'anonymous'];
      Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key) && updateData[key] !== undefined) {
          fields.push(`${key} = $${paramIndex}`);
          values.push(updateData[key]);
          paramIndex++;
        }
      });

      if (fields.length === 0) {
        throw createError.badRequest('수정할 데이터가 없습니다.');
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const result = await query(`
        UPDATE complaints 
        SET ${fields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, user_id, title, description, category, status, priority, anonymous, 
                  attachments, created_at, updated_at
      `, values);

      return result.rows[0] || null;
    } catch (error) {
      logger.error('민원 수정 오류:', error);
      throw error;
    }
  }

  /**
   * 민원 삭제 (소프트 삭제)
   */
  static async delete(id, userRole = 'parent', userId = null) {
    try {
      // 권한 확인
      const complaint = await this.findById(id, userRole, userId);
      if (!complaint) {
        throw createError.notFound('민원을 찾을 수 없습니다.');
      }

      // 학부모는 본인 민원만 삭제 가능, 그리고 submitted 상태만 삭제 가능
      if (userRole === 'parent') {
        if (complaint.user_id !== userId) {
          throw createError.forbidden('본인의 민원만 삭제할 수 있습니다.');
        }
        if (complaint.status !== 'submitted') {
          throw createError.badRequest('처리 중인 민원은 삭제할 수 없습니다.');
        }
      }
      // 실제 삭제 대신 상태를 'closed'로 변경하여 소프트 삭제 구현
      const result = await query(`
        UPDATE complaints 
        SET status = 'closed', updated_at = NOW()
        WHERE id = $1
        RETURNING id, status, updated_at
      `, [id]);

      return result.rows[0] || null;
    } catch (error) {
      logger.error('민원 삭제 오류:', error);
      throw error;
    }
  }

  /**
   * 민원 상태 변경 (교사/관리자만)
   */
  static async updateStatus(id, status, assignedTo = null, response = null, changedBy) {
    try {
      return await transaction(async (client) => {
        // 기존 민원 정보 조회
        const complaintResult = await client.query(
          'SELECT id, status, assigned_to FROM complaints WHERE id = $1',
          [id]
        );

        if (complaintResult.rows.length === 0) {
          throw createError.notFound('민원을 찾을 수 없습니다.');
        }

        const oldComplaint = complaintResult.rows[0];
        const updateFields = ['status = $2', 'updated_at = NOW()'];
        const updateValues = [id, status];
        let paramIndex = 3;

        // 담당자 지정
        if (assignedTo !== null) {
          updateFields.push(`assigned_to = $${paramIndex}`);
          updateValues.push(assignedTo);
          paramIndex++;
        }

        // 응답 내용
        if (response !== null) {
          updateFields.push(`response = $${paramIndex}`);
          updateValues.push(response);
          paramIndex++;
        }

        // 해결 완료 시간 설정
        if (status === 'resolved') {
          updateFields.push('resolved_at = NOW()');
        }

        // 민원 업데이트
        const updateResult = await client.query(`
          UPDATE complaints 
          SET ${updateFields.join(', ')}
          WHERE id = $1
          RETURNING id, user_id, title, description, category, status, priority, anonymous, 
                    assigned_to, response, created_at, updated_at, resolved_at
        `, updateValues);
        // 히스토리 기록
        if (oldComplaint.status !== status) {
          await client.query(`
            INSERT INTO complaint_history (complaint_id, changed_by, field_name, old_value, new_value, change_reason)
            VALUES ($1, $2, 'status', $3, $4, $5)
          `, [id, changedBy, oldComplaint.status, status, '상태 변경']);
        }

        if (assignedTo !== null && oldComplaint.assigned_to !== assignedTo) {
          await client.query(`
            INSERT INTO complaint_history (complaint_id, changed_by, field_name, old_value, new_value, change_reason)
            VALUES ($1, $2, 'assigned_to', $3, $4, $5)
          `, [id, changedBy, oldComplaint.assigned_to, assignedTo, '담당자 변경']);
        }

        return updateResult.rows[0];
      });
    } catch (error) {
      logger.error('민원 상태 변경 오류:', error);
      throw error;
    }
  }

  /**
   * 민원 통계 조회
   */
  static async getStats(filters = {}) {
    try {
      const { userId = null, userRole = 'admin', startDate = null, endDate = null } = filters;

      let whereClause = 'WHERE 1=1';
      const queryParams = [];
      let paramIndex = 1;

      // 권한별 필터링
      if (userRole === 'parent' && userId) {
        whereClause += ` AND user_id = $${paramIndex}`;
        queryParams.push(userId);
        paramIndex++;
      }

      // 날짜 필터
      if (startDate) {
        whereClause += ` AND created_at >= $${paramIndex}`;
        queryParams.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        whereClause += ` AND created_at <= $${paramIndex}`;
        queryParams.push(endDate);
        paramIndex++;
      }
      const result = await query(`
        SELECT 
          COUNT(*) as total_complaints,
          COUNT(CASE WHEN status = 'submitted' THEN 1 END) as submitted_count,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_count,
          COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_count,
          COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_count,
          COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority_count,
          COUNT(CASE WHEN priority = 'medium' THEN 1 END) as medium_priority_count,
          COUNT(CASE WHEN priority = 'low' THEN 1 END) as low_priority_count,
          COUNT(CASE WHEN anonymous = true THEN 1 END) as anonymous_count,
          COUNT(CASE WHEN category = 'facility' THEN 1 END) as facility_count,
          COUNT(CASE WHEN category = 'meal' THEN 1 END) as meal_count,
          COUNT(CASE WHEN category = 'safety' THEN 1 END) as safety_count,
          COUNT(CASE WHEN category = 'education' THEN 1 END) as education_count,
          COUNT(CASE WHEN category = 'administration' THEN 1 END) as administration_count,
          COUNT(CASE WHEN category = 'other' THEN 1 END) as other_count,
          AVG(CASE WHEN resolved_at IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (resolved_at - created_at))/3600 END) as avg_resolution_hours
        FROM complaints ${whereClause}
      `, queryParams);

      return result.rows[0];
    } catch (error) {
      logger.error('민원 통계 조회 오류:', error);
      throw error;
    }
  }

  /**
   * 민원 첨부파일 추가
   */
  static async addAttachment(complaintId, attachmentData) {
    try {
      const { filename, original_name, file_path, file_size, mime_type, uploaded_by } = attachmentData;

      const result = await query(`
        INSERT INTO complaint_attachments (complaint_id, filename, original_name, file_path, file_size, mime_type, uploaded_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, complaint_id, filename, original_name, file_size, mime_type, created_at
      `, [complaintId, filename, original_name, file_path, file_size, mime_type, uploaded_by]);

      return result.rows[0];
    } catch (error) {
      logger.error('민원 첨부파일 추가 오류:', error);
      throw error;
    }
  }
  /**
   * 민원 첨부파일 목록 조회
   */
  static async getAttachments(complaintId) {
    try {
      const result = await query(`
        SELECT id, complaint_id, filename, original_name, file_size, mime_type, created_at
        FROM complaint_attachments
        WHERE complaint_id = $1
        ORDER BY created_at DESC
      `, [complaintId]);

      return result.rows;
    } catch (error) {
      logger.error('민원 첨부파일 조회 오류:', error);
      throw error;
    }
  }

  /**
   * 민원 댓글 추가
   */
  static async addComment(complaintId, commentData) {
    try {
      const { user_id, content, is_internal = false } = commentData;

      const result = await query(`
        INSERT INTO complaint_comments (complaint_id, user_id, content, is_internal)
        VALUES ($1, $2, $3, $4)
        RETURNING id, complaint_id, user_id, content, is_internal, created_at, updated_at
      `, [complaintId, user_id, content, is_internal]);

      return result.rows[0];
    } catch (error) {
      logger.error('민원 댓글 추가 오류:', error);
      throw error;
    }
  }

  /**
   * 민원 댓글 목록 조회
   */
  static async getComments(complaintId, userRole = 'parent') {
    try {
      let whereClause = 'WHERE cc.complaint_id = $1';
      
      // 학부모는 내부 댓글 조회 불가
      if (userRole === 'parent') {
        whereClause += ' AND cc.is_internal = false';
      }

      const result = await query(`
        SELECT cc.id, cc.complaint_id, cc.user_id, cc.content, cc.is_internal, 
               cc.created_at, cc.updated_at,
               u.name as user_name, u.role as user_role
        FROM complaint_comments cc
        LEFT JOIN users u ON cc.user_id = u.id
        ${whereClause}
        ORDER BY cc.created_at ASC
      `, [complaintId]);

      return result.rows;
    } catch (error) {
      logger.error('민원 댓글 조회 오류:', error);
      throw error;
    }
  }
  /**
   * 민원 히스토리 조회
   */
  static async getHistory(complaintId) {
    try {
      const result = await query(`
        SELECT ch.id, ch.complaint_id, ch.changed_by, ch.field_name, ch.old_value, 
               ch.new_value, ch.change_reason, ch.created_at,
               u.name as changed_by_name, u.role as changed_by_role
        FROM complaint_history ch
        LEFT JOIN users u ON ch.changed_by = u.id
        WHERE ch.complaint_id = $1
        ORDER BY ch.created_at DESC
      `, [complaintId]);

      return result.rows;
    } catch (error) {
      logger.error('민원 히스토리 조회 오류:', error);
      throw error;
    }
  }

  /**
   * CSV 내보내기용 데이터 조회
   */
  static async findAllForExport(filters = {}) {
    try {
      const { startDate = null, endDate = null, status = null, category = null } = filters;

      let whereClause = 'WHERE 1=1';
      const queryParams = [];
      let paramIndex = 1;

      if (startDate) {
        whereClause += ` AND c.created_at >= $${paramIndex}`;
        queryParams.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        whereClause += ` AND c.created_at <= $${paramIndex}`;
        queryParams.push(endDate);
        paramIndex++;
      }

      if (status) {
        whereClause += ` AND c.status = $${paramIndex}`;
        queryParams.push(status);
        paramIndex++;
      }

      if (category) {
        whereClause += ` AND c.category = $${paramIndex}`;
        queryParams.push(category);
        paramIndex++;
      }
      const result = await query(`
        SELECT c.id, c.title, c.description, c.category, c.status, c.priority, 
               c.anonymous, c.created_at, c.updated_at, c.resolved_at,
               CASE WHEN c.anonymous THEN '익명' ELSE u.name END as user_name,
               assigned_user.name as assigned_name,
               c.response
        FROM complaints c
        LEFT JOIN users u ON c.user_id = u.id
        LEFT JOIN users assigned_user ON c.assigned_to = assigned_user.id
        ${whereClause}
        ORDER BY c.created_at DESC
      `, queryParams);

      return result.rows;
    } catch (error) {
      logger.error('민원 내보내기 데이터 조회 오류:', error);
      throw error;
    }
  }
}

module.exports = ComplaintModel;