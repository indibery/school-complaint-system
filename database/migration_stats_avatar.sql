-- =====================================================
-- 사용자 통계 및 이미지 관련 테이블 확장
-- User Statistics and Avatar Extensions
-- =====================================================

-- 민원 테이블에 해결 시간 추적을 위한 컬럼 추가 (통계 계산용)
ALTER TABLE complaints 
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;

-- 사용자 테이블에 마지막 로그인 추적 컬럼 (이미 있을 수 있음)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- 인덱스 추가 (통계 쿼리 성능 향상)
CREATE INDEX IF NOT EXISTS idx_complaints_user_created_at ON complaints(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_complaints_status_created_at ON complaints(status, created_at);
CREATE INDEX IF NOT EXISTS idx_complaints_category_user ON complaints(category, user_id);
CREATE INDEX IF NOT EXISTS idx_complaints_priority_user ON complaints(priority, user_id);
CREATE INDEX IF NOT EXISTS idx_complaints_resolved_at ON complaints(resolved_at);

CREATE INDEX IF NOT EXISTS idx_visits_user_created_at ON visits(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_visits_status_user ON visits(status, user_id);

CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- 사용자 활동 통계를 위한 뷰 생성
CREATE OR REPLACE VIEW user_activity_summary AS
SELECT 
    u.id as user_id,
    u.email,
    u.name,
    u.created_at as registration_date,
    u.last_login_at,
    u.profile_image IS NOT NULL as has_avatar,
    u.email_verified,
    
    -- 민원 통계
    COALESCE(c.total_complaints, 0) as total_complaints,
    COALESCE(c.pending_complaints, 0) as pending_complaints,
    COALESCE(c.resolved_complaints, 0) as resolved_complaints,
    COALESCE(c.recent_complaints, 0) as recent_complaints,
    
    -- 방문 통계
    COALESCE(v.total_visits, 0) as total_visits,
    COALESCE(v.completed_visits, 0) as completed_visits,
    
    -- 활동 점수 계산
    (COALESCE(c.total_complaints, 0) * 5 + 
     COALESCE(v.completed_visits, 0) * 3 +
     CASE WHEN u.profile_image IS NOT NULL THEN 10 ELSE 0 END +
     CASE WHEN u.email_verified THEN 15 ELSE 0 END) as activity_score,
     
    -- 프로필 완성도
    (CASE WHEN u.profile_image IS NOT NULL THEN 25 ELSE 0 END +
     CASE WHEN u.email_verified THEN 35 ELSE 0 END +
     CASE WHEN u.email_notifications IS NOT NULL THEN 20 ELSE 0 END +
     CASE WHEN u.language IS NOT NULL THEN 20 ELSE 0 END) as profile_completion

FROM users u
LEFT JOIN (
    SELECT 
        user_id,
        COUNT(*) as total_complaints,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_complaints,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_complaints,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as recent_complaints
    FROM complaints 
    WHERE is_active = true
    GROUP BY user_id
) c ON u.id = c.user_id
LEFT JOIN (
    SELECT 
        user_id,
        COUNT(*) as total_visits,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_visits
    FROM visits 
    GROUP BY user_id
) v ON u.id = v.user_id
WHERE u.is_active = true;

-- 민원 카테고리별 통계 뷰
CREATE OR REPLACE VIEW complaint_category_stats AS
SELECT 
    category,
    COUNT(*) as total_count,
    COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_count,
    ROUND(
        (COUNT(CASE WHEN status = 'resolved' THEN 1 END)::DECIMAL / COUNT(*)) * 100, 2
    ) as resolution_rate,
    AVG(
        CASE 
            WHEN status = 'resolved' AND resolved_at IS NOT NULL 
            THEN EXTRACT(epoch FROM (resolved_at - created_at)) / 86400.0 
        END
    ) as avg_resolution_days
FROM complaints 
WHERE is_active = true
GROUP BY category
ORDER BY total_count DESC;

-- 월별 민원 제출 통계 뷰
CREATE OR REPLACE VIEW monthly_complaint_stats AS
SELECT 
    TO_CHAR(created_at, 'YYYY-MM') as month,
    COUNT(*) as total_complaints,
    COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_complaints,
    COUNT(DISTINCT user_id) as unique_users
FROM complaints 
WHERE is_active = true 
  AND created_at >= NOW() - INTERVAL '24 months'
GROUP BY TO_CHAR(created_at, 'YYYY-MM')
ORDER BY month DESC;

-- 프로필 이미지 업로드 로그 테이블 (선택사항)
CREATE TABLE IF NOT EXISTS profile_image_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    old_image_path VARCHAR(500),
    new_image_path VARCHAR(500) NOT NULL,
    file_size INTEGER,
    file_type VARCHAR(50),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT
);

-- 프로필 이미지 로그 인덱스
CREATE INDEX IF NOT EXISTS idx_profile_image_logs_user_id ON profile_image_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_image_logs_uploaded_at ON profile_image_logs(uploaded_at);

-- 코멘트 추가
COMMENT ON COLUMN complaints.resolved_at IS '민원 해결 완료 시간';
COMMENT ON COLUMN users.last_login_at IS '마지막 로그인 시간';

COMMENT ON VIEW user_activity_summary IS '사용자 활동 요약 통계';
COMMENT ON VIEW complaint_category_stats IS '민원 카테고리별 통계';
COMMENT ON VIEW monthly_complaint_stats IS '월별 민원 제출 통계';

COMMENT ON TABLE profile_image_logs IS '프로필 이미지 업로드 이력';
COMMENT ON COLUMN profile_image_logs.old_image_path IS '이전 이미지 경로';
COMMENT ON COLUMN profile_image_logs.new_image_path IS '새 이미지 경로';
COMMENT ON COLUMN profile_image_logs.file_size IS '파일 크기 (바이트)';
COMMENT ON COLUMN profile_image_logs.file_type IS '파일 MIME 타입';

-- 통계 갱신을 위한 트리거 함수 (선택사항)
CREATE OR REPLACE FUNCTION update_complaint_resolved_at()
RETURNS TRIGGER AS $$
BEGIN
    -- 상태가 'resolved'로 변경될 때 resolved_at 설정
    IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
        NEW.resolved_at = CURRENT_TIMESTAMP;
    -- 상태가 'resolved'에서 다른 상태로 변경될 때 resolved_at 제거
    ELSIF NEW.status != 'resolved' AND OLD.status = 'resolved' THEN
        NEW.resolved_at = NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_complaint_resolved_at ON complaints;
CREATE TRIGGER trigger_update_complaint_resolved_at
    BEFORE UPDATE ON complaints
    FOR EACH ROW
    EXECUTE FUNCTION update_complaint_resolved_at();
