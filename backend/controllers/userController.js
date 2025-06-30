/**
 * 👤 사용자 관리 컨트롤러
 * 
 * @description 사용자 프로필, 설정, 통계 관련 비즈니스 로직
 */

const { pool, query } = require('../utils/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');
const { promisify } = require('util');
const { 
  validatePasswordStrength, 
  checkPasswordChangeFrequency 
} = require('../utils/passwordSecurity');

/**
 * 📋 내 프로필 조회
 * @route GET /api/users/profile
 */
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await query(
      `SELECT id, email, name, phone, role, is_active, email_verified, 
              profile_image, created_at, updated_at,
              email_notifications, sms_notifications, language, timezone
       FROM users 
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    const user = result.rows[0];
    
    // 비밀번호 해시는 제외하고 반환
    delete user.password_hash;
    
    res.json({
      success: true,
      data: {
        user: user
      }
    });

  } catch (error) {
    console.error('프로필 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '프로필 조회 중 오류가 발생했습니다.'
    });
  }
};

/**
 * ✏️ 프로필 수정
 * @route PUT /api/users/profile
 */
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, phone } = req.body;
    
    // 수정할 필드만 동적 쿼리 생성
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(phone);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: '수정할 정보를 입력해주세요.'
      });
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);
    
    const updateQuery = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`;
    
    await query(updateQuery, values);
    
    // 수정된 프로필 조회
    const result = await query(
      `SELECT id, email, name, phone, role, profile_image, updated_at
       FROM users WHERE id = $1`,
      [userId]
    );
    
    res.json({
      success: true,
      message: '프로필이 성공적으로 수정되었습니다.',
      data: {
        user: result.rows[0]
      }
    });

  } catch (error) {
    console.error('프로필 수정 오류:', error);
    res.status(500).json({
      success: false,
      message: '프로필 수정 중 오류가 발생했습니다.'
    });
  }
};

