# 사용자 관리 API 문서

## 개요
사용자 관리 시스템을 위한 RESTful API 엔드포인트들입니다. 일반 사용자용 API와 관리자용 API로 구분됩니다.

## 인증
모든 API는 JWT 토큰을 통한 인증이 필요합니다.
```
Authorization: Bearer <access_token>
```

---

## 📋 일반 사용자 API

### 1. 내 프로필 조회
**GET** `/api/users/profile`

내 프로필 정보를 조회합니다.

#### 응답 예시
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "홍길동",
      "phone": "010-1234-5678",
      "role": "parent",
      "profile_image": null,
      "email_notifications": true,
      "sms_notifications": false,
      "language": "ko",
      "timezone": "Asia/Seoul",
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

### 2. 프로필 수정
**PUT** `/api/users/profile`

내 프로필 정보를 수정합니다.

#### 요청 본문
```json
{
  "name": "홍길동",
  "phone": "010-1234-5678",
  "email_notifications": true,
  "sms_notifications": false,
  "language": "ko",
  "timezone": "Asia/Seoul"
}
```

#### 응답 예시
```json
{
  "success": true,
  "message": "프로필이 성공적으로 업데이트되었습니다.",
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "홍길동",
      "phone": "010-1234-5678",
      "role": "parent",
      "profile_image": null,
      "email_notifications": true,
      "sms_notifications": false,
      "language": "ko",
      "timezone": "Asia/Seoul",
      "updated_at": "2024-01-01T12:00:00.000Z"
    }
  }
}
```

### 3. 비밀번호 변경
**PUT** `/api/users/password`

현재 비밀번호를 새로운 비밀번호로 변경합니다.

#### 요청 본문
```json
{
  "current_password": "OldPassword123!",
  "new_password": "NewPassword123!",
  "confirm_password": "NewPassword123!"
}
```

#### 응답 예시
```json
{
  "success": true,
  "message": "비밀번호가 성공적으로 변경되었습니다.",
  "data": {
    "password_changed_at": "2024-01-01T12:00:00.000Z"
  }
}
```

### 4. 계정 설정 변경
**PUT** `/api/users/settings`

알림 설정 등 계정 관련 설정을 변경합니다.

#### 요청 본문
```json
{
  "email_notifications": true,
  "sms_notifications": false,
  "language": "ko",
  "timezone": "Asia/Seoul"
}
```

#### 응답 예시
```json
{
  "success": true,
  "message": "계정 설정이 성공적으로 업데이트되었습니다.",
  "data": {
    "settings": {
      "email_notifications": true,
      "sms_notifications": false,
      "language": "ko",
      "timezone": "Asia/Seoul"
    }
  }
}
```

### 5. 계정 삭제
**DELETE** `/api/users/account`

내 계정을 영구적으로 삭제합니다.

#### 요청 본문
```json
{
  "password": "MyPassword123!",
  "confirmation": "DELETE_MY_ACCOUNT",
  "reason": "더 이상 서비스를 이용하지 않습니다."
}
```

#### 응답 예시
```json
{
  "success": true,
  "message": "계정이 성공적으로 삭제되었습니다.",
  "data": {
    "deleted_at": "2024-01-01T12:00:00.000Z",
    "user_id": 1
  }
}
```

### 6. 사용자 통계
**GET** `/api/users/stats`

내 활동 통계를 조회합니다.

#### 응답 예시
```json
{
  "success": true,
  "data": {
    "user_stats": {
      "total_complaints": 5,
      "pending_complaints": 2,
      "resolved_complaints": 3,
      "total_visits": 10,
      "last_complaint_at": "2024-01-01T10:00:00.000Z",
      "last_visit_at": "2024-01-01T11:00:00.000Z",
      "account_age_days": 30
    },
    "generated_at": "2024-01-01T12:00:00.000Z"
  }
}
```

### 7. 프로필 이미지 업로드
**POST** `/api/users/upload-avatar`

프로필 이미지를 업로드합니다.

#### 요청 형식
```
Content-Type: multipart/form-data
```

#### 요청 본문
```
avatar: [이미지 파일]
```

#### 응답 예시
```json
{
  "success": true,
  "message": "프로필 이미지가 성공적으로 업로드되었습니다.",
  "data": {
    "profile_image": "/uploads/avatars/user_1_1704067200000.jpg",
    "uploaded_at": "2024-01-01T12:00:00.000Z"
  }
}
```

