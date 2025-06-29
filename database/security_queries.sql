-- =====================================================
-- 교문 지킴이 전용 쿼리 모음
-- Security Guard Queries Collection
-- =====================================================

-- =====================================================
-- 1. 오늘 방문 예약 현황 조회
-- =====================================================

-- 오늘 예정된 모든 방문 예약 조회
SELECT 
    vr.id as reservation_id,
    vr.visitor_name,
    vr.visitor_phone,
    vr.visit_time,
    vr.purpose,
    vr.status,
    vr.qr_code,
    u.name as reserved_by,
    u.phone as reserved_by_phone,
    CASE 
        WHEN vr.status = 'pending' THEN '대기중'
        WHEN vr.status = 'confirmed' THEN '승인됨'
        WHEN vr.status = 'completed' THEN '완료됨'
        WHEN vr.status = 'cancelled' THEN '취소됨'
        WHEN vr.status = 'checked_in' THEN '입실확인'
        ELSE vr.status
    END as status_korean
FROM visit_reservations vr
JOIN users u ON vr.user_id = u.id
WHERE vr.visit_date = CURRENT_DATE
ORDER BY vr.visit_time;

-- =====================================================
-- 2. 방문자 체크인 처리
-- =====================================================

-- QR 코드로 방문자 확인 (체크인 전)
SELECT 
    vr.id,
    vr.visitor_name,
    vr.visitor_phone,
    vr.visit_date,
    vr.visit_time,
    vr.purpose,
    vr.status,
    u.name as reserved_by,
    u.phone as reserved_by_phone
FROM visit_reservations vr
JOIN users u ON vr.user_id = u.id
WHERE vr.qr_code = 'QR_CODE_HERE'  -- QR 코드 스캔 결과로 교체
  AND vr.visit_date = CURRENT_DATE
  AND vr.status IN ('confirmed', 'pending');

-- 방문자 체크인 처리 (교문 지킴이가 실행)
UPDATE visit_reservations 
SET 
    status = 'checked_in',
    checked_in_by = 2,  -- 교문 지킴이 user_id (실제 로그인한 사용자 ID로 교체)
    checked_in_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE qr_code = 'QR_CODE_HERE'  -- QR 코드 스캔 결과로 교체
  AND visit_date = CURRENT_DATE
  AND status IN ('confirmed', 'pending');

-- =====================================================
-- 3. 현재 교내 방문 중인 사람 현황
-- =====================================================

-- 현재 교내에 있는 방문자 목록 (체크인 했지만 아직 완료되지 않은 방문자)
SELECT 
    vr.id,
    vr.visitor_name,
    vr.visitor_phone,
    vr.visit_time,
    vr.purpose,
    vr.checked_in_at,
    u.name as reserved_by,
    EXTRACT(HOUR FROM (CURRENT_TIMESTAMP - vr.checked_in_at)) || '시간 ' ||
    EXTRACT(MINUTE FROM (CURRENT_TIMESTAMP - vr.checked_in_at)) || '분' as duration
FROM visit_reservations vr
JOIN users u ON vr.user_id = u.id
WHERE vr.visit_date = CURRENT_DATE
  AND vr.status = 'checked_in'
ORDER BY vr.checked_in_at;

-- =====================================================
-- 4. 방문 완료 처리
-- =====================================================

-- 방문자 퇴교 처리 (체크아웃)
UPDATE visit_reservations 
SET 
    status = 'completed',
    updated_at = CURRENT_TIMESTAMP
WHERE id = VISIT_RESERVATION_ID  -- 실제 예약 ID로 교체
  AND status = 'checked_in';

-- =====================================================
-- 5. 교문 지킴이 통계 쿼리
-- =====================================================

-- 오늘 방문자 통계
SELECT 
    COUNT(*) as total_reservations,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
    COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_count,
    COUNT(CASE WHEN status = 'checked_in' THEN 1 END) as checked_in_count,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_count
FROM visit_reservations
WHERE visit_date = CURRENT_DATE;

-- 이번 주 방문자 통계
SELECT 
    DATE(visit_date) as visit_date,
    COUNT(*) as total_visitors,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_visits
FROM visit_reservations
WHERE visit_date >= CURRENT_DATE - INTERVAL '7 days'
  AND visit_date <= CURRENT_DATE
GROUP BY DATE(visit_date)
ORDER BY visit_date;

-- 교문 지킴이별 처리 현황 (이번 달)
SELECT 
    u.name as security_guard,
    COUNT(*) as checked_in_count,
    DATE_TRUNC('day', vr.checked_in_at) as work_date
FROM visit_reservations vr
JOIN users u ON vr.checked_in_by = u.id
WHERE u.role = 'security'
  AND vr.checked_in_at >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY u.name, DATE_TRUNC('day', vr.checked_in_at)
ORDER BY work_date DESC, checked_in_count DESC;

-- =====================================================
-- 6. 긴급 상황 대응 쿼리
-- =====================================================

-- 예정 시간을 초과한 방문자 (1시간 이상 지연)
SELECT 
    vr.id,
    vr.visitor_name,
    vr.visitor_phone,
    vr.visit_time,
    vr.purpose,
    u.name as reserved_by,
    u.phone as reserved_by_phone,
    EXTRACT(HOUR FROM (CURRENT_TIME - vr.visit_time)) || '시간 ' ||
    EXTRACT(MINUTE FROM (CURRENT_TIME - vr.visit_time)) || '분 지연' as delay_time
FROM visit_reservations vr
JOIN users u ON vr.user_id = u.id
WHERE vr.visit_date = CURRENT_DATE
  AND vr.status IN ('confirmed', 'pending')
  AND vr.visit_time < CURRENT_TIME - INTERVAL '1 hour';

-- 장시간 교내 체류 중인 방문자 (3시간 이상)
SELECT 
    vr.id,
    vr.visitor_name,
    vr.visitor_phone,
    vr.visit_time,
    vr.checked_in_at,
    vr.purpose,
    u.name as reserved_by,
    u.phone as reserved_by_phone,
    EXTRACT(HOUR FROM (CURRENT_TIMESTAMP - vr.checked_in_at)) || '시간 ' ||
    EXTRACT(MINUTE FROM (CURRENT_TIMESTAMP - vr.checked_in_at)) || '분 체류' as stay_duration
FROM visit_reservations vr
JOIN users u ON vr.user_id = u.id
WHERE vr.visit_date = CURRENT_DATE
  AND vr.status = 'checked_in'
  AND vr.checked_in_at < CURRENT_TIMESTAMP - INTERVAL '3 hours';

-- =====================================================
-- 7. 교문 지킴이 대시보드용 실시간 현황
-- =====================================================

-- 실시간 대시보드 정보 (한 번의 쿼리로 모든 정보)
WITH today_stats AS (
    SELECT 
        COUNT(*) as total_reservations,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed,
        COUNT(CASE WHEN status = 'checked_in' THEN 1 END) as currently_inside,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
    FROM visit_reservations
    WHERE visit_date = CURRENT_DATE
),
next_visitors AS (
    SELECT 
        visitor_name,
        visit_time,
        purpose
    FROM visit_reservations
    WHERE visit_date = CURRENT_DATE
      AND status IN ('confirmed', 'pending')
      AND visit_time > CURRENT_TIME
    ORDER BY visit_time
    LIMIT 3
)
SELECT 
    ts.*,
    CURRENT_TIME as current_time,
    (SELECT COUNT(*) FROM next_visitors) as upcoming_visitors
FROM today_stats ts;