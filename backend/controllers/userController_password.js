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
      
      // 보안 로그 추가 (선택사항)
      await client.query(
        `INSERT INTO security_logs (user_id, action, ip_address, user_agent, created_at)
         VALUES ($1, 'PASSWORD_CHANGED', $2, $3, CURRENT_TIMESTAMP)`,
        [
          userId,
          req.ip || req.connection.remoteAddress || 'unknown',
          req.get('User-Agent') || 'unknown'
        ]
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
