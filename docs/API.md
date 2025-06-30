# 📚 API 문서

## 🔐 인증 시스템

### JWT 토큰 기반 인증
모든 API 요청에는 Authorization 헤더가 필요합니다 (로그인/회원가입 제외).

```http
Authorization: Bearer <your_jwt_token>
```

### 토큰 갱신
Access Token이 만료되면 Refresh Token을 사용하여 새 토큰을 발급받습니다.

---

## 🔐 인증 API

### 회원가입
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "홍길동",
  "phone": "010-1234-5678",
  "role": "parent"
}
```

**응답:**
```json
{
  "success": true,
  "message": "회원가입이 완료되었습니다.",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "홍길동",
      "role": "parent"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
    }
  }
}
```

### 로그인
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

### 토큰 갱신
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### 비밀번호 재설정
```http
POST /api/auth/forgot
Content-Type: application/json

{
  "email": "user@example.com"
}
```

---

## 👥 사용자 관리 API

> 📋 **상세 문서**: [사용자 관리 API 전체 문서](./API_USER_MANAGEMENT.md)

### 일반 사용자 API

#### 내 프로필 조회
```http
GET /api/users/profile
Authorization: Bearer <token>
```

#### 프로필 수정
```http
PUT /api/users/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "홍길동",
  "phone": "010-1234-5678",
  "email_notifications": true,
  "sms_notifications": false
}
```

#### 비밀번호 변경
```http
PUT /api/users/password
Authorization: Bearer <token>
Content-Type: application/json

{
  "current_password": "OldPass123!",
  "new_password": "NewPass123!",
  "confirm_password": "NewPass123!"
}
```

#### 계정 설정 변경
```http
PUT /api/users/settings
Authorization: Bearer <token>
```

#### 계정 삭제
```http
DELETE /api/users/account
Authorization: Bearer <token>
```

#### 사용자 통계
```http
GET /api/users/stats
Authorization: Bearer <token>
```

#### 프로필 이미지 업로드
```http
POST /api/users/upload-avatar
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

### 관리자 API

> 🔒 **권한 필요**: `admin` 역할

#### 전체 사용자 목록 조회
```http
GET /api/admin/users?page=1&limit=20&search=홍길동&role=parent&status=active
Authorization: Bearer <admin_token>
```

#### 특정 사용자 조회
```http
GET /api/admin/users/:id
Authorization: Bearer <admin_token>
```

#### 사용자 정보 수정
```http
PUT /api/admin/users/:id
Authorization: Bearer <admin_token>
```

#### 사용자 삭제
```http
DELETE /api/admin/users/:id
Authorization: Bearer <admin_token>
```

#### 비밀번호 초기화
```http
POST /api/admin/users/:id/reset-password
Authorization: Bearer <admin_token>
```

#### 계정 잠금 해제
```http
POST /api/admin/users/:id/unlock
Authorization: Bearer <admin_token>
```

#### 관리자 사용자 통계
```http
GET /api/admin/users/stats?period=30
Authorization: Bearer <admin_token>
```

---

## 📝 민원 API

### 민원 목록 조회
```http
GET /api/complaints?page=1&limit=10&category=facility&status=pending
Authorization: Bearer <token>
```

**쿼리 파라미터:**
- `page`: 페이지 번호 (기본값: 1)
- `limit`: 페이지 크기 (기본값: 10, 최대: 100)
- `category`: 카테고리 필터 (facility, meal, safety, education, other)
- `status`: 상태 필터 (pending, in_progress, resolved, closed)
- `q`: 검색어 (제목, 내용 검색)
- `sort`: 정렬 필드 (created_at, title, status, priority)
- `order`: 정렬 순서 (asc, desc)

