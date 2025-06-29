# 🤝 기여 가이드 (Contributing Guide)

**학교 민원시스템** 프로젝트에 기여해 주셔서 감사합니다! 이 가이드를 통해 효과적으로 기여하는 방법을 알아보세요.

## 📋 목차

- [행동 강령](#-행동-강령)
- [기여 방법](#-기여-방법)
- [개발 환경 설정](#-개발-환경-설정)
- [코딩 스타일](#-코딩-스타일)
- [커밋 메시지 규칙](#-커밋-메시지-규칙)
- [Pull Request 가이드](#-pull-request-가이드)
- [이슈 리포팅](#-이슈-리포팅)
- [테스트](#-테스트)

---

## 🤝 행동 강령

### 우리의 약속
포용적이고 환영받는 환경을 만들기 위해 우리는 다음과 같이 행동합니다:

- 다른 관점과 경험을 존중합니다
- 건설적인 비판을 주고받습니다
- 커뮤니티에 가장 좋은 것에 집중합니다
- 다른 커뮤니티 구성원에게 공감을 보입니다

### 허용되지 않는 행동
- 성적인 언어나 이미지 사용
- 인신공격이나 모욕적인 댓글
- 공개적 또는 사적 괴롭힘
- 명시적 허가 없이 다른 사람의 정보 공개
- 전문적이지 않은 기타 행동

---

## 🚀 기여 방법

### 1. 버그 신고
버그를 발견하셨나요? 다음 단계를 따라주세요:

1. [Issues](https://github.com/indibery/school-complaint-system/issues)에서 이미 보고된 버그인지 확인
2. 새 이슈 생성 시 **Bug Report** 템플릿 사용
3. 명확한 제목과 상세한 설명 작성
4. 재현 가능한 단계 포함
5. 예상 동작과 실제 동작 설명

### 2. 기능 제안
새로운 기능을 제안하고 싶으신가요?

1. [Discussions](https://github.com/indibery/school-complaint-system/discussions)에서 먼저 논의
2. **Feature Request** 템플릿으로 이슈 생성
3. 기능의 필요성과 이점 설명
4. 가능한 구현 방법 제시

### 3. 코드 기여
코드로 기여하고 싶으신가요?

1. **Fork** 프로젝트
2. **Feature branch** 생성: `git checkout -b feature/amazing-feature`
3. **변경사항 커밋**: `git commit -m '✨ Add amazing feature'`
4. **Branch에 Push**: `git push origin feature/amazing-feature`
5. **Pull Request** 생성

---

## 🔧 개발 환경 설정

### 필수 도구
- Node.js 20.x LTS
- PostgreSQL 15+
- Git
- VS Code (권장)

### 프로젝트 설정
```bash
# 1. Fork한 저장소 클론
git clone https://github.com/YOUR_USERNAME/school-complaint-system.git
cd school-complaint-system

# 2. 의존성 설치
npm install

# 3. 환경 변수 설정
cp .env.example .env

# 4. 데이터베이스 설정
psql -U postgres -c "CREATE DATABASE complaint_system_dev;"
psql -U postgres -c "CREATE USER dev_user WITH PASSWORD 'dev_password';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE complaint_system_dev TO dev_user;"

# 5. 스키마 적용
psql -h localhost -U dev_user -d complaint_system_dev -f database/schema.sql

# 6. 개발 서버 시작
npm run dev
```

### 권장 VS Code 확장
- ES7+ React/Redux/React-Native snippets
- Prettier - Code formatter  
- ESLint
- GitLens
- Thunder Client (API 테스트)

---

## 💅 코딩 스타일

### JavaScript/Node.js
- **Prettier** 설정을 따릅니다
- **세미콜론** 사용
- **2칸 들여쓰기**
- **camelCase** 변수명
- **PascalCase** 클래스명

### 함수 작성 규칙
```javascript
// ✅ 좋은 예
async function getUserById(userId) {
  try {
    const user = await query('SELECT * FROM users WHERE id = $1', [userId]);
    return user.rows[0];
  } catch (error) {
    logger.error('사용자 조회 실패:', error);
    throw error;
  }
}

// ❌ 나쁜 예  
function getUser(id) {
  return query('SELECT * FROM users WHERE id = $1', [id]);
}
```

### 주석 작성
```javascript
/**
 * 사용자 프로필 업데이트
 * 
 * @param {string} userId - 사용자 ID
 * @param {Object} profileData - 업데이트할 프로필 데이터
 * @returns {Promise<Object>} 업데이트된 사용자 정보
 */
async function updateUserProfile(userId, profileData) {
  // 구현...
}
```

### 파일 구조
```
backend/
├── controllers/     # API 컨트롤러
├── middleware/     # Express 미들웨어
├── models/         # 데이터 모델
├── routes/         # API 라우터
├── utils/          # 유틸리티 함수
└── __tests__/      # 테스트 파일
```

---

## 📝 커밋 메시지 규칙

### Conventional Commits 형식
```
<타입>(<범위>): <설명>

[선택사항인 본문]

[선택사항인 꼬리말]
```

### 커밋 타입
- **✨ feat**: 새로운 기능 추가
- **🐛 fix**: 버그 수정
- **📝 docs**: 문서 수정
- **💅 style**: 코드 포맷팅 (기능 변경 없음)
- **♻️ refactor**: 코드 리팩토링
- **✅ test**: 테스트 추가/수정
- **🔧 chore**: 빌드 프로세스, 도구 설정 변경

### 커밋 예시
```bash
✨ feat(auth): JWT 리프레시 토큰 기능 추가

사용자 세션 연장을 위한 리프레시 토큰 메커니즘 구현
- 토큰 만료 시 자동 갱신
- 보안 강화된 토큰 저장소 적용

Closes #123
```

### 범위 (Scope)
- **auth**: 인증 관련
- **api**: API 관련
- **db**: 데이터베이스 관련
- **ui**: 사용자 인터페이스
- **docs**: 문서
- **test**: 테스트

---

## 🔄 Pull Request 가이드

### PR 체크리스트
PR을 생성하기 전에 다음을 확인해주세요:

- [ ] 코드가 린트 검사를 통과합니다 (`npm run lint`)
- [ ] 모든 테스트가 통과합니다 (`npm test`)
- [ ] 새로운 기능에 대한 테스트를 작성했습니다
- [ ] 문서를 업데이트했습니다 (필요한 경우)
- [ ] 커밋 메시지가 규칙을 따릅니다
- [ ] PR 제목이 명확합니다

### PR 템플릿
```markdown
## 📋 변경사항 요약
이 PR에서 변경된 내용을 간단히 설명해주세요.

## 🔗 관련 이슈
Closes #이슈번호

## 🧪 테스트 방법
변경사항을 테스트하는 방법을 설명해주세요.

## 📸 스크린샷 (UI 변경사항이 있는 경우)
UI 변경사항이 있다면 스크린샷을 첨부해주세요.

## ✅ 체크리스트
- [ ] 코드 리뷰 준비 완료
- [ ] 테스트 통과 확인
- [ ] 문서 업데이트 완료 (필요시)
```

### 리뷰 프로세스
1. **자동 검사**: CI/CD가 코드 품질을 확인합니다
2. **코드 리뷰**: 최소 1명의 리뷰어가 검토합니다
3. **테스트 확인**: 모든 테스트가 통과해야 합니다
4. **문서 확인**: 변경사항이 적절히 문서화되었는지 확인합니다

---

## 🐛 이슈 리포팅

### 버그 리포트 템플릿
```markdown
**🐛 버그 설명**
버그에 대한 명확하고 간결한 설명

**🔄 재현 단계**
1. '...' 페이지로 이동
2. '...' 버튼 클릭
3. '...' 입력
4. 오류 확인

**✅ 예상 동작**
예상했던 동작에 대한 설명

**❌ 실제 동작**
실제로 발생한 동작에 대한 설명

**📸 스크린샷**
가능하다면 스크린샷 첨부

**🖥️ 환경 정보**
- OS: [예: macOS 12.0]
- 브라우저: [예: Chrome 96]
- Node.js: [예: 20.1.0]
- 앱 버전: [예: 1.0.0]

**📋 추가 정보**
기타 관련 정보나 맥락
```

### 기능 요청 템플릿
```markdown
**🚀 기능 설명**
원하는 기능에 대한 명확한 설명

**💡 동기 및 이유**
이 기능이 왜 필요한지 설명

**📝 상세 설명**
기능이 어떻게 작동해야 하는지 상세히 설명

**🎯 사용 사례**
구체적인 사용 시나리오 예시

**📋 추가 고려사항**
기타 고려해야 할 사항들
```

---

## 🧪 테스트

### 테스트 실행
```bash
# 모든 테스트 실행
npm test

# 특정 파일 테스트
npm test -- auth.test.js

# 테스트 커버리지 확인
npm run test:coverage

# 감시 모드로 테스트
npm run test:watch
```

### 테스트 작성 가이드
```javascript
// 좋은 테스트 예시
describe('사용자 인증 API', () => {
  describe('POST /api/auth/login', () => {
    it('유효한 자격증명으로 로그인 성공', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'ValidPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(userData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.tokens.accessToken).toBeDefined();
    });

    it('잘못된 이메일로 로그인 실패', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid@example.com',
          password: 'password123'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });
});
```

---

## 📚 추가 리소스

### 학습 자료
- [Node.js 공식 문서](https://nodejs.org/docs/)
- [Express.js 가이드](https://expressjs.com/guide/)
- [PostgreSQL 튜토리얼](https://www.postgresql.org/docs/)
- [Jest 테스팅 프레임워크](https://jestjs.io/docs/)

### 개발 도구
- [Postman](https://www.postman.com/) - API 테스트
- [pgAdmin](https://www.pgadmin.org/) - PostgreSQL 관리
- [GitHub Desktop](https://desktop.github.com/) - Git GUI

---

## 🏆 기여자 인정

기여해주신 모든 분들께 감사드립니다! 

### 기여 유형
- 🐛 **Bug reports**: 버그 신고
- 💡 **Feature requests**: 기능 제안  
- 💻 **Code**: 코드 기여
- 📖 **Documentation**: 문서 작성
- 🎨 **Design**: UI/UX 디자인
- 🧪 **Testing**: 테스트 작성
- 🌐 **Translation**: 번역
- 💬 **Community**: 커뮤니티 관리

---

## 📞 도움이 필요하신가요?

기여 과정에서 도움이 필요하시면 언제든지 연락해주세요:

- 💬 [GitHub Discussions](https://github.com/indibery/school-complaint-system/discussions)
- 📧 **이메일**: contribute@school-system.com
- 🐛 **버그 신고**: [GitHub Issues](https://github.com/indibery/school-complaint-system/issues)

---

**함께 더 나은 학교 민원시스템을 만들어가요! 🎉**