/**
 * 🔒 비밀번호 변경 (보안 강화 버전)
 * @route PUT /api/users/password
 */
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;
    
    // 현재 사용자 정보 및 보안 상태 확인
    const userResult = await query(
      `SELECT password_hash, token_version, login_attempts, locked_until, email 
       FROM users WHERE id = $1`,
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }
    
    const user = userResult.rows[0];
    
    // 계정 잠금 상태 확인
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(423).json({
        success: false,
        message: '계정이 일시적으로 잠겨있습니다. 나중에 다시 시도해주세요.'
      });
    }
    
    // 현재 비밀번호 검증
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    
    if (!isCurrentPasswordValid) {
      // 실패 시도 횟수 증가
      await query(
        `UPDATE users 
         SET login_attempts = login_attempts + 1,
             locked_until = CASE 
               WHEN login_attempts >= 4 THEN NOW() + INTERVAL '15 minutes'
               ELSE NULL 
             END
         WHERE id = $1`,
        [userId]
      );
      
      return res.status(400).json({
        success: false,
        message: '현재 비밀번호가 올바르지 않습니다.'
      });
    }
    
    // 비밀번호 변경 빈도 제한 확인
    const canChangePassword = await checkPasswordChangeFrequency(userId, 1);
    if (!canChangePassword) {
      return res.status(429).json({
        success: false,
        message: '비밀번호는 1시간에 한 번만 변경할 수 있습니다.'
      });
    }
    
    // 새 비밀번호 강도 검증
    const passwordStrength = validatePasswordStrength(newPassword);
    if (!passwordStrength.isValid) {
      return res.status(400).json({
        success: false,
        message: '비밀번호가 보안 요구사항을 만족하지 않습니다.',
        errors: passwordStrength.errors,
        suggestions: passwordStrength.suggestions
      });
    }
    
    // 새 비밀번호와 현재 비밀번호 동일성 검사
    const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: '새 비밀번호는 현재 비밀번호와 달라야 합니다.'
      });
    }
    
    // 트랜잭션으로 비밀번호 변경 및 보안 설정 업데이트
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 새 비밀번호 해시화
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
      
      // 비밀번호 및 토큰 버전 업데이트 (모든 기존 토큰 무효화)
      await client.query(
        `UPDATE users 
         SET password_hash = $1, 
             token_version = token_version + 1,
             login_attempts = 0,
             locked_until = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [newPasswordHash, userId]
      );
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        message: '비밀번호가 성공적으로 변경되었습니다. 보안을 위해 모든 기기에서 다시 로그인해주세요.'
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('비밀번호 변경 오류:', error);
    res.status(500).json({
      success: false,
      message: '비밀번호 변경 중 오류가 발생했습니다.'
    });
  }
};

/**
 * ⚙️ 계정 설정 변경 (향상된 버전)
 * @route PUT /api/users/settings
 */
const updateSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      email_notifications, 
      sms_notifications, 
      language, 
      timezone,
      privacy_level,
      two_factor_enabled 
    } = req.body;
    
    // 현재 사용자 설정 조회
    const currentUserResult = await query(
      `SELECT email_notifications, sms_notifications, language, timezone, 
              privacy_level, two_factor_enabled 
       FROM users WHERE id = $1`,
      [userId]
    );
    
    if (currentUserResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }
    
    const currentSettings = currentUserResult.rows[0];
    
    // 설정 필드만 동적 쿼리 생성
    const updates = [];
    const values = [];
    const changes = [];
    let paramIndex = 1;
    
    if (email_notifications !== undefined && email_notifications !== currentSettings.email_notifications) {
      updates.push(`email_notifications = $${paramIndex++}`);
      values.push(email_notifications);
      changes.push(`이메일 알림: ${email_notifications ? '활성화' : '비활성화'}`);
    }
    
    if (sms_notifications !== undefined && sms_notifications !== currentSettings.sms_notifications) {
      updates.push(`sms_notifications = $${paramIndex++}`);
      values.push(sms_notifications);
      changes.push(`SMS 알림: ${sms_notifications ? '활성화' : '비활성화'}`);
    }
    
    if (language !== undefined && language !== currentSettings.language) {
      updates.push(`language = $${paramIndex++}`);
      values.push(language);
      changes.push(`언어: ${language}`);
    }
    
    if (timezone !== undefined && timezone !== currentSettings.timezone) {
      updates.push(`timezone = $${paramIndex++}`);
      values.push(timezone);
      changes.push(`시간대: ${timezone}`);
    }
    
    if (privacy_level !== undefined && privacy_level !== currentSettings.privacy_level) {
      updates.push(`privacy_level = $${paramIndex++}`);
      values.push(privacy_level);
      changes.push(`개인정보 보호 수준: ${privacy_level}`);
    }
    
    if (two_factor_enabled !== undefined && two_factor_enabled !== currentSettings.two_factor_enabled) {
      updates.push(`two_factor_enabled = $${paramIndex++}`);
      values.push(two_factor_enabled);
      changes.push(`2단계 인증: ${two_factor_enabled ? '활성화' : '비활성화'}`);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: '변경할 설정을 선택해주세요.'
      });
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);
    
    const updateQuery = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`;
    
    await query(updateQuery, values);
    
    // 변경된 설정 조회
    const updatedSettingsResult = await query(
      `SELECT email_notifications, sms_notifications, language, timezone, 
              privacy_level, two_factor_enabled, updated_at
       FROM users WHERE id = $1`,
      [userId]
    );
    
    res.json({
      success: true,
      message: '계정 설정이 성공적으로 변경되었습니다.',
      data: {
        settings: updatedSettingsResult.rows[0],
        changes: changes
      }
    });

  } catch (error) {
    console.error('설정 변경 오류:', error);
    res.status(500).json({
      success: false,
      message: '설정 변경 중 오류가 발생했습니다.'
    });
  }
};

