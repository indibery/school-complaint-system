# 🏫 학교 민원시스템 (School Complaint Management System)

> **학부모와 교사를 위한 통합 민원 관리 및 방문 예약 시스템**

[![GitHub stars](https://img.shields.io/github/stars/indibery/school-complaint-system?style=social)](https://github.com/indibery/school-complaint-system/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/indibery/school-complaint-system?style=social)](https://github.com/indibery/school-complaint-system/network/members)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 📋 **프로젝트 개요**

학교 내 민원 처리와 방문 예약을 디지털화하여 학부모와 교사, 학교 관리자가 효율적으로 소통할 수 있는 통합 플랫폼입니다.

### 🎯 **주요 기능**
- 📝 **민원 관리**: 시설, 급식, 안전 등 다양한 민원 신청 및 처리
- 📅 **방문 예약**: QR코드 기반 학교 방문 예약 시스템
- 🚪 **교문 관리**: 방문자 체크인/아웃 및 실시간 현황 관리
- 🔔 **실시간 알림**: 민원 처리 상황 및 방문 예약 확인 알림
- 👥 **사용자 관리**: 학부모, 교사, 관리자, 교문 지킴이 역할별 접근 권한

## 📊 **개발 진행 상황**

### **현재 진행률: 45%** 🚀

| 구분 | 상태 | 진행률 | 설명 |
|------|------|--------|------|
| **백엔드 인프라** | ✅ 완료 | 95% | Amazon Lightsail + PostgreSQL 15 |
| **데이터베이스** | ✅ 완료 | 100% | 4개 핵심 테이블 + 교문 지킴이 역할 |
| **API 서버** | 🔄 진행중 | 20% | Node.js + Express 설정 |
| **모바일 앱** | ⏳ 대기 | 0% | React Native |
| **웹 관리자** | ⏳ 대기 | 0% | React.js |
| **교문 관리 앱** | ⏳ 대기 | 0% | 태블릿용 QR스캐너 |
| **배포 및 운영** | ⏳ 대기 | 0% | CI/CD 파이프라인 |

## 🏗️ **기술 스택**

### **Backend**
- **서버**: Amazon Lightsail (Ubuntu 22.04)
- **데이터베이스**: PostgreSQL 15
- **API**: Node.js + Express.js
- **인증**: JWT + bcrypt

### **Frontend**
- **모바일**: React Native (iOS/Android)
- **웹 관리자**: React.js + TypeScript
- **교문 관리 앱**: React Native (태블릿 최적화)
- **상태관리**: Redux Toolkit

### **DevOps**
- **버전관리**: Git + GitHub
- **배포**: Docker + GitHub Actions
- **모니터링**: 계획 중

## 🗄️ **데이터베이스 구조**

### **핵심 테이블 4개**

#### **users** (사용자 관리)
- 학부모, 교사, 관리자, **교문 지킴이** 통합 관리
- 이메일 기반 인증 시스템
- 역할별 권한 제어

#### **complaints** (민원 시스템)
- 시설, 급식, 안전 등 카테고리별 분류
- 접수 → 처리중 → 해결 → 완료 상태 관리
- 우선순위 및 처리 기한 설정

#### **visit_reservations** (방문 예약)
- 날짜/시간 기반 예약 시스템
- QR코드 자동 생성 및 검증
- **체크인/아웃 관리** (교문 지킴이 기능)
- 예약 상태 실시간 관리

#### **notifications** (알림 시스템)
- 민원 처리 상황 자동 알림
- 방문 예약 확인 알림
- **교문 보안 알림** 추가
- 타입별 알림 분류 및 읽음 상태 관리

## 🚀 **설치 및 실행**

### **필수 요구사항**
- Node.js 20.x LTS
- PostgreSQL 15+
- Git

### **1. 저장소 클론**
```bash
git clone https://github.com/indibery/school-complaint-system.git
cd school-complaint-system
```

### **2. 데이터베이스 설정**
```bash
# PostgreSQL 설치 (Ubuntu)
sudo apt update
sudo apt install postgresql postgresql-contrib

# 데이터베이스 생성
sudo -u postgres createdb complaint_system
sudo -u postgres createuser complaint_admin
```

### **3. 환경 설정**
```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일 편집 필요
```

### **4. 데이터베이스 스키마 적용**
```bash
# 기본 스키마 실행
psql -h localhost -U complaint_admin -d complaint_system -f database/schema.sql

# 테스트 데이터 삽입 (선택사항)
psql -h localhost -U complaint_admin -d complaint_system -f database/test_data.sql
```

### **5. 서버 실행**
```bash
# 개발 모드
npm run dev

# 프로덕션 모드
npm start
```

## 📱 **사용자 역할**

### **👨‍👩‍👧‍👦 학부모 (Parent)**
- 민원 신청 및 조회
- 방문 예약 및 QR코드 발급
- 알림 확인

### **👨‍🏫 교사 (Teacher)**
- 민원 확인 및 초기 처리
- 방문 예약 승인
- 학부모 소통

### **👨‍💼 관리자 (Admin)**
- 전체 민원 관리 및 처리
- 사용자 관리
- 시스템 설정 및 통계

### **🚪 교문 지킴이 (Security)** 🆕
- **방문자 QR코드 스캔 및 검증**
- **실시간 방문자 체크인/아웃 관리**
- **오늘 방문 예정자 현황 확인**
- **교내 체류 중인 방문자 모니터링**
- **방문자 통계 및 보고서**

## 🛣️ **개발 로드맵**

### **Phase 1: 백엔드 기반 구축** ✅ (완료)
- [x] 서버 인프라 구축
- [x] 데이터베이스 설계 및 구현
- [x] **교문 지킴이 역할 추가** 🆕
- [x] 기본 API 구조 설정

### **Phase 2: API 개발** 🔄 (진행중)
- [ ] 사용자 인증 API
- [ ] 민원 관리 API
- [ ] 방문 예약 API
- [ ] **교문 관리 API** 🆕
- [ ] 알림 시스템 API

### **Phase 3: 모바일 앱** ⏳ (예정)
- [ ] React Native 프로젝트 설정
- [ ] 사용자 인터페이스 구현
- [ ] API 연동

### **Phase 4: 웹 관리자** ⏳ (예정)
- [ ] React.js 관리자 페이지
- [ ] 대시보드 및 통계
- [ ] 고급 관리 기능

### **Phase 5: 교문 관리 시스템** ⏳ (예정) 🆕
- [ ] **태블릿 전용 교문 관리 앱**
- [ ] **QR코드 스캐너 통합**
- [ ] **실시간 방문자 대시보드**

### **Phase 6: 배포 및 운영** ⏳ (예정)
- [ ] Docker 컨테이너화
- [ ] CI/CD 파이프라인
- [ ] 모니터링 및 로깅

## 📂 **프로젝트 구조**

```
school-complaint-system/
├── 📁 backend/                 # API 서버
│   ├── 📁 controllers/         # 컨트롤러
│   ├── 📁 models/             # 데이터 모델
│   ├── 📁 routes/             # 라우터
│   ├── 📁 middleware/         # 미들웨어
│   └── 📁 utils/              # 유틸리티
├── 📁 mobile/                 # React Native 앱
├── 📁 web-admin/              # 웹 관리자 페이지
├── 📁 security-app/           # 교문 관리 태블릿 앱 🆕
├── 📁 database/               # DB 스키마 및 마이그레이션
│   ├── schema.sql            # 기본 스키마
│   ├── test_data.sql         # 테스트 데이터
│   ├── migration_v1.1.0.sql  # 교문 지킴이 업데이트
│   └── security_queries.sql  # 교문 지킴이 전용 쿼리 🆕
├── 📁 docs/                   # 프로젝트 문서
└── 📁 deployment/             # 배포 관련 파일
```

## 🆕 **교문 지킴이 시스템 특징**

### **실시간 방문자 관리**
- QR코드 스캔으로 즉시 방문자 확인
- 체크인/아웃 자동 기록
- 교내 체류 시간 실시간 추적

### **보안 강화 기능**
- 예약 없는 방문자 감지
- 장시간 체류자 알림
- 긴급 상황 대응 프로토콜

### **간편한 태블릿 인터페이스**
- 교문 전용 태블릿 최적화
- 원터치 체크인/아웃
- 직관적인 방문자 현황 표시

## 🏆 **주요 성과**

- ⚡ **빠른 개발**: 예상 1주일 → **실제 1일** 만에 백엔드 완성!
- 🔒 **프로덕션 레벨**: PostgreSQL 사용자 권한 및 보안 설정 완료
- 📊 **완벽한 DB**: 4개 핵심 테이블 + 관계형 구조 + 성능 최적화
- 🚪 **혁신적 기능**: **교문 지킴이 시스템**으로 학교 보안 강화 🆕
- 🎯 **체계적 개발**: GitHub 기반 버전 관리 + 완전한 문서화

## 🤝 **기여하기**

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 **라이센스**

이 프로젝트는 MIT 라이센스 하에 배포됩니다.

## 📞 **연락처**

- **프로젝트 링크**: https://github.com/indibery/school-complaint-system

---

**⭐ 이 프로젝트가 도움이 되었다면 Star를 눌러주세요!**