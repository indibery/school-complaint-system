-- =====================================================
-- 관리자용 사용자 관리 관련 테이블
-- Admin User Management Tables
-- =====================================================

-- 관리자 작업 로그 테이블
CREATE TABLE IF NOT EXISTS admin_actions (
    id BIGSERIAL PRIMARY KEY,
    admin_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 관리자 작업 로그 인덱스
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_id ON admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target_user_id ON admin_actions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_action ON admin_actions(action);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created_at ON admin_actions(created_at);

-- 보안 로그 테이블 (이미 있을 수 있지만 확인)
CREATE TABLE IF NOT EXISTS security_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 보안 로그 인덱스
CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_action ON security_logs(action);
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON security_logs(created_at);

-- 사용자 권한 변경 이력 테이블
CREATE TABLE IF NOT EXISTS user_role_history (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    old_role VARCHAR(20),
    new_role VARCHAR(20) NOT NULL,
    changed_by BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 권한 변경 이력 인덱스
CREATE INDEX IF NOT EXISTS idx_user_role_history_user_id ON user_role_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_history_changed_by ON user_role_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_user_role_history_created_at ON user_role_history(created_at);

-- 사용자 상태 변경 이력 테이블
CREATE TABLE IF NOT EXISTS user_status_history (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    old_status BOOLEAN,
    new_status BOOLEAN NOT NULL,
    changed_by BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 상태 변경 이력 인덱스
CREATE INDEX IF NOT EXISTS idx_user_status_history_user_id ON user_status_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_status_history_changed_by ON user_status_history(changed_by);

-- 관리자 대시보드용 종합 통계 뷰
CREATE OR REPLACE VIEW admin_dashboard_stats AS
SELECT 
    -- 사용자 통계
    (SELECT COUNT(*) FROM users WHERE is_active = true) as total_active_users,
    (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '30 days') as new_users_30d,
    (SELECT COUNT(*) FROM users WHERE last_login_at >= NOW() - INTERVAL '7 days') as active_users_7d,
    (SELECT COUNT(*) FROM users WHERE locked_until > NOW()) as locked_users,
    
    -- 민원 통계
    (SELECT COUNT(*) FROM complaints WHERE is_active = true) as total_complaints,
    (SELECT COUNT(*) FROM complaints WHERE created_at >= NOW() - INTERVAL '30 days' AND is_active = true) as new_complaints_30d,
    (SELECT COUNT(*) FROM complaints WHERE status = 'pending' AND is_active = true) as pending_complaints,
    
    -- 관리자 활동 통계
    (SELECT COUNT(*) FROM admin_actions WHERE created_at >= NOW() - INTERVAL '30 days') as admin_actions_30d,
    (SELECT COUNT(DISTINCT admin_id) FROM admin_actions WHERE created_at >= NOW() - INTERVAL '7 days') as active_admins_7d,
    
    -- 시스템 통계
    NOW() as generated_at;

-- 사용자 활동 분석 뷰
CREATE OR REPLACE VIEW user_activity_analysis AS
SELECT 
    u.id,
    u.email,
    u.name,
    u.role,
    u.created_at,
    u.last_login_at,
    u.is_active,
    
    -- 활동 레벨
    CASE 
        WHEN u.last_login_at IS NULL THEN 'never_logged_in'
        WHEN u.last_login_at >= NOW() - INTERVAL '7 days' THEN 'highly_active'
        WHEN u.last_login_at >= NOW() - INTERVAL '30 days' THEN 'moderately_active'
        WHEN u.last_login_at >= NOW() - INTERVAL '90 days' THEN 'low_active'
        ELSE 'inactive'
    END as activity_level,
    
    -- 활동 지표
    COALESCE(c.complaint_count, 0) as complaint_count,
    COALESCE(v.visit_count, 0) as visit_count,
    COALESCE(c.recent_complaints, 0) as recent_complaints,
    
    -- 계정 상태
    CASE 
        WHEN u.locked_until > NOW() THEN 'locked'
        WHEN u.is_active = false THEN 'inactive'
        WHEN u.email_verified = false THEN 'unverified'
        ELSE 'normal'
    END as account_status,
    
    -- 위험도 점수 (간단한 계산)
    CASE 
        WHEN u.login_attempts >= 3 THEN 'high_risk'
        WHEN u.login_attempts >= 1 THEN 'medium_risk'
        ELSE 'low_risk'
    END as risk_level

FROM users u
LEFT JOIN (
    SELECT 
        user_id,
        COUNT(*) as complaint_count,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as recent_complaints
    FROM complaints 
    WHERE is_active = true
    GROUP BY user_id
) c ON u.id = c.user_id
LEFT JOIN (
    SELECT 
        user_id,
        COUNT(*) as visit_count
    FROM visits 
    GROUP BY user_id
) v ON u.id = v.user_id;

-- 관리자 작업 통계 뷰
CREATE OR REPLACE VIEW admin_action_summary AS
SELECT 
    a.admin_id,
    au.name as admin_name,
    au.email as admin_email,
    COUNT(*) as total_actions,
    COUNT(CASE WHEN a.created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as actions_7d,
    COUNT(CASE WHEN a.created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as actions_30d,
    COUNT(CASE WHEN a.action = 'PASSWORD_RESET' THEN 1 END) as password_resets,
    COUNT(CASE WHEN a.action = 'USER_UPDATE' THEN 1 END) as user_updates,
    COUNT(CASE WHEN a.action = 'USER_DELETE' THEN 1 END) as user_deletions,
    COUNT(CASE WHEN a.action = 'UNLOCK_ACCOUNT' THEN 1 END) as account_unlocks,
    MAX(a.created_at) as last_action_at
FROM admin_actions a
JOIN users au ON a.admin_id = au.id
GROUP BY a.admin_id, au.name, au.email
ORDER BY total_actions DESC;

-- 트리거 함수: 역할 변경 이력 자동 기록
CREATE OR REPLACE FUNCTION log_role_change()
RETURNS TRIGGER AS $$
BEGIN
    -- 역할이 변경된 경우에만 기록
    IF OLD.role != NEW.role THEN
        INSERT INTO user_role_history (user_id, old_role, new_role, changed_by, created_at)
        VALUES (NEW.id, OLD.role, NEW.role, 
                COALESCE(current_setting('app.current_admin_id', true)::bigint, NEW.id),
                CURRENT_TIMESTAMP);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 함수: 상태 변경 이력 자동 기록
CREATE OR REPLACE FUNCTION log_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- 활성 상태가 변경된 경우에만 기록
    IF OLD.is_active != NEW.is_active THEN
        INSERT INTO user_status_history (user_id, old_status, new_status, changed_by, created_at)
        VALUES (NEW.id, OLD.is_active, NEW.is_active,
                COALESCE(current_setting('app.current_admin_id', true)::bigint, NEW.id),
                CURRENT_TIMESTAMP);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_log_role_change ON users;
CREATE TRIGGER trigger_log_role_change
    AFTER UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION log_role_change();

DROP TRIGGER IF EXISTS trigger_log_status_change ON users;
CREATE TRIGGER trigger_log_status_change
    AFTER UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION log_status_change();

-- 코멘트 추가
COMMENT ON TABLE admin_actions IS '관리자 작업 로그';
COMMENT ON COLUMN admin_actions.admin_id IS '작업을 수행한 관리자 ID';
COMMENT ON COLUMN admin_actions.target_user_id IS '작업 대상 사용자 ID';
COMMENT ON COLUMN admin_actions.action IS '수행된 작업 유형';
COMMENT ON COLUMN admin_actions.details IS '작업 상세 내용';

COMMENT ON TABLE security_logs IS '보안 관련 로그';
COMMENT ON COLUMN security_logs.action IS '보안 작업 유형 (LOGIN_SUCCESS, LOGIN_FAILED 등)';

COMMENT ON TABLE user_role_history IS '사용자 역할 변경 이력';
COMMENT ON TABLE user_status_history IS '사용자 상태 변경 이력';

COMMENT ON VIEW admin_dashboard_stats IS '관리자 대시보드용 종합 통계';
COMMENT ON VIEW user_activity_analysis IS '사용자 활동 분석 데이터';
COMMENT ON VIEW admin_action_summary IS '관리자별 작업 통계 요약';