/**
 * 🗑️ 계정 삭제 (향상된 안전 버전)
 * @route DELETE /api/users/account
 */
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { password, confirmation } = req.body;
    
    // 필수 확인 문구 검증
    if (confirmation !== 'DELETE_MY_ACCOUNT') {
      return res.status(400).json({
        success: false,
        message: '계정 삭제를 확인하기 위해 "DELETE_MY_ACCOUNT"를 정확히 입력해주세요.'
      });
    }
    
    // 사용자 정보 및 보안 상태 확인
    const userResult = await query(
      `SELECT password_hash, email, name, role, created_at,
              (SELECT COUNT(*) FROM complaints WHERE user_id = $1 AND is_active = true) as active_complaints
       FROM users WHERE id = $1`,
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }
    
    const user = userResult.rows[0];
    
    // 관리자 계정 삭제 방지
    if (user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: '관리자 계정은 직접 삭제할 수 없습니다. 시스템 관리자에게 문의하세요.'
      });
    }
    
    // 비밀번호 확인
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: '비밀번호가 올바르지 않습니다.'
      });
    }
    
    // 계정 생성 후 24시간 이내 삭제 방지 (오작동 방지)
    const accountAge = new Date() - new Date(user.created_at);
    const hoursSinceCreation = accountAge / (1000 * 60 * 60);
    
    if (hoursSinceCreation < 24) {
      return res.status(429).json({
        success: false,
        message: '계정 생성 후 24시간이 지나야 삭제할 수 있습니다.'
      });
    }
    
    // 트랜잭션으로 안전하게 처리
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const deletedTimestamp = Math.floor(Date.now() / 1000);
      
      // 1. 사용자 계정 비활성화 (Soft Delete)
      await client.query(
        `UPDATE users 
         SET is_active = false, 
             email = $1, 
             name = 'Deleted User',
             phone = NULL,
             profile_image = NULL,
             email_notifications = false,
             sms_notifications = false,
             updated_at = CURRENT_TIMESTAMP,
             deleted_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [
          `deleted_user_${userId}_${deletedTimestamp}@deleted.local`,
          userId
        ]
      );
      
      // 2. 관련 데이터 처리
      // 민원 비활성화
      await client.query(
        'UPDATE complaints SET is_active = false WHERE user_id = $1',
        [userId]
      );
      
      // 방문 예약 취소
      await client.query(
        `UPDATE visits 
         SET status = 'cancelled', 
             cancellation_reason = '계정 삭제로 인한 자동 취소'
         WHERE user_id = $1 AND status IN ('pending', 'approved')`,
        [userId]
      );
      
      // 토큰 무효화 (모든 세션 종료)
      await client.query(
        'UPDATE users SET token_version = token_version + 1 WHERE id = $1',
        [userId]
      );
      
      // 3. 계정 삭제 로그 기록
      await client.query(
        `INSERT INTO account_deletion_logs 
         (user_id, email, name, role, deleted_at, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6)`,
        [
          userId,
          user.email,
          user.name,
          user.role,
          req.ip || req.connection.remoteAddress || 'unknown',
          req.get('User-Agent') || 'unknown'
        ]
      );
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        message: '계정이 성공적으로 삭제되었습니다. 그동안 서비스를 이용해 주셔서 감사합니다.',
        data: {
          deleted_at: new Date().toISOString(),
          data_retention_info: '개인정보는 법적 보관 기간에 따라 처리됩니다.'
        }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('계정 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '계정 삭제 중 오류가 발생했습니다.'
    });
  }
};

/**
 * 📊 사용자 통계 조회
 * @route GET /api/users/stats
 */
const getUserStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 사용자의 민원 통계
    const complaintResult = await query(`
      SELECT 
        COUNT(*) as total_complaints,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_complaints,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_complaints,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_complaints,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_complaints,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as recent_complaints
      FROM complaints 
      WHERE user_id = $1 AND is_active = true
    `, [userId]);
    
    // 계정 정보
    const userResult = await query(`
      SELECT 
        created_at,
        EXTRACT(day FROM AGE(CURRENT_DATE, created_at::date)) as days_since_registration,
        email_verified,
        last_login_at
      FROM users 
      WHERE id = $1
    `, [userId]);
    
    const userInfo = userResult.rows[0];
    const complaintStats = complaintResult.rows[0];
    
    res.json({
      success: true,
      data: {
        user_stats: {
          account: {
            days_since_registration: Math.floor(userInfo?.days_since_registration || 0),
            email_verified: userInfo?.email_verified || false,
            last_login: userInfo?.last_login_at
          },
          complaints: {
            total_complaints: parseInt(complaintStats.total_complaints) || 0,
            pending_complaints: parseInt(complaintStats.pending_complaints) || 0,
            in_progress_complaints: parseInt(complaintStats.in_progress_complaints) || 0,
            resolved_complaints: parseInt(complaintStats.resolved_complaints) || 0,
            closed_complaints: parseInt(complaintStats.closed_complaints) || 0,
            recent_complaints: parseInt(complaintStats.recent_complaints) || 0
          }
        }
      }
    });

  } catch (error) {
    console.error('사용자 통계 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '통계 조회 중 오류가 발생했습니다.'
    });
  }
};

/**
 * 📷 프로필 이미지 업로드
 * @route POST /api/users/upload-avatar
 */
const uploadAvatar = async (req, res) => {
  try {
    const userId = req.user.id;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '업로드할 이미지 파일을 선택해주세요.'
      });
    }
    
    const avatarPath = `/uploads/avatars/${req.file.filename}`;
    
    // 기존 프로필 이미지 삭제 (선택사항)
    const currentUserResult = await query(
      'SELECT profile_image FROM users WHERE id = $1',
      [userId]
    );
    
    if (currentUserResult.rows[0]?.profile_image) {
      const oldImagePath = path.join(__dirname, '../../', currentUserResult.rows[0].profile_image);
      try {
        await fs.unlink(oldImagePath);
      } catch (err) {
        // 기존 파일 삭제 실패는 무시
        console.log('기존 프로필 이미지 삭제 실패:', err.message);
      }
    }
    
    // 데이터베이스 업데이트
    await query(
      'UPDATE users SET profile_image = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [avatarPath, userId]
    );
    
    res.json({
      success: true,
      message: '프로필 이미지가 성공적으로 업로드되었습니다.',
      data: {
        profile_image: avatarPath
      }
    });

  } catch (error) {
    console.error('프로필 이미지 업로드 오류:', error);
    
    // 업로드된 파일 삭제 (오류 발생 시)
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (err) {
        console.error('임시 파일 삭제 실패:', err);
      }
    }
    
    res.status(500).json({
      success: false,
      message: '프로필 이미지 업로드 중 오류가 발생했습니다.'
    });
  }
};

// =================================
// 🔧 관리자용 사용자 관리 함수들
// =================================

/**
 * 👥 모든 사용자 목록 조회 (관리자용)
 * @route GET /api/users/admin/users
 */
const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const role = req.query.role || '';
    const status = req.query.status || '';
    
    // 조건부 WHERE 절 구성
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;
    
    if (search) {
      whereConditions.push(`(name ILIKE $${paramIndex} OR email ILIKE $${paramIndex + 1})`);
      queryParams.push(`%${search}%`, `%${search}%`);
      paramIndex += 2;
    }
    
    if (role) {
      whereConditions.push(`role = $${paramIndex}`);
      queryParams.push(role);
      paramIndex++;
    }
    
    if (status === 'active') {
      whereConditions.push('is_active = true');
    } else if (status === 'inactive') {
      whereConditions.push('is_active = false');
    }
    
    const whereClause = whereConditions.length > 0 ? 
      `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // 총 사용자 수 조회
    const countResult = await query(
      `SELECT COUNT(*) as total FROM users ${whereClause}`,
      queryParams
    );
    
    // 사용자 목록 조회
    const usersResult = await query(`
      SELECT 
        id, email, name, phone, role, is_active, email_verified, 
        profile_image, created_at, updated_at,
        (SELECT COUNT(*) FROM complaints WHERE user_id = users.id AND is_active = true) as complaint_count
      FROM users 
      ${whereClause}
      ORDER BY created_at DESC 
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...queryParams, limit, offset]);
    
    const totalUsers = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalUsers / limit);
    
    res.json({
      success: true,
      data: {
        users: usersResult.rows,
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_users: totalUsers,
          per_page: limit
        }
      }
    });

  } catch (error) {
    console.error('사용자 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '사용자 목록 조회 중 오류가 발생했습니다.'
    });
  }
};

/**
 * ✏️ 사용자 정보 수정 (관리자용)
 * @route PUT /api/users/admin/users/:id
 */
const updateUserById = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const { name, email, role, is_active } = req.body;
    
    // 대상 사용자 존재 확인
    const existingUserResult = await query(
      'SELECT id, email FROM users WHERE id = $1',
      [targetUserId]
    );
    
    if (existingUserResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }
    
    // 이메일 중복 확인 (변경되는 경우)
    if (email && email !== existingUserResult.rows[0].email) {
      const emailCheckResult = await query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, targetUserId]
      );
      
      if (emailCheckResult.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: '이미 사용 중인 이메일 주소입니다.'
        });
      }
    }
    
    // 수정할 필드만 동적 쿼리 생성
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    
    if (email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(email);
    }
    
    if (role !== undefined) {
      updates.push(`role = $${paramIndex++}`);
      values.push(role);
    }
    
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(is_active);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: '수정할 정보를 입력해주세요.'
      });
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(targetUserId);
    
    const updateQuery = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`;
    
    await query(updateQuery, values);
    
    // 수정된 사용자 정보 조회
    const updatedUserResult = await query(`
      SELECT id, email, name, phone, role, is_active, email_verified, 
             profile_image, created_at, updated_at
      FROM users WHERE id = $1
    `, [targetUserId]);
    
    res.json({
      success: true,
      message: '사용자 정보가 성공적으로 수정되었습니다.',
      data: {
        user: updatedUserResult.rows[0]
      }
    });

  } catch (error) {
    console.error('사용자 정보 수정 오류:', error);
    res.status(500).json({
      success: false,
      message: '사용자 정보 수정 중 오류가 발생했습니다.'
    });
  }
};

