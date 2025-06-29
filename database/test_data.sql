-- =====================================================
-- 학교 민원시스템 테스트 데이터
-- School Complaint System Test Data
-- =====================================================

-- 테스트 민원 데이터 삽입
INSERT INTO complaints (user_id, title, content, category, status, priority) VALUES
(3, '운동장 시설 보수 요청', '운동장 철봉이 녹슬어서 위험합니다. 빠른 보수를 요청드립니다.', 'facility', 'pending', 'high'),
(4, '급식 메뉴 개선 건의', '아이들이 좋아할 만한 메뉴를 추가해주세요.', 'meal', 'processing', 'medium'),
(3, '정문 보안 강화 요청', '등하교 시간 정문 보안이 필요합니다.', 'safety', 'resolved', 'high'),
(4, '교실 에어컨 수리 요청', '3학년 2반 교실 에어컨이 작동하지 않습니다.', 'facility', 'pending', 'medium');

-- 테스트 방문 예약 데이터 삽입
INSERT INTO visit_reservations (user_id, visitor_name, visitor_phone, visit_date, visit_time, purpose, status) VALUES
(3, '김학부모', '010-1234-5678', CURRENT_DATE + INTERVAL '1 day', '14:00:00', '담임 선생님 상담', 'pending'),
(4, '이학부모', '010-1234-5679', CURRENT_DATE + INTERVAL '2 days', '15:30:00', '학교 시설 견학', 'confirmed'),
(3, '김학부모', '010-1234-5678', CURRENT_DATE, '10:00:00', '학부모 회의 참석', 'completed'),
(4, '이학부모', '010-1234-5679', CURRENT_DATE + INTERVAL '3 days', '16:00:00', '방과후 수업 상담', 'pending');

-- 테스트 알림 데이터 삽입
INSERT INTO notifications (user_id, title, message, type, related_id) VALUES
(3, '민원 접수 완료', '운동장 시설 보수 요청이 접수되었습니다.', 'complaint', 1),
(4, '민원 처리 중', '급식 메뉴 개선 건의가 처리 중입니다.', 'complaint', 2),
(3, '방문 예약 승인', '내일 오후 2시 방문 예약이 승인되었습니다.', 'visit', 1),
(1, '새로운 민원 접수', '시설 관련 민원이 접수되었습니다.', 'complaint', 4),
(2, '방문자 도착 알림', '김학부모님이 교문에 도착하셨습니다.', 'security', 3);

-- 교문 지킴이를 위한 오늘 방문 예약 현황 조회
SELECT 
    vr.id,
    vr.visitor_name,
    vr.visitor_phone,
    vr.visit_date,
    vr.visit_time,
    vr.purpose,
    vr.status,
    vr.qr_code,
    u.name as reserved_by
FROM visit_reservations vr
JOIN users u ON vr.user_id = u.id
WHERE vr.visit_date = CURRENT_DATE
ORDER BY vr.visit_time;

-- 역할별 사용자 수 확인
SELECT 
    role,
    COUNT(*) as user_count,
    CASE 
        WHEN role = 'parent' THEN '학부모'
        WHEN role = 'teacher' THEN '교사'
        WHEN role = 'admin' THEN '관리자'
        WHEN role = 'security' THEN '교문 지킴이'
        ELSE role
    END as role_korean
FROM users 
WHERE is_active = true
GROUP BY role
ORDER BY user_count DESC;

-- 민원 상태별 현황
SELECT 
    status,
    COUNT(*) as complaint_count,
    CASE 
        WHEN status = 'pending' THEN '대기중'
        WHEN status = 'processing' THEN '처리중'
        WHEN status = 'resolved' THEN '해결됨'
        WHEN status = 'closed' THEN '완료됨'
        ELSE status
    END as status_korean
FROM complaints
GROUP BY status
ORDER BY complaint_count DESC;

-- 방문 예약 상태별 현황
SELECT 
    status,
    COUNT(*) as reservation_count,
    CASE 
        WHEN status = 'pending' THEN '대기중'
        WHEN status = 'confirmed' THEN '승인됨'
        WHEN status = 'completed' THEN '완료됨'
        WHEN status = 'cancelled' THEN '취소됨'
        WHEN status = 'checked_in' THEN '입실확인'
        ELSE status
    END as status_korean
FROM visit_reservations
GROUP BY status
ORDER BY reservation_count DESC;