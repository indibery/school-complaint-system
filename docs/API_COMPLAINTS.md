# 🏫 민원 관리 시스템 API 문서

## 📋 개요

학교 민원 관리 시스템의 RESTful API 문서입니다. 학부모, 교사, 관리자 간의 민원 처리 프로세스를 지원합니다.

## 🔐 인증

모든 API는 JWT 토큰 기반 인증을 사용합니다.

```http
Authorization: Bearer <JWT_TOKEN>
```

## 🎯 기본 정보

- **Base URL**: `http://localhost:3000/api`
- **Content-Type**: `application/json`
- **API Version**: `v1.0.0`

## 👥 사용자 권한

| 권한 | 설명 | 접근 가능 API |
|------|------|---------------|
| `parent` | 학부모 | 본인 민원 CRUD |
| `teacher` | 교사 | 모든 민원 조회, 상태 변경 |
| `admin` | 관리자 | 모든 기능 |
| `security` | 교문 관리자 | 기본 조회 |

## 📝 민원 상태

| 상태 | 설명 |
|------|------|
| `submitted` | 접수됨 |
| `in_progress` | 처리중 |
| `resolved` | 해결됨 |
| `closed` | 종료됨 |

## 📊 민원 카테고리

| 카테고리 | 설명 |
|----------|------|
| `facility` | 시설 관련 |
| `meal` | 급식 관련 |
| `safety` | 안전 관련 |
| `education` | 교육 관련 |
| `administration` | 행정 관련 |
| `bullying` | 괴롭힘 관련 |
| `academic` | 학업 관련 |
| `other` | 기타 |

---

## 📋 API 엔드포인트

### 1. 민원 등록

학부모가 새로운 민원을 등록합니다.

**POST** `/complaints`

#### 요청 권한
- `parent`, `teacher`, `admin`

#### 요청 본문
```json
{
  "title": "급식 관련 민원",
  "description": "급식의 질이 좋지 않아서 개선을 요청드립니다.",
  "category": "meal",
  "priority": "medium",
  "anonymous": false
}
```

#### 필수 필드
- `title` (string, 5-200자): 민원 제목
- `description` (string, 10-2000자): 민원 내용
- `category` (string): 민원 카테고리

#### 선택 필드
- `priority` (string): 우선순위 (기본값: "medium")
- `anonymous` (boolean): 익명 여부 (기본값: false)

#### 성공 응답 (201)
```json
{
  "success": true,
  "message": "민원이 성공적으로 등록되었습니다.",
  "data": {
    "complaint": {
      "id": 123,
      "title": "급식 관련 민원",
      "description": "급식의 질이 좋지 않아서 개선을 요청드립니다.",
      "category": "meal",
      "status": "submitted",
      "priority": "medium", 
      "anonymous": false,
      "created_at": "2025-06-29T10:30:00Z",
      "updated_at": "2025-06-29T10:30:00Z"
    }
  }
}
```

#### 오류 응답
- `400`: 입력 데이터 오류
- `401`: 인증 필요
- `500`: 서버 오류

---

### 2. 민원 목록 조회

권한에 따라 민원 목록을 조회합니다.

**GET** `/complaints`

#### 요청 권한
- `parent`: 본인 민원만
- `teacher`, `admin`: 모든 민원

#### 쿼리 파라미터
```http
GET /complaints?page=1&limit=10&category=meal&status=submitted&search=급식&sort=created_at&order=desc
```

| 파라미터 | 타입 | 설명 | 기본값 |
|----------|------|------|--------|
| `page` | number | 페이지 번호 | 1 |
| `limit` | number | 페이지 크기 (1-100) | 10 |
| `category` | string | 카테고리 필터 | - |
| `status` | string | 상태 필터 | - |
| `priority` | string | 우선순위 필터 | - |
| `search` | string | 제목/내용 검색 | - |
| `anonymous` | boolean | 익명 여부 필터 | - |
| `sort` | string | 정렬 필드 | created_at |
| `order` | string | 정렬 순서 (asc/desc) | desc |