**응답:**
```json
{
  "success": true,
  "data": {
    "complaints": [
      {
        "id": "uuid",
        "title": "급식실 환기 시설 개선 요청",
        "description": "급식실 환기가 잘 되지 않아...",
        "category": "facility",
        "status": "pending",
        "priority": "medium",
        "anonymous": false,
        "created_at": "2025-01-01T00:00:00Z",
        "user": {
          "name": "홍길동",
          "email": "user@example.com"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    }
  }
}
```

### 민원 등록
```http
POST /api/complaints
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "급식실 환기 시설 개선 요청",
  "description": "급식실 환기가 잘 되지 않아 학생들이 불편함을 겪고 있습니다. 환기 시설 점검 및 개선을 요청드립니다.",
  "category": "facility",
  "priority": "medium",
  "anonymous": false
}
```

### 민원 상세 조회
```http
GET /api/complaints/:id
Authorization: Bearer <token>
```

### 민원 수정
```http
PUT /api/complaints/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "수정된 제목",
  "description": "수정된 내용",
  "priority": "high"
}
```

### 민원 삭제
```http
DELETE /api/complaints/:id
Authorization: Bearer <token>
```

---

## 📅 방문 예약 API

### 방문 예약 목록
```http
GET /api/visits?page=1&limit=10&status=approved
Authorization: Bearer <token>
```

**응답:**
```json
{
  "success": true,
  "data": {
    "visits": [
      {
        "id": "uuid",
        "visitor_name": "홍길동",
        "visitor_phone": "010-1234-5678",
        "visit_date": "2025-01-15",
        "visit_time": "14:00",
        "purpose": "학부모 상담",
        "visitor_count": 1,
        "status": "approved",
        "qr_code": "data:image/png;base64,iVBOR...",
        "created_at": "2025-01-10T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 5,
      "totalPages": 1
    }
  }
}
```

### 방문 예약 등록
```http
POST /api/visits
Authorization: Bearer <token>
Content-Type: application/json

{
  "visitor_name": "홍길동",
  "visitor_phone": "010-1234-5678",
  "visit_date": "2025-01-15",
  "visit_time": "14:00",
  "purpose": "학부모 상담",
  "visitor_count": 1
}
```

### 방문 예약 상세 조회
```http
GET /api/visits/:id
Authorization: Bearer <token>
```

### 방문 예약 수정
```http
PUT /api/visits/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "visit_date": "2025-01-16",
  "visit_time": "15:00",
  "purpose": "수정된 방문 목적"
}
```

### 방문 예약 취소
```http
DELETE /api/visits/:id
Authorization: Bearer <token>
```

---

## 🚪 교문 관리 API

### 현재 방문자 현황
```http
GET /api/security/visitors
Authorization: Bearer <token>
```

**응답:**
```json
{
  "success": true,
  "data": {
    "current_visitors": [
      {
        "id": "uuid",
        "visitor_name": "홍길동",
        "visit_date": "2025-01-15",
        "visit_time": "14:00",
        "check_in_time": "2025-01-15T14:05:00Z",
        "check_out_time": null,
        "purpose": "학부모 상담",
        "status": "checked_in"
      }
    ],
    "stats": {
      "total_today": 15,
      "currently_inside": 3,
      "checked_out": 12
    }
  }
}
```

### 방문자 체크인
```http
POST /api/security/checkin
Authorization: Bearer <token>
Content-Type: application/json

{
  "reservation_id": "uuid",
  "qr_code": "QR코드 데이터"
}
```

### 방문자 체크아웃
```http
POST /api/security/checkout
Authorization: Bearer <token>
Content-Type: application/json

{
  "reservation_id": "uuid"
}
```

### 방문 통계
```http
GET /api/security/stats?start_date=2025-01-01&end_date=2025-01-31
Authorization: Bearer <token>
```