/**
 * 🗑️ 사용자 삭제 (관리자용)
 * @route DELETE /api/users/admin/users/:id
 */
const deleteUserById = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user.id;
    
    // 자기 자신은 삭제할 수 없음
    if (targetUserId == currentUserId) {
      return res.status(400).json({
        success: false,
        message: '자기 자신의 계정은 삭제할 수 없습니다.'
      });
    }
    
    // 대상 사용자 존재 확인
    const existingUserResult = await query(
      'SELECT id, name, email FROM users WHERE id = $1',
      [targetUserId]
    );
    
    if (existingUserResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }
    
    const existingUser = existingUserResult.rows[0];
    
    // 트랜잭션으로 처리
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Soft delete 방식으로 사용자 비활성화
      await client.query(`
        UPDATE users 
        SET is_active = false, 
            email = email || '_deleted_' || EXTRACT(epoch FROM NOW())::text, 
            updated_at = CURRENT_TIMESTAMP 
        WHERE id = $1
      `, [targetUserId]);
      
      // 사용자의 민원도 비활성화
      await client.query(
        'UPDATE complaints SET is_active = false WHERE user_id = $1',
        [targetUserId]
      );
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        message: `사용자 '${existingUser.name}'이 성공적으로 삭제되었습니다.`
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('사용자 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '사용자 삭제 중 오류가 발생했습니다.'
    });
  }
};

// 모든 함수 내보내기
module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  updateSettings,
  deleteAccount,
  getUserStats,
  uploadAvatar,
  getAllUsers,
  updateUserById,
  deleteUserById
};
