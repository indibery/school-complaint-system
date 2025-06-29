-- =====================================================
-- 민원 테이블 구조 업데이트 마이그레이션
-- Complaints Table Structure Update Migration
-- Version: 1.2.0
-- =====================================================

-- 기존 complaints 테이블 구조 확인
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'complaints'
ORDER BY ordinal_position;

-- complaints 테이블 수정
-- 요구사항에 맞게 컬럼 추가/수정

-- 1. description 컬럼 추가 (content -> description으로 매핑)
DO $$
BEGIN
    -- description 컬럼이 없으면 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'complaints' AND column_name = 'description') THEN
        ALTER TABLE complaints ADD COLUMN description TEXT;
        -- 기존 content 데이터를 description으로 복사
        UPDATE complaints SET description = content WHERE description IS NULL;
    END IF;
END$$;

-- 2. anonymous 컬럼 추가 (익명 민원 여부)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'complaints' AND column_name = 'anonymous') THEN
        ALTER TABLE complaints ADD COLUMN anonymous BOOLEAN DEFAULT false NOT NULL;
    END IF;
END$$;

-- 3. attachments 컬럼 추가 (첨부파일 정보를 JSON으로 저장)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'complaints' AND column_name = 'attachments') THEN
        ALTER TABLE complaints ADD COLUMN attachments JSONB DEFAULT '[]'::jsonb;
    END IF;
END$$;

-- 4. 상태값 업데이트 (pending -> submitted, processing -> in_progress)
-- 기존 체크 제약조건 삭제 후 새로 생성
ALTER TABLE complaints DROP CONSTRAINT IF EXISTS complaints_status_check;
ALTER TABLE complaints ADD CONSTRAINT complaints_status_check 
    CHECK (status IN ('submitted', 'in_progress', 'resolved', 'closed'));

-- 기존 데이터의 상태값 업데이트
UPDATE complaints SET status = 'submitted' WHERE status = 'pending';
UPDATE complaints SET status = 'in_progress' WHERE status = 'processing';

-- 5. 카테고리 업데이트 (기존 체크 제약조건 유지하되 확장)
ALTER TABLE complaints DROP CONSTRAINT IF EXISTS complaints_category_check;
ALTER TABLE complaints ADD CONSTRAINT complaints_category_check 
    CHECK (category IN ('facility', 'meal', 'safety', 'education', 'administration', 'bullying', 'academic', 'other'));

-- 6. 우선순위 기본값 설정
ALTER TABLE complaints ALTER COLUMN priority SET DEFAULT 'medium';

-- 7. 추가 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_complaints_anonymous ON complaints(anonymous);
CREATE INDEX IF NOT EXISTS idx_complaints_title_text ON complaints USING gin(to_tsvector('korean', title));
CREATE INDEX IF NOT EXISTS idx_complaints_description_text ON complaints USING gin(to_tsvector('korean', description));

-- 8. 댓글 테이블 생성 (민원 댓글 관리)
CREATE TABLE IF NOT EXISTS complaint_comments (
    id BIGSERIAL PRIMARY KEY,
    complaint_id BIGINT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false, -- 내부 댓글 여부 (교사, 관리자만)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 댓글 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_complaint_comments_complaint_id ON complaint_comments(complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaint_comments_user_id ON complaint_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_complaint_comments_created_at ON complaint_comments(created_at);

-- 댓글 테이블 updated_at 트리거
CREATE TRIGGER update_complaint_comments_updated_at 
    BEFORE UPDATE ON complaint_comments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 9. 첨부파일 테이블 생성 (파일 관리)
CREATE TABLE IF NOT EXISTS complaint_attachments (
    id BIGSERIAL PRIMARY KEY,
    complaint_id BIGINT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_by BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 첨부파일 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_complaint_attachments_complaint_id ON complaint_attachments(complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaint_attachments_uploaded_by ON complaint_attachments(uploaded_by);

-- 10. 민원 히스토리 테이블 생성 (상태 변경 이력)
CREATE TABLE IF NOT EXISTS complaint_history (
    id BIGSERIAL PRIMARY KEY,
    complaint_id BIGINT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    changed_by BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    field_name VARCHAR(50) NOT NULL, -- 변경된 필드명
    old_value TEXT, -- 이전 값
    new_value TEXT, -- 새로운 값
    change_reason TEXT, -- 변경 사유
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 히스토리 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_complaint_history_complaint_id ON complaint_history(complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaint_history_changed_by ON complaint_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_complaint_history_created_at ON complaint_history(created_at);

-- 마이그레이션 완료 로그
INSERT INTO public.migration_log (version, description, executed_at) 
VALUES ('1.2.0', 'Complaints table structure update', CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- 업데이트된 테이블 구조 확인
SELECT 'Complaints migration completed successfully!' as status;

-- 테이블 정보 출력
\d complaints
\d complaint_comments  
\d complaint_attachments
\d complaint_history