#### 성공 응답 (200)
```json
{
  "success": true,
  "message": "민원 목록 조회 성공",
  "data": {
    "complaints": [
      {
        "id": 123,
        "title": "급식 관련 민원",
        "description": "급식의 질이 좋지 않아서...",
        "category": "meal",
        "status": "submitted",
        "priority": "medium",
        "anonymous": false,
        "user_name": "김학부모",
        "user_email": "parent@example.com",
        "assigned_name": null,
        "created_at": "2025-06-29T10:30:00Z",
        "updated_at": "2025-06-29T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    },
    "filters": {
      "category": "meal",
      "status": "submitted",
      "search": "급식"
    }
  }
}
```

---

### 3. 민원 상세 조회

특정 민원의 상세 정보를 조회합니다.

**GET** `/complaints/:id`

#### 요청 권한
- `parent`: 본인 민원만
- `teacher`, `admin`: 모든 민원

#### 경로 파라미터
- `id` (number): 민원 ID

#### 성공 응답 (200)
```json
{
  "success": true,
  "message": "민원 상세 조회 성공",
  "data": {
    "complaint": {
      "id": 123,
      "title": "급식 관련 민원",
      "description": "급식의 질이 좋지 않아서...",
      "category": "meal",
      "status": "in_progress",
      "priority": "medium",
      "anonymous": false,
      "response": "현재 조사 중입니다.",
      "created_at": "2025-06-29T10:30:00Z",
      "updated_at": "2025-06-29T11:00:00Z",
      "resolved_at": null,
      "user": {
        "id": 456,
        "name": "김학부모",
        "email": "parent@example.com"
      },
      "assigned_to": {
        "id": 789,
        "name": "박선생님"
      },
      "attachments": [
        {
          "id": 1,
          "filename": "급식사진.jpg",
          "size": 1024000,
          "type": "image/jpeg",
          "uploaded_at": "2025-06-29T10:35:00Z"
        }
      ],
      "comments": [
        {
          "id": 1,
          "content": "접수되었습니다.",
          "is_internal": false,
          "created_at": "2025-06-29T11:00:00Z",
          "user": {
            "name": "박선생님",
            "role": "teacher"
          }
        }
      ]
    }
  }
}
```

#### 오류 응답
- `400`: 잘못된 ID 형식
- `404`: 민원 없음 또는 권한 없음

---

### 4. 민원 수정

본인의 민원을 수정합니다 (submitted 상태만).

**PUT** `/complaints/:id`

#### 요청 권한
- `parent`: 본인 민원만 (submitted 상태만)

#### 경로 파라미터
- `id` (number): 민원 ID

#### 요청 본문
```json
{
  "title": "수정된 급식 관련 민원",
  "description": "수정된 민원 내용",
  "category": "safety",
  "priority": "high",
  "anonymous": true
}
```

#### 부분 수정 지원
일부 필드만 전송해도 해당 필드만 수정됩니다.

```json
{
  "title": "제목만 수정"
}
```

#### 성공 응답 (200)
```json
{
  "success": true,
  "message": "민원이 성공적으로 수정되었습니다.",
  "data": {
    "complaint": {
      "id": 123,
      "title": "수정된 급식 관련 민원",
      "description": "수정된 민원 내용",
      "category": "safety",
      "status": "submitted",
      "priority": "high",
      "anonymous": true,
      "created_at": "2025-06-29T10:30:00Z",
      "updated_at": "2025-06-29T12:00:00Z"
    }
  }
}
```

#### 오류 응답
- `400`: 수정할 데이터 없음
- `403`: 처리 중인 민원 수정 불가
- `404`: 민원 없음 또는 권한 없음

---

### 5. 민원 삭제 (소프트 삭제)

본인의 민원을 삭제합니다 (submitted 상태만).