**응답:**
```json
{
  "success": true,
  "data": {
    "period": {
      "start_date": "2025-01-01",
      "end_date": "2025-01-31"
    },
    "statistics": {
      "total_visits": 245,
      "total_visitors": 180,
      "average_visit_duration": "45분",
      "peak_hours": ["14:00", "15:00", "16:00"],
      "visits_by_day": {
        "2025-01-01": 8,
        "2025-01-02": 12,
        "...": "..."
      },
      "visits_by_purpose": {
        "학부모 상담": 120,
        "업무 방문": 80,
        "기타": 45
      }
    }
  }
}
```

---

## 🔔 알림 API

### 알림 목록
```http
GET /api/notifications?page=1&limit=20&is_read=false
Authorization: Bearer <token>
```

**응답:**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "uuid",
        "title": "민원 처리 완료",
        "message": "귀하의 민원이 처리되었습니다.",
        "type": "complaint",
        "is_read": false,
        "metadata": {
          "complaint_id": "uuid",
          "action_url": "/complaints/uuid"
        },
        "created_at": "2025-01-15T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 35,
      "totalPages": 2
    },
    "unread_count": 5
  }
}
```

### 알림 읽음 처리
```http
PUT /api/notifications/:id/read
Authorization: Bearer <token>
```

### 알림 삭제
```http
DELETE /api/notifications/:id
Authorization: Bearer <token>
```

### 모든 알림 읽음 처리
```http
PUT /api/notifications/read-all
Authorization: Bearer <token>
```

---

## 📊 관리자 API

### 사용자 관리 (관리자만)
```http
GET /api/admin/users?page=1&limit=20&role=parent
Authorization: Bearer <admin_token>
```

### 민원 통계 (관리자/교사)
```http
GET /api/admin/complaints/stats?period=month
Authorization: Bearer <token>
```

### 시스템 상태 (관리자만)
```http
GET /api/admin/system/status
Authorization: Bearer <admin_token>
```

---

## 🔍 검색 API

### 통합 검색
```http
GET /api/search?q=급식&type=complaints,visits
Authorization: Bearer <token>
```

---

## 📱 파일 업로드 API

### 파일 업로드
```http
POST /api/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <file_data>
```

**응답:**
```json
{
  "success": true,
  "data": {
    "filename": "image_20250115_140530.jpg",
    "url": "/uploads/image_20250115_140530.jpg",
    "size": 1024000,
    "mimetype": "image/jpeg"
  }
}
```

---

## ⚠️ 에러 응답

모든 API 에러는 다음 형식으로 응답됩니다:

```json
{
  "success": false,
  "error": {
    "status": 400,
    "code": "VALIDATION_ERROR",
    "message": "입력 데이터가 유효하지 않습니다.",
    "timestamp": "2025-01-15T10:00:00Z",
    "details": [
      {
        "field": "email",
        "message": "유효한 이메일 주소를 입력해주세요."
      }
    ]
  }
}
```

### 주요 에러 코드
- `400 BAD_REQUEST`: 잘못된 요청
- `401 UNAUTHORIZED`: 인증 실패
- `403 FORBIDDEN`: 권한 없음
- `404 NOT_FOUND`: 리소스 없음
- `409 CONFLICT`: 데이터 충돌
- `429 TOO_MANY_REQUESTS`: 요청 제한 초과
- `500 INTERNAL_SERVER_ERROR`: 서버 오류

---

## 🔧 개발자 도구

### API 테스트
```bash
# 서버 상태 확인
curl http://localhost:3000/health

# 로그인 테스트
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Postman 컬렉션
프로젝트 루트의 `docs/postman_collection.json` 파일을 Postman에 임포트하여 사용할 수 있습니다.

---

## 📝 주의사항

1. **Rate Limiting**: API 요청은 15분간 100회로 제한됩니다.
2. **토큰 만료**: Access Token은 24시간, Refresh Token은 7일 후 만료됩니다.
3. **파일 업로드**: 최대 5MB까지 업로드 가능합니다.
4. **페이지네이션**: 최대 100개까지 한 번에 조회 가능합니다.
5. **시간대**: 모든 시간은 UTC 기준입니다.