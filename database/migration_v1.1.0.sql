-- =====================================================
-- 데이터베이스 마이그레이션 파일
-- Database Migration File
-- =====================================================

-- 마이그레이션 버전: v1.1.0
-- 변경사항: 교문 지킴이 역할 추가 및 방문 예약 시스템 개선
-- 작성일: 2025-06-29

-- =====================================================
-- 1. 기존 데이터 백업 (선택사항)
-- =====================================================

-- 기존 데이터 백업 테이블 생성 (필요시)
-- CREATE TABLE users_backup AS SELECT * FROM users;
-- CREATE TABLE visit_reservations_backup AS SELECT * FROM visit_reservations;

-- =====================================================
-- 2. 스키마 업데이트
-- =====================================================

-- users 테이블 role 제약조건 업데이트
DO $$
BEGIN
    -- 기존 제약조건 삭제
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'users_role_check' 
               AND table_name = 'users') THEN
        ALTER TABLE users DROP CONSTRAINT users_role_check;
    END IF;
    
    -- 새로운 제약조건 추가 (security 역할 포함)
    ALTER TABLE users ADD CONSTRAINT users_role_check 
        CHECK (role IN ('parent', 'teacher', 'admin', 'security'));
END
$$;

-- visit_reservations 테이블 상태 제약조건 업데이트
DO $$
BEGIN
    -- 기존 제약조건 삭제
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'visit_reservations_status_check' 
               AND table_name = 'visit_reservations') THEN
        ALTER TABLE visit_reservations DROP CONSTRAINT visit_reservations_status_check;
    END IF;
    
    -- 새로운 제약조건 추가 (checked_in 상태 포함)
    ALTER TABLE visit_reservations ADD CONSTRAINT visit_reservations_status_check 
        CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'checked_in'));
END
$$;

-- visit_reservations 테이블 새 컬럼 추가 (없는 경우에만)
DO $$
BEGIN
    -- visitor_name 컬럼 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'visit_reservations' 
                   AND column_name = 'visitor_name') THEN
        ALTER TABLE visit_reservations ADD COLUMN visitor_name VARCHAR(100) NOT NULL DEFAULT 'Unknown';
        ALTER TABLE visit_reservations ALTER COLUMN visitor_name DROP DEFAULT;
    END IF;
    
    -- visitor_phone 컬럼 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'visit_reservations' 
                   AND column_name = 'visitor_phone') THEN
        ALTER TABLE visit_reservations ADD COLUMN visitor_phone VARCHAR(20);
    END IF;
    
    -- checked_in_by 컬럼 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'visit_reservations' 
                   AND column_name = 'checked_in_by') THEN
        ALTER TABLE visit_reservations ADD COLUMN checked_in_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
    END IF;
    
    -- checked_in_at 컬럼 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'visit_reservations' 
                   AND column_name = 'checked_in_at') THEN
        ALTER TABLE visit_reservations ADD COLUMN checked_in_at TIMESTAMP;
    END IF;
    
    -- approved_by 컬럼 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'visit_reservations' 
                   AND column_name = 'approved_by') THEN
        ALTER TABLE visit_reservations ADD COLUMN approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END
$$;

-- notifications 테이블 type 제약조건 업데이트
DO $$
BEGIN
    -- 기존 제약조건 삭제
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'notifications_type_check' 
               AND table_name = 'notifications') THEN
        ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
    END IF;
    
    -- 새로운 제약조건 추가 (security 타입 포함)
    ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
        CHECK (type IN ('complaint', 'visit', 'system', 'security'));
END
$$;

-- notifications 테이블 related_id 컬럼 추가 (없는 경우에만)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'notifications' 
                   AND column_name = 'related_id') THEN
        ALTER TABLE notifications ADD COLUMN related_id BIGINT;
    END IF;
END
$$;

-- =====================================================
-- 3. 새로운 인덱스 생성
-- =====================================================

-- 새로운 컬럼에 대한 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_visit_reservations_checked_in_by ON visit_reservations(checked_in_by);
CREATE INDEX IF NOT EXISTS idx_visit_reservations_approved_by ON visit_reservations(approved_by);
CREATE INDEX IF NOT EXISTS idx_notifications_related_id ON notifications(related_id);

-- =====================================================
-- 4. 기본 교문 지킴이 계정 생성 (없는 경우에만)
-- =====================================================

-- 교문 지킴이 계정이 없으면 생성
INSERT INTO users (email, password_hash, name, phone, role)
SELECT 'security@school.edu', crypt('security123!', gen_salt('bf')), '교문 지킴이', '02-1234-5679', 'security'
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE email = 'security@school.edu'
);

-- =====================================================
-- 5. 마이그레이션 완료 확인
-- =====================================================

-- 업데이트된 스키마 확인
SELECT 'Migration v1.1.0 completed successfully!' as status;

-- 새로운 역할 확인
SELECT role, COUNT(*) as count FROM users GROUP BY role ORDER BY role;

-- 방문 예약 상태 확인
SELECT DISTINCT status FROM visit_reservations ORDER BY status;

-- 알림 타입 확인
SELECT DISTINCT type FROM notifications ORDER BY type;