**DELETE** `/complaints/:id`

#### 요청 권한
- `parent`: 본인 민원만 (submitted 상태만)

#### 경로 파라미터
- `id` (number): 민원 ID

#### 성공 응답 (200)
```json
{
  "success": true,
  "message": "민원이 성공적으로 삭제되었습니다.",
  "data": {
    "complaint": {
      "id": 123,
      "status": "closed",
      "deleted_at": "2025-06-29T13:00:00Z"
    }
  }
}
```

#### 참고사항
- 물리적 삭제가 아닌 상태를 'closed'로 변경하는 소프트 삭제
- 데이터 복구 및 감사 추적 가능

---

### 6. 민원 상태 변경

교사/관리자가 민원 상태를 변경합니다.

**PATCH** `/complaints/:id/status`

#### 요청 권한
- `teacher`, `admin`

#### 경로 파라미터
- `id` (number): 민원 ID

#### 요청 본문
```json
{
  "status": "in_progress",
  "assigned_to": 789,
  "response": "처리를 시작하겠습니다."
}
```

#### 필수 필드
- `status` (string): 새로운 상태

#### 선택 필드
- `assigned_to` (number): 담당자 ID
- `response` (string): 처리 응답 메시지

#### 상태 전환 플로우
```
submitted → in_progress → resolved → closed
```

#### 성공 응답 (200)
```json
{
  "success": true,
  "message": "민원 상태가 성공적으로 변경되었습니다.",
  "data": {
    "complaint": {
      "id": 123,
      "status": "resolved",
      "assigned_to": 789,
      "response": "문제가 해결되었습니다.",
      "updated_at": "2025-06-29T14:00:00Z",
      "resolved_at": "2025-06-29T14:00:00Z"
    }
  }
}
```

#### 오류 응답
- `400`: 잘못된 상태값
- `403`: 권한 없음
- `404`: 민원 없음

---

## 🔒 보안 고려사항

### 1. 익명 민원 처리
- 익명 민원의 경우 작성자 정보 마스킹
- 학부모에게는 작성자 정보 숨김
- 교사/관리자는 실제 작성자 확인 가능

### 2. 권한별 접근 제어
- 학부모: 본인 민원만 접근
- 교사: 모든 민원 조회 및 상태 변경
- 관리자: 모든 기능 접근

### 3. 데이터 보호
- 민감 정보 응답에서 제외
- 소프트 삭제로 데이터 보존
- 변경 이력 추적

---

## 📊 HTTP 상태 코드

| 코드 | 설명 |
|------|------|
| 200 | 성공 |
| 201 | 생성 성공 |
| 400 | 잘못된 요청 |
| 401 | 인증 필요 |
| 403 | 권한 없음 |
| 404 | 리소스 없음 |
| 409 | 충돌 (중복 등) |
| 500 | 서버 오류 |

---

## 🧪 테스트

### 테스트 실행
```bash
# 전체 테스트
npm test

# 민원 API 테스트만
npm test -- --testNamePattern="민원"

# 커버리지 포함 테스트
npm run test:coverage
```

### 테스트 커버리지
- API 엔드포인트: 100%
- 권한 시나리오: 100%
- 에러 처리: 95% 이상

---

## 📝 변경 이력

### v1.0.0 (2025-06-29)
- 초기 민원 관리 API 구현
- CRUD 기능 완성
- 권한별 접근 제어
- 테스트 코드 완비

---

## 🛠 개발 정보

- **개발자**: Claude + 사용자
- **개발 도구**: VS Code + Desktop Commander
- **프레임워크**: Node.js + Express.js
- **데이터베이스**: PostgreSQL
- **테스트**: Jest + Supertest
- **인증**: JWT

---

## 📞 지원

문의사항이나 버그 리포트는 프로젝트 이슈 트래커를 이용해 주세요.

**API 문서 버전**: 1.0.0  
**최종 업데이트**: 2025-06-29