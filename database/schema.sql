-- =====================================================
-- 학교 민원시스템 데이터베이스 스키마
-- School Complaint Management System Database Schema
-- =====================================================

-- 데이터베이스 생성 (필요시)
-- CREATE DATABASE complaint_system;

-- 사용자 생성 및 권한 설정 (필요시)
-- CREATE USER complaint_admin WITH PASSWORD 'SecurePass123!';
-- GRANT ALL PRIVILEGES ON DATABASE complaint_system TO complaint_admin;

-- 데이터베이스 연결
\c complaint_system;

-- 확장 모듈 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. USERS 테이블 (사용자 관리)
-- =====================================================

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) NOT NULL CHECK (role IN ('parent', 'teacher', 'admin', 'security')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 사용자 테이블 인덱스
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);

-- =====================================================
-- 2. COMPLAINTS 테이블 (민원 관리)
-- =====================================================

CREATE TABLE complaints (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('facility', 'meal', 'safety', 'education', 'administration', 'other')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'resolved', 'closed')),
    priority VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    assigned_to BIGINT REFERENCES users(id) ON DELETE SET NULL,
    response TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

-- 민원 테이블 인덱스
CREATE INDEX idx_complaints_user_id ON complaints(user_id);
CREATE INDEX idx_complaints_status ON complaints(status);
CREATE INDEX idx_complaints_category ON complaints(category);
CREATE INDEX idx_complaints_priority ON complaints(priority);
CREATE INDEX idx_complaints_created_at ON complaints(created_at);
CREATE INDEX idx_complaints_assigned_to ON complaints(assigned_to);

-- =====================================================
-- 3. VISIT_RESERVATIONS 테이블 (방문 예약 관리)
-- =====================================================

CREATE TABLE visit_reservations (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    visitor_name VARCHAR(100) NOT NULL,
    visitor_phone VARCHAR(20),
    visit_date DATE NOT NULL,
    visit_time TIME NOT NULL,
    purpose TEXT NOT NULL,
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'checked_in')),
    qr_code VARCHAR(255) UNIQUE,
    approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    checked_in_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    checked_in_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 방문 예약 테이블 인덱스
CREATE INDEX idx_visit_reservations_user_id ON visit_reservations(user_id);
CREATE INDEX idx_visit_reservations_visit_date ON visit_reservations(visit_date);
CREATE INDEX idx_visit_reservations_status ON visit_reservations(status);
CREATE INDEX idx_visit_reservations_qr_code ON visit_reservations(qr_code);
CREATE INDEX idx_visit_reservations_approved_by ON visit_reservations(approved_by);
CREATE INDEX idx_visit_reservations_checked_in_by ON visit_reservations(checked_in_by);

-- =====================================================
-- 4. NOTIFICATIONS 테이블 (알림 관리)
-- =====================================================

CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('complaint', 'visit', 'system', 'security')),
    is_read BOOLEAN DEFAULT false,
    related_id BIGINT, -- 관련 레코드 ID (complaint_id, visit_reservation_id 등)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 알림 테이블 인덱스
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_related_id ON notifications(related_id);

-- =====================================================
-- 5. 트리거 함수 (자동 업데이트)
-- =====================================================

-- updated_at 컬럼 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 사용자 테이블 updated_at 트리거
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 민원 테이블 updated_at 트리거
CREATE TRIGGER update_complaints_updated_at 
    BEFORE UPDATE ON complaints 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 방문 예약 테이블 updated_at 트리거
CREATE TRIGGER update_visit_reservations_updated_at 
    BEFORE UPDATE ON visit_reservations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 6. QR 코드 자동 생성 함수
-- =====================================================

CREATE OR REPLACE FUNCTION generate_qr_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.qr_code IS NULL THEN
        NEW.qr_code = 'QR_' || NEW.id || '_' || extract(epoch from CURRENT_TIMESTAMP)::bigint;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 방문 예약 QR 코드 자동 생성 트리거
CREATE TRIGGER generate_visit_qr_code 
    BEFORE INSERT ON visit_reservations 
    FOR EACH ROW 
    EXECUTE FUNCTION generate_qr_code();

-- =====================================================
-- 7. 기본 데이터 삽입
-- =====================================================

-- 관리자 계정 생성
INSERT INTO users (email, password_hash, name, phone, role) VALUES
('admin@school.edu', crypt('admin123!', gen_salt('bf')), '시스템 관리자', '02-1234-5678', 'admin'),
('security@school.edu', crypt('security123!', gen_salt('bf')), '교문 지킴이', '02-1234-5679', 'security');

-- 테스트 학부모 계정
INSERT INTO users (email, password_hash, name, phone, role) VALUES
('parent1@test.com', crypt('parent123!', gen_salt('bf')), '김학부모', '010-1234-5678', 'parent'),
('parent2@test.com', crypt('parent123!', gen_salt('bf')), '이학부모', '010-1234-5679', 'parent');

-- 테스트 교사 계정
INSERT INTO users (email, password_hash, name, phone, role) VALUES
('teacher1@school.edu', crypt('teacher123!', gen_salt('bf')), '박선생님', '010-1234-5680', 'teacher'),
('teacher2@school.edu', crypt('teacher123!', gen_salt('bf')), '최선생님', '010-1234-5681', 'teacher');

-- =====================================================
-- 8. 권한 설정
-- =====================================================

-- complaint_admin 사용자에게 모든 테이블 권한 부여
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO complaint_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO complaint_admin;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO complaint_admin;

-- =====================================================
-- 스키마 생성 완료
-- =====================================================

-- 테이블 생성 확인
SELECT 'Schema created successfully!' as status;

-- 테이블 목록 확인
\dt

-- 사용자 역할 확인
SELECT role, COUNT(*) as count FROM users GROUP BY role;