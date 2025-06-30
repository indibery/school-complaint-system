-- =====================================================
-- 사용자 관리 API를 위한 테이블 확장
-- User Management API Schema Extension
-- =====================================================

-- 사용자 테이블에 프로필 및 설정 관련 컬럼 추가
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS profile_image VARCHAR(255),
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS sms_notifications BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'ko',
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Asia/Seoul';

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);
CREATE INDEX IF NOT EXISTS idx_users_profile_image ON users(profile_image);

-- 코멘트 추가
COMMENT ON COLUMN users.profile_image IS '프로필 이미지 파일 경로';
COMMENT ON COLUMN users.email_verified IS '이메일 인증 여부';
COMMENT ON COLUMN users.email_notifications IS '이메일 알림 설정';
COMMENT ON COLUMN users.sms_notifications IS 'SMS 알림 설정';
COMMENT ON COLUMN users.language IS '사용자 언어 설정 (ko, en)';
COMMENT ON COLUMN users.timezone IS '사용자 시간대 설정';

-- 기존 사용자들의 email_verified를 true로 설정 (이미 등록된 사용자들)
UPDATE users 
SET email_verified = true 
WHERE email_verified IS NULL OR email_verified = false;

-- 역할(role) 체크 제약조건 업데이트 (기존: parent, teacher, admin, security)
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('parent', 'teacher', 'admin', 'security', 'user'));

-- 언어 설정 체크 제약조건 추가
ALTER TABLE users 
ADD CONSTRAINT users_language_check 
CHECK (language IN ('ko', 'en'));

-- 시간대 설정 체크 제약조건 추가
ALTER TABLE users 
ADD CONSTRAINT users_timezone_check 
CHECK (timezone IN ('Asia/Seoul', 'UTC'));

-- 사용자 프로필 통계 뷰 생성
CREATE OR REPLACE VIEW user_profile_stats AS
SELECT 
    u.id,
    u.email,
    u.name,
    u.role,
    u.is_active,
    u.email_verified,
    u.profile_image IS NOT NULL as has_profile_image,
    u.created_at,
    u.last_login_at,
    COUNT(c.id) as total_complaints,
    COUNT(CASE WHEN c.status = 'pending' THEN 1 END) as pending_complaints,
    COUNT(CASE WHEN c.status = 'resolved' THEN 1 END) as resolved_complaints,
    COUNT(CASE WHEN c.created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as recent_complaints
FROM users u
LEFT JOIN complaints c ON u.id = c.user_id AND c.is_active = true
WHERE u.is_active = true
GROUP BY u.id, u.email, u.name, u.role, u.is_active, u.email_verified, u.profile_image, u.created_at, u.last_login_at;

-- 관리자용 사용자 관리 뷰
CREATE OR REPLACE VIEW admin_user_overview AS
SELECT 
    u.id,
    u.email,
    u.name,
    u.phone,
    u.role,
    u.is_active,
    u.email_verified,
    u.profile_image IS NOT NULL as has_avatar,
    u.email_notifications,
    u.sms_notifications,
    u.language,
    u.timezone,
    u.created_at,
    u.updated_at,
    u.last_login_at,
    COUNT(c.id) as complaint_count,
    COUNT(CASE WHEN c.created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as recent_activity
FROM users u
LEFT JOIN complaints c ON u.id = c.user_id AND c.is_active = true
GROUP BY u.id, u.email, u.name, u.phone, u.role, u.is_active, u.email_verified, 
         u.profile_image, u.email_notifications, u.sms_notifications, u.language, 
         u.timezone, u.created_at, u.updated_at, u.last_login_at
ORDER BY u.created_at DESC;

COMMENT ON VIEW user_profile_stats IS '사용자 프로필 및 활동 통계 뷰';
COMMENT ON VIEW admin_user_overview IS '관리자용 사용자 종합 관리 뷰';