---

## 🔧 관리자 API

> **주의**: 모든 관리자 API는 `admin` 역할을 가진 사용자만 접근 가능합니다.

### 1. 사용자 목록 조회
**GET** `/api/admin/users`

전체 사용자 목록을 조회합니다.

#### 쿼리 파라미터
- `page` (선택): 페이지 번호 (기본값: 1)
- `limit` (선택): 페이지당 항목 수 (기본값: 20, 최대: 100)
- `search` (선택): 검색어 (이름, 이메일, 전화번호)
- `role` (선택): 역할 필터 (parent, teacher, admin, security, user)
- `status` (선택): 상태 필터 (active, inactive)
- `sortBy` (선택): 정렬 필드 (created_at, updated_at, last_login_at, name, email)
- `sortOrder` (선택): 정렬 순서 (ASC, DESC)
- `dateFrom` (선택): 시작 날짜 (ISO 8601)
- `dateTo` (선택): 종료 날짜 (ISO 8601)

#### 응답 예시
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 1,
        "email": "user@example.com",
        "name": "홍길동",
        "phone": "010-1234-5678",
        "role": "parent",
        "is_active": true,
        "email_verified": true,
        "profile_image": null,
        "created_at": "2024-01-01T00:00:00.000Z",
        "updated_at": "2024-01-01T00:00:00.000Z",
        "last_login_at": "2024-01-01T10:00:00.000Z",
        "complaint_count": 5,
        "visit_count": 10,
        "last_complaint_at": "2024-01-01T09:00:00.000Z",
        "activity_status": "recent"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 10,
      "total_users": 200,
      "per_page": 20,
      "has_next": true,
      "has_prev": false
    },
    "statistics": {
      "total_users": 200,
      "active_users": 180,
      "verified_users": 150,
      "admin_count": 3,
      "parent_count": 180,
      "teacher_count": 17,
      "recent_active": 50
    },
    "filters_applied": {
      "search": null,
      "role": null,
      "status": null,
      "date_range": {
        "from": null,
        "to": null
      },
      "sort": {
        "field": "created_at",
        "order": "DESC"
      }
    },
    "generated_at": "2024-01-01T12:00:00.000Z"
  }
}
```

### 2. 특정 사용자 조회
**GET** `/api/admin/users/:id`

특정 사용자의 상세 정보를 조회합니다.

#### 응답 예시
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "홍길동",
      "phone": "010-1234-5678",
      "role": "parent",
      "is_active": true,
      "email_verified": true,
      "profile_image": null,
      "email_notifications": true,
      "sms_notifications": false,
      "language": "ko",
      "timezone": "Asia/Seoul",
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z",
      "last_login_at": "2024-01-01T10:00:00.000Z",
      "login_attempts": 0,
      "locked_until": null
    }
  }
}
```

### 3. 사용자 정보 수정
**PUT** `/api/admin/users/:id`

특정 사용자의 정보를 수정합니다.

#### 요청 본문
```json
{
  "name": "홍길동",
  "email": "newemail@example.com",
  "phone": "010-9876-5432",
  "role": "teacher",
  "is_active": true,
  "email_verified": true
}
```

#### 응답 예시
```json
{
  "success": true,
  "message": "사용자 정보가 성공적으로 수정되었습니다.",
  "data": {
    "user": {
      "id": 1,
      "email": "newemail@example.com",
      "name": "홍길동",
      "phone": "010-9876-5432",
      "role": "teacher",
      "is_active": true,
      "email_verified": true,
      "updated_at": "2024-01-01T12:00:00.000Z"
    },
    "changes": {
      "email": "newemail@example.com",
      "role": "teacher"
    }
  }
}
```

### 4. 사용자 삭제
**DELETE** `/api/admin/users/:id`

특정 사용자를 삭제합니다.

#### 요청 본문
```json
{
  "reason": "정책 위반으로 인한 계정 삭제",
  "confirmation": "ADMIN_DELETE_USER"
}
```

#### 응답 예시
```json
{
  "success": true,
  "message": "사용자가 성공적으로 삭제되었습니다.",
  "data": {
    "deleted_user_id": 1,
    "deleted_at": "2024-01-01T12:00:00.000Z",
    "deleted_by": "admin@example.com",
    "reason": "정책 위반으로 인한 계정 삭제"
  }
}
```

