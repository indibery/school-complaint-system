/**
 * 👤 사용자 모델
 * 
 * @description 사용자 데이터 액세스 레이어
 */

const { query, transaction, buildPaginationQuery, buildSearchCondition } = require('../utils/database');
const { createError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

class UserModel {
  /**
   * 사용자 생성
   */
  static async create(userData) {
    try {
      const { email, password_hash, name, phone, role = 'parent' } = userData;
      
      const result = await query(`
        INSERT INTO users (email, password_hash, name, phone, role)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email, name, phone, role, is_active, created_at, updated_at
      `, [email, password_hash, name, phone, role]);

      return result.rows[0];
    } catch (error) {
      logger.error('사용자 생성 오류:', error);
      throw error;
    }
  }

  /**
   * 이메일로 사용자 조회
   */
  static async findByEmail(email) {
    try {
      const result = await query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      logger.error('이메일로 사용자 조회 오류:', error);
      throw error;
    }
  }

  /**
   * ID로 사용자 조회
   */
  static async findById(id) {
    try {
      const result = await query(
        'SELECT id, email, name, phone, role, is_active, profile_image, created_at, updated_at FROM users WHERE id = $1',
        [id]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      logger.error('ID로 사용자 조회 오류:', error);
      throw error;
    }
  }

  /**
   * 사용자 정보 업데이트
   */
  static async update(id, updateData) {
    try {
      const fields = [];
      const values = [];
      let paramIndex = 1;

      // 동적 쿼리 생성
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
          fields.push(`${key} = $${paramIndex}`);
          values.push(updateData[key]);
          paramIndex++;
        }
      });

      if (fields.length === 0) {
        throw createError.badRequest('업데이트할 데이터가 없습니다.');
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const result = await query(`
        UPDATE users 
        SET ${fields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, email, name, phone, role, is_active, profile_image, created_at, updated_at
      `, values);

      return result.rows[0] || null;
    } catch (error) {
      logger.error('사용자 업데이트 오류:', error);
      throw error;
    }
  }

  /**
   * 사용자 목록 조회 (페이지네이션 지원)
   */
  static async findAll(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        role = null,
        search = null,
        isActive = null,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = options;

      let baseQuery = `
        SELECT id, email, name, phone, role, is_active, profile_image, created_at, updated_at
        FROM users WHERE 1=1
      `;
      
      const queryParams = [];
      let paramIndex = 1;

      // 필터 조건 추가
      if (role) {
        baseQuery += ` AND role = $${paramIndex}`;
        queryParams.push(role);
        paramIndex++;
      }

      if (isActive !== null) {
        baseQuery += ` AND is_active = $${paramIndex}`;
        queryParams.push(isActive);
        paramIndex++;
      }

      // 검색 조건 추가
      if (search) {
        const searchCondition = buildSearchCondition(search, ['name', 'email']);
        if (searchCondition.condition) {
          baseQuery += ` AND ${searchCondition.condition}`;
          queryParams.push(...searchCondition.params);
        }
      }

      // 페이지네이션 쿼리 생성
      const paginationQuery = buildPaginationQuery(
        baseQuery,
        page,
        limit,
        sortBy,
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
        users: dataResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('사용자 목록 조회 오류:', error);
      throw error;
    }
  }

  /**
   * 사용자 계정 비활성화
   */
  static async deactivate(id) {
    try {
      const result = await query(
        'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id, email, is_active',
        [id]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('사용자 비활성화 오류:', error);
      throw error;
    }
  }

  /**
   * 사용자 계정 활성화
   */
  static async activate(id) {
    try {
      const result = await query(
        'UPDATE users SET is_active = true, updated_at = NOW() WHERE id = $1 RETURNING id, email, is_active',
        [id]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('사용자 활성화 오류:', error);
      throw error;
    }
  }

  /**
   * 사용자 통계 조회
   */
  static async getStats() {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN role = 'parent' THEN 1 END) as parent_count,
          COUNT(CASE WHEN role = 'teacher' THEN 1 END) as teacher_count,
          COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_count,
          COUNT(CASE WHEN role = 'security' THEN 1 END) as security_count,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_count,
          COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_count,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_users_30d
        FROM users
      `);

      return result.rows[0];
    } catch (error) {
      logger.error('사용자 통계 조회 오류:', error);
      throw error;
    }
  }

  /**
   * 비밀번호 재설정 토큰 저장
   */
  static async setPasswordResetToken(email, token, expires) {
    try {
      const result = await query(
        'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE email = $3 RETURNING id',
        [token, expires, email]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('비밀번호 재설정 토큰 저장 오류:', error);
      throw error;
    }
  }

  /**
   * 비밀번호 재설정 토큰으로 사용자 조회
   */
  static async findByPasswordResetToken(token) {
    try {
      const result = await query(
        'SELECT id, email FROM users WHERE password_reset_token = $1 AND password_reset_expires > NOW()',
        [token]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('비밀번호 재설정 토큰으로 사용자 조회 오류:', error);
      throw error;
    }
  }

  /**
   * 마지막 로그인 시간 업데이트
   */
  static async updateLastLogin(id) {
    try {
      await query(
        'UPDATE users SET last_login_at = NOW() WHERE id = $1',
        [id]
      );
    } catch (error) {
      logger.error('마지막 로그인 시간 업데이트 오류:', error);
      throw error;
    }
  }
}

module.exports = UserModel;