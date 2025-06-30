/**
 * 👤 사용자 관리 컨트롤러
 * 
 * @description 사용자 프로필, 설정, 통계 관련 비즈니스 로직
 */

const db = require('../utils/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');
const { promisify } = require('util');

/**
 * 📋 내 프로필 조회
 * @route GET /api/users/profile
 */
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const [rows] = await db.execute(
      `SELECT id, email, name, phone, role, is_active, email_verified, 
              profile_image, created_at, updated_at,
              email_notifications, sms_notifications, language, timezone
       FROM users 
       WHERE id = ?`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    const user = rows[0];
    
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
    
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    
    if (phone !== undefined) {
      updates.push('phone = ?');
      values.push(phone);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: '수정할 정보를 입력해주세요.'
      });
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);
    
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    
    await db.execute(query, values);
    
    // 수정된 프로필 조회
    const [rows] = await db.execute(
      `SELECT id, email, name, phone, role, profile_image, updated_at
       FROM users WHERE id = ?`,
      [userId]
    );
    
    res.json({
      success: true,
      message: '프로필이 성공적으로 수정되었습니다.',
      data: {
        user: rows[0]
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
 * 🔒 비밀번호 변경
 * @route PUT /api/users/password
 */
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;
    
    // 현재 비밀번호 확인
    const [users] = await db.execute(
      'SELECT password_hash FROM users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }
    
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, users[0].password_hash);
    
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: '현재 비밀번호가 올바르지 않습니다.'
      });
    }
    
    // 새 비밀번호 해시화
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
    
    // 비밀번호 업데이트
    await db.execute(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newPasswordHash, userId]
    );
    
    res.json({
      success: true,
      message: '비밀번호가 성공적으로 변경되었습니다.'
    });

  } catch (error) {
    console.error('비밀번호 변경 오류:', error);
    res.status(500).json({
      success: false,
      message: '비밀번호 변경 중 오류가 발생했습니다.'
    });
  }
};

/**
 * ⚙️ 계정 설정 변경
 * @route PUT /api/users/settings
 */
const updateSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { email_notifications, sms_notifications, language, timezone } = req.body;
    
    // 설정 테이블이 없으면 users 테이블에 컬럼 추가 방식 사용
    const updates = [];
    const values = [];
    
    if (email_notifications !== undefined) {
      updates.push('email_notifications = ?');
      values.push(email_notifications);
    }
    
    if (sms_notifications !== undefined) {
      updates.push('sms_notifications = ?');
      values.push(sms_notifications);
    }
    
    if (language !== undefined) {
      updates.push('language = ?');
      values.push(language);
    }
    
    if (timezone !== undefined) {
      updates.push('timezone = ?');
      values.push(timezone);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: '변경할 설정을 선택해주세요.'
      });
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);
    
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    
    await db.execute(query, values);
    
    res.json({
      success: true,
      message: '계정 설정이 성공적으로 변경되었습니다.'
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
 * 🗑️ 계정 삭제
 * @route DELETE /api/users/account
 */
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;
    
    // 비밀번호 확인
    const [users] = await db.execute(
      'SELECT password_hash FROM users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }
    
    const isPasswordValid = await bcrypt.compare(password, users[0].password_hash);
    
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: '비밀번호가 올바르지 않습니다.'
      });
    }
    
    // 트랜잭션 시작
    await db.execute('START TRANSACTION');
    
    try {
      // 관련 데이터 삭제 (soft delete 방식)
      await db.execute(
        'UPDATE users SET is_active = 0, email = CONCAT(email, "_deleted_", UNIX_TIMESTAMP()), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [userId]
      );
      
      // 사용자의 민원도 비활성화
      await db.execute(
        'UPDATE complaints SET is_active = 0 WHERE user_id = ?',
        [userId]
      );
      
      await db.execute('COMMIT');
      
      res.json({
        success: true,
        message: '계정이 성공적으로 삭제되었습니다.'
      });
      
    } catch (error) {
      await db.execute('ROLLBACK');
      throw error;
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
    const [complaintStats] = await db.execute(`
      SELECT 
        COUNT(*) as total_complaints,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_complaints,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_complaints,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_complaints,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_complaints,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as recent_complaints
      FROM complaints 
      WHERE user_id = ? AND is_active = 1
    `, [userId]);
    
    // 계정 정보
    const [userInfo] = await db.execute(`
      SELECT 
        created_at,
        DATEDIFF(CURRENT_DATE, created_at) as days_since_registration,
        email_verified,
        last_login_at
      FROM users 
      WHERE id = ?
    `, [userId]);
    
    res.json({
      success: true,
      data: {
        user_stats: {
          account: {
            days_since_registration: userInfo[0]?.days_since_registration || 0,
            email_verified: userInfo[0]?.email_verified || false,
            last_login: userInfo[0]?.last_login_at
          },
          complaints: complaintStats[0] || {
            total_complaints: 0,
            pending_complaints: 0,
            in_progress_complaints: 0,
            resolved_complaints: 0,
            closed_complaints: 0,
            recent_complaints: 0
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
    const [currentUser] = await db.execute(
      'SELECT profile_image FROM users WHERE id = ?',
      [userId]
    );
    
    if (currentUser[0]?.profile_image) {
      const oldImagePath = path.join(__dirname, '../../', currentUser[0].profile_image);
      try {
        await fs.unlink(oldImagePath);
      } catch (err) {
        // 기존 파일 삭제 실패는 무시
        console.log('기존 프로필 이미지 삭제 실패:', err.message);
      }
    }
    
    // 데이터베이스 업데이트
    await db.execute(
      'UPDATE users SET profile_image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
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
    
    if (search) {
      whereConditions.push('(name LIKE ? OR email LIKE ?)');
      queryParams.push(`%${search}%`, `%${search}%`);
    }
    
    if (role) {
      whereConditions.push('role = ?');
      queryParams.push(role);
    }
    
    if (status === 'active') {
      whereConditions.push('is_active = 1');
    } else if (status === 'inactive') {
      whereConditions.push('is_active = 0');
    }
    
    const whereClause = whereConditions.length > 0 ? 
      `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // 총 사용자 수 조회
    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM users ${whereClause}`,
      queryParams
    );
    
    // 사용자 목록 조회
    const [users] = await db.execute(`
      SELECT 
        id, email, name, phone, role, is_active, email_verified, 
        profile_image, created_at, updated_at,
        (SELECT COUNT(*) FROM complaints WHERE user_id = users.id AND is_active = 1) as complaint_count
      FROM users 
      ${whereClause}
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `, [...queryParams, limit, offset]);
    
    const totalUsers = countResult[0].total;
    const totalPages = Math.ceil(totalUsers / limit);
    
    res.json({
      success: true,
      data: {
        users: users,
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
    const [existingUser] = await db.execute(
      'SELECT id, email FROM users WHERE id = ?',
      [targetUserId]
    );
    
    if (existingUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }
    
    // 이메일 중복 확인 (변경되는 경우)
    if (email && email !== existingUser[0].email) {
      const [emailCheck] = await db.execute(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, targetUserId]
      );
      
      if (emailCheck.length > 0) {
        return res.status(400).json({
          success: false,
          message: '이미 사용 중인 이메일 주소입니다.'
        });
      }
    }
    
    // 수정할 필드만 동적 쿼리 생성
    const updates = [];
    const values = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    
    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email);
    }
    
    if (role !== undefined) {
      updates.push('role = ?');
      values.push(role);
    }
    
    if (is_active !== undefined) {
      updates.push('is_active = ?');
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
    
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    
    await db.execute(query, values);
    
    // 수정된 사용자 정보 조회
    const [updatedUser] = await db.execute(`
      SELECT id, email, name, phone, role, is_active, email_verified, 
             profile_image, created_at, updated_at
      FROM users WHERE id = ?
    `, [targetUserId]);
    
    res.json({
      success: true,
      message: '사용자 정보가 성공적으로 수정되었습니다.',
      data: {
        user: updatedUser[0]
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
    const [existingUser] = await db.execute(
      'SELECT id, name, email FROM users WHERE id = ?',
      [targetUserId]
    );
    
    if (existingUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }
    
    // 트랜잭션 시작
    await db.execute('START TRANSACTION');
    
    try {
      // Soft delete 방식으로 사용자 비활성화
      await db.execute(`
        UPDATE users 
        SET is_active = 0, 
            email = CONCAT(email, '_deleted_', UNIX_TIMESTAMP()), 
            updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [targetUserId]);
      
      // 사용자의 민원도 비활성화
      await db.execute(
        'UPDATE complaints SET is_active = 0 WHERE user_id = ?',
        [targetUserId]
      );
      
      await db.execute('COMMIT');
      
      res.json({
        success: true,
        message: `사용자 '${existingUser[0].name}'이 성공적으로 삭제되었습니다.`
      });
      
    } catch (error) {
      await db.execute('ROLLBACK');
      throw error;
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
