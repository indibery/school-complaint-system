-- =====================================================
-- 계정 설정 및 삭제 관련 테이블 확장
-- Account Settings and Deletion Extensions
-- =====================================================

-- 사용자 테이블에 추가 설정 컬럼
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS privacy_level VARCHAR(20) DEFAULT 'public',
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- 제약조건 추가
ALTER TABLE users 
ADD CONSTRAINT users_privacy_level_check 
CHECK (privacy_level IN ('public', 'private', 'friends'));

-- 계정 삭제 로그 테이블 생성
CREATE TABLE IF NOT EXISTS account_deletion_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL,
    deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 계정 삭제 로그 인덱스
CREATE INDEX IF NOT EXISTS idx_account_deletion_logs_user_id ON account_deletion_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_account_deletion_logs_deleted_at ON account_deletion_logs(deleted_at);
CREATE INDEX IF NOT EXISTS idx_account_deletion_logs_email ON account_deletion_logs(email);

-- 사용자 설정 변경 로그 테이블 (선택사항)
CREATE TABLE IF NOT EXISTS user_settings_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    setting_name VARCHAR(50) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT
);

-- 설정 변경 로그 인덱스
CREATE INDEX IF NOT EXISTS idx_user_settings_logs_user_id ON user_settings_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_logs_changed_at ON user_settings_logs(changed_at);
CREATE INDEX IF NOT EXISTS idx_user_settings_logs_setting_name ON user_settings_logs(setting_name);

-- 방문 예약 테이블에 취소 관련 컬럼 추가 (계정 삭제 시 사용)
ALTER TABLE visits 
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- 코멘트 추가
COMMENT ON COLUMN users.privacy_level IS '개인정보 보호 수준 (public, private, friends)';
COMMENT ON COLUMN users.two_factor_enabled IS '2단계 인증 활성화 여부';
COMMENT ON COLUMN users.deleted_at IS '계정 삭제 시간';

COMMENT ON TABLE account_deletion_logs IS '계정 삭제 이력 로그';
COMMENT ON COLUMN account_deletion_logs.user_id IS '삭제된 사용자 ID';
COMMENT ON COLUMN account_deletion_logs.email IS '삭제 시점의 이메일';
COMMENT ON COLUMN account_deletion_logs.name IS '삭제 시점의 이름';
COMMENT ON COLUMN account_deletion_logs.role IS '삭제 시점의 역할';
COMMENT ON COLUMN account_deletion_logs.ip_address IS '삭제 요청 IP 주소';
COMMENT ON COLUMN account_deletion_logs.user_agent IS '삭제 요청 사용자 에이전트';

COMMENT ON TABLE user_settings_logs IS '사용자 설정 변경 이력';
COMMENT ON COLUMN user_settings_logs.setting_name IS '변경된 설정 이름';
COMMENT ON COLUMN user_settings_logs.old_value IS '이전 값';
COMMENT ON COLUMN user_settings_logs.new_value IS '새 값';

-- 계정 삭제 관련 뷰
CREATE OR REPLACE VIEW deleted_accounts_summary AS
SELECT 
    DATE(deleted_at) as deletion_date,
    COUNT(*) as deleted_count,
    ARRAY_AGG(DISTINCT role) as deleted_roles
FROM account_deletion_logs
WHERE deleted_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(deleted_at)
ORDER BY deletion_date DESC;

-- 사용자 설정 통계 뷰
CREATE OR REPLACE VIEW user_settings_stats AS
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN email_notifications = true THEN 1 END) as email_notifications_enabled,
    COUNT(CASE WHEN sms_notifications = true THEN 1 END) as sms_notifications_enabled,
    COUNT(CASE WHEN two_factor_enabled = true THEN 1 END) as two_factor_enabled,
    COUNT(CASE WHEN language = 'ko' THEN 1 END) as korean_users,
    COUNT(CASE WHEN language = 'en' THEN 1 END) as english_users,
    COUNT(CASE WHEN privacy_level = 'public' THEN 1 END) as public_privacy,
    COUNT(CASE WHEN privacy_level = 'private' THEN 1 END) as private_privacy,
    COUNT(CASE WHEN privacy_level = 'friends' THEN 1 END) as friends_privacy
FROM users
WHERE is_active = true;

COMMENT ON VIEW deleted_accounts_summary IS '최근 30일 계정 삭제 요약';
COMMENT ON VIEW user_settings_stats IS '사용자 설정 통계';