### 5. 비밀번호 초기화
**POST** `/api/admin/users/:id/reset-password`

특정 사용자의 비밀번호를 초기화합니다.

#### 요청 본문
```json
{
  "new_password": "NewPassword123!",
  "send_notification": true
}
```

#### 응답 예시
```json
{
  "success": true,
  "message": "비밀번호가 성공적으로 초기화되었습니다.",
  "data": {
    "user_id": 1,
    "password_reset_at": "2024-01-01T12:00:00.000Z",
    "notification_sent": true
  }
}
```

### 6. 계정 잠금 해제
**POST** `/api/admin/users/:id/unlock`

잠긴 계정을 해제합니다.

#### 응답 예시
```json
{
  "success": true,
  "message": "계정 잠금이 성공적으로 해제되었습니다.",
  "data": {
    "user_id": 1,
    "unlocked_at": "2024-01-01T12:00:00.000Z",
    "unlocked_by": "admin@example.com"
  }
}
```

### 7. 사용자 통계 (관리자용)
**GET** `/api/admin/users/stats`

전체 사용자 관련 통계를 조회합니다.

#### 쿼리 파라미터
- `period` (선택): 통계 기간 (7, 30, 90, 365일)

#### 응답 예시
```json
{
  "success": true,
  "data": {
    "overview": {
      "total_users": 1000,
      "active_users": 900,
      "verified_users": 850,
      "new_users_today": 5,
      "new_users_this_week": 25,
      "new_users_this_month": 120
    },
    "role_distribution": [
      {
        "role": "parent",
        "count": 800,
        "percentage": 80.0
      },
      {
        "role": "teacher",
        "count": 180,
        "percentage": 18.0
      },
      {
        "role": "admin",
        "count": 20,
        "percentage": 2.0
      }
    ],
    "registration_trend": [
      {
        "date": "2024-01-01",
        "new_registrations": 15,
        "cumulative_registrations": 1000
      }
    ],
    "activity_analysis": [
      {
        "activity_level": "highly_active",
        "user_count": 300,
        "description": "last_login_at >= NOW() - INTERVAL '7 days'"
      },
      {
        "activity_level": "moderately_active",
        "user_count": 400,
        "description": "last_login_at >= NOW() - INTERVAL '30 days'"
      },
      {
        "activity_level": "low_active",
        "user_count": 200,
        "description": "last_login_at >= NOW() - INTERVAL '90 days'"
      },
      {
        "activity_level": "inactive",
        "user_count": 100,
        "description": "기타"
      }
    ],
    "period_info": {
      "period_days": 30,
      "generated_at": "2024-01-01T12:00:00.000Z"
    }
  }
}
```

---

## 오류 응답

모든 API는 오류 시 다음과 같은 형식으로 응답합니다:

```json
{
  "success": false,
  "message": "오류 메시지",
  "code": "ERROR_CODE",
  "details": "상세 오류 정보 (선택적)"
}
```

### 일반적인 오류 코드
- `400` - Bad Request: 잘못된 요청 데이터
- `401` - Unauthorized: 인증 실패
- `403` - Forbidden: 권한 부족
- `404` - Not Found: 리소스를 찾을 수 없음
- `409` - Conflict: 데이터 충돌 (중복 이메일 등)
- `422` - Unprocessable Entity: 유효성 검사 실패
- `500` - Internal Server Error: 서버 내부 오류

---

## 보안 고려사항

1. **인증**: 모든 API는 유효한 JWT 토큰이 필요합니다.
2. **권한**: 관리자 API는 admin 역할의 사용자만 접근 가능합니다.
3. **비밀번호**: 비밀번호 변경 시 현재 비밀번호 확인이 필요합니다.
4. **계정 삭제**: 계정 삭제 시 확인 문구 입력이 필요합니다.
5. **파일 업로드**: 이미지 파일만 업로드 가능하며, 파일 크기 제한이 있습니다.
6. **Rate Limiting**: API 호출 횟수 제한이 적용됩니다.

---

## 변경 이력

### v1.0.0 (2024-01-01)
- 사용자 관리 API 초기 버전 릴리스
- 일반 사용자 API 7개 엔드포인트 구현
- 관리자 API 7개 엔드포인트 구현
- JWT 기반 인증 시스템 구축
- 파일 업로드 기능 구현
- 포괄적 테스트 커버리지 달성
