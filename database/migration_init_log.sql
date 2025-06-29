-- ============================================
-- 마이그레이션 로그 테이블 생성
-- Migration Log Table Creation
-- ============================================

-- 마이그레이션 로그 테이블 생성 (마이그레이션 이력 관리)
CREATE TABLE IF NOT EXISTS migration_log (
    id BIGSERIAL PRIMARY KEY,
    version VARCHAR(20) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 기본 마이그레이션 로그 삽입
INSERT INTO migration_log (version, description) 
VALUES ('1.0.0', 'Initial schema creation')
ON CONFLICT (version) DO NOTHING;

SELECT 'Migration log table created successfully!' as status;