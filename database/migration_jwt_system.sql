-- =====================================================
-- 토큰 블랙리스트 테이블 추가
-- Token Blacklist Table for JWT Management
-- =====================================================

-- 기존 테이블 확장: users 테이블에 token_version 컬럼 추가
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;

-- 토큰 블랙리스트 테이블 생성
CREATE TABLE IF NOT EXISTS token_blacklist (
    id BIGSERIAL PRIMARY KEY,
    token_id VARCHAR(255) UNIQUE NOT NULL,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason VARCHAR(100) NOT NULL DEFAULT 'logout',
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 토큰 블랙리스트 인덱스
CREATE INDEX IF NOT EXISTS idx_token_blacklist_token_id ON token_blacklist(token_id);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_user_id ON token_blacklist(user_id);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires_at ON token_blacklist(expires_at);

-- 사용자 테이블 추가 인덱스
CREATE INDEX IF NOT EXISTS idx_users_token_version ON users(token_version);
CREATE INDEX IF NOT EXISTS idx_users_email_verification ON users(email_verification_token);
CREATE INDEX IF NOT EXISTS idx_users_password_reset ON users(password_reset_token);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at);

-- 자동 정리를 위한 함수 생성 (만료된 블랙리스트 토큰 삭제)
CREATE OR REPLACE FUNCTION cleanup_expired_blacklist_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM token_blacklist WHERE expires_at <= NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 정기적 정리를 위한 뷰 생성 (현재 활성 블랙리스트 토큰)
CREATE OR REPLACE VIEW active_blacklist_tokens AS
SELECT 
    token_id,
    user_id,
    reason,
    expires_at,
    created_at,
    (expires_at - NOW()) AS time_remaining
FROM token_blacklist 
WHERE expires_at > NOW()
ORDER BY expires_at DESC;

-- 사용자 로그인 통계를 위한 뷰
CREATE OR REPLACE VIEW user_login_stats AS
SELECT 
    u.id,
    u.email,
    u.name,
    u.role,
    u.last_login_at,
    u.login_attempts,
    u.locked_until,
    CASE 
        WHEN u.locked_until > NOW() THEN 'locked'
        WHEN u.is_active = false THEN 'inactive'
        ELSE 'active'
    END as account_status,
    COUNT(tbl.id) as blacklisted_tokens_count
FROM users u
LEFT JOIN token_blacklist tbl ON u.id = tbl.user_id AND tbl.expires_at > NOW()
GROUP BY u.id, u.email, u.name, u.role, u.last_login_at, u.login_attempts, u.locked_until, u.is_active;

-- 코멘트 추가
COMMENT ON TABLE token_blacklist IS '무효화된 JWT 토큰 관리 테이블';
COMMENT ON COLUMN token_blacklist.token_id IS 'JWT의 jti 클레임 값';
COMMENT ON COLUMN token_blacklist.reason IS '토큰 무효화 사유 (logout, security, expired 등)';
COMMENT ON COLUMN token_blacklist.expires_at IS '토큰 원래 만료 시간';

COMMENT ON COLUMN users.token_version IS '사용자 토큰 버전 (모든 토큰 무효화시 증가)';
COMMENT ON COLUMN users.email_verification_token IS '이메일 인증 토큰';
COMMENT ON COLUMN users.email_verified_at IS '이메일 인증 완료 시간';
COMMENT ON COLUMN users.password_reset_token IS '비밀번호 재설정 토큰';
COMMENT ON COLUMN users.password_reset_expires IS '비밀번호 재설정 토큰 만료시간';
COMMENT ON COLUMN users.last_login_at IS '마지막 로그인 시간';
COMMENT ON COLUMN users.login_attempts IS '로그인 시도 횟수 (실패시 증가)';
COMMENT ON COLUMN users.locked_until IS '계정 잠금 해제 시간';

-- 샘플 정리 스크립트 (실제 환경에서는 cron job으로 실행)
/*
-- 매일 자정에 만료된 토큰 정리 예시
SELECT cleanup_expired_blacklist_tokens();

-- 현재 활성 블랙리스트 토큰 확인
SELECT * FROM active_blacklist_tokens;

-- 사용자별 로그인 상태 확인
SELECT * FROM user_login_stats;
*/
