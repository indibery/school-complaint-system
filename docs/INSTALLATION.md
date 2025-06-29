# 🔧 설치 가이드

## 📋 시스템 요구사항

### 최소 요구사항
- **운영체제**: Ubuntu 20.04+ / CentOS 8+ / Windows 10+ / macOS 12+
- **Node.js**: 20.x LTS 이상
- **PostgreSQL**: 15.x 이상
- **메모리**: 4GB RAM 이상
- **저장공간**: 10GB 이상

### 권장 사양 (프로덕션)
- **CPU**: 4코어 이상
- **메모리**: 8GB RAM 이상
- **저장공간**: 50GB SSD
- **네트워크**: 10Mbps 이상

---

## 🐧 Ubuntu/Debian 설치

### 1. 시스템 업데이트
```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Node.js 설치
```bash
# NodeSource 저장소 추가
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Node.js 설치
sudo apt install -y nodejs

# 버전 확인
node --version  # v20.x.x
npm --version   # v10.x.x
```

### 3. PostgreSQL 설치
```bash
# PostgreSQL 설치
sudo apt install -y postgresql postgresql-contrib

# PostgreSQL 서비스 시작
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 버전 확인
sudo -u postgres psql -c "SELECT version();"
```

### 4. 데이터베이스 설정
```bash
# PostgreSQL 사용자로 전환
sudo -u postgres psql

# SQL 명령어 실행
CREATE DATABASE complaint_system;
CREATE USER complaint_admin WITH PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE complaint_system TO complaint_admin;
ALTER USER complaint_admin CREATEDB;
\q
```

### 5. 프로젝트 클론 및 설정
```bash
# Git 설치 (필요한 경우)
sudo apt install -y git

# 프로젝트 클론
cd /var/www  # 또는 원하는 디렉토리
sudo git clone https://github.com/indibery/school-complaint-system.git
cd school-complaint-system

# 권한 설정
sudo chown -R $USER:$USER .

# 의존성 설치
npm install
```

### 6. 환경 변수 설정
```bash
# 환경 변수 파일 생성
cp .env.example .env

# 환경 변수 편집
nano .env
```

필수 설정 값:
```env
NODE_ENV=production
PORT=3000

# 데이터베이스
DB_HOST=localhost
DB_PORT=5432
DB_NAME=complaint_system
DB_USER=complaint_admin
DB_PASSWORD=your_secure_password_here

# JWT 보안 (강력한 키로 변경 필요)
JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters_long
JWT_REFRESH_SECRET=your_refresh_token_secret_key_minimum_32_characters

# 이메일 설정 (Gmail 예시)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

### 7. 데이터베이스 스키마 적용
```bash
# 스키마 적용
psql -h localhost -U complaint_admin -d complaint_system -f database/schema.sql

# 테스트 데이터 삽입 (개발 환경에서만)
psql -h localhost -U complaint_admin -d complaint_system -f database/test_data.sql
```

### 8. 서버 실행
```bash
# 개발 모드
npm run dev

# 프로덕션 모드
npm start
```

---

## 🍎 macOS 설치

### 1. Homebrew 설치
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. Node.js 및 PostgreSQL 설치
```bash
# Node.js 설치
brew install node@20

# PostgreSQL 설치
brew install postgresql@15

# 서비스 시작
brew services start postgresql@15
```

### 3. 데이터베이스 설정
```bash
# PostgreSQL 사용자 생성 및 데이터베이스 생성
createdb complaint_system
psql complaint_system

CREATE USER complaint_admin WITH PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE complaint_system TO complaint_admin;
\q
```

### 4. 프로젝트 설정
```bash
# 프로젝트 클론
git clone https://github.com/indibery/school-complaint-system.git
cd school-complaint-system

# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일 편집 필요
```

---

## 🪟 Windows 설치

### 1. Node.js 설치
1. [Node.js 공식 사이트](https://nodejs.org/)에서 LTS 버전 다운로드
2. 설치 프로그램 실행 및 기본 설정으로 설치
3. PowerShell에서 버전 확인:
```powershell
node --version
npm --version
```

### 2. PostgreSQL 설치
1. [PostgreSQL 공식 사이트](https://www.postgresql.org/download/windows/)에서 다운로드
2. 설치 중 관리자 비밀번호 설정
3. pgAdmin 4도 함께 설치 권장

### 3. 데이터베이스 설정
PowerShell 또는 pgAdmin 4에서:
```sql
CREATE DATABASE complaint_system;
CREATE USER complaint_admin WITH PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE complaint_system TO complaint_admin;
```

### 4. Git 설치 및 프로젝트 클론
```powershell
# Git이 없는 경우 https://git-scm.com/에서 설치

# 프로젝트 클론
git clone https://github.com/indibery/school-complaint-system.git
cd school-complaint-system

# 의존성 설치
npm install
```

---

## 🐳 Docker 설치 (권장)

### 1. Docker Compose 파일 생성
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: complaint_system
      POSTGRES_USER: complaint_admin
      POSTGRES_PASSWORD: your_secure_password_here
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U complaint_admin"]
      interval: 30s
      timeout: 10s
      retries: 3

  app:
    build: .
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      NODE_ENV: production
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: complaint_system
      DB_USER: complaint_admin
      DB_PASSWORD: your_secure_password_here
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs

volumes:
  postgres_data:
```

### 2. Dockerfile 생성
```dockerfile
FROM node:20-alpine

WORKDIR /app

# 의존성 복사 및 설치
COPY package*.json ./
RUN npm ci --only=production

# 소스 코드 복사
COPY . .

# 포트 노출
EXPOSE 3000

# 헬스체크
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# 서버 시작
CMD ["npm", "start"]
```

### 3. Docker Compose 실행
```bash
# 컨테이너 빌드 및 실행
docker-compose up -d

# 로그 확인
docker-compose logs -f app

# 서비스 중지
docker-compose down
```

---

## 🔧 프로덕션 배포

### 1. PM2를 사용한 프로세스 관리
```bash
# PM2 전역 설치
npm install -g pm2

# 앱 시작
pm2 start server.js --name school-complaint-system

# 부팅 시 자동 시작 설정
pm2 startup
pm2 save

# 모니터링
pm2 monit

# 로그 확인
pm2 logs school-complaint-system
```

### 2. Nginx 리버스 프록시 설정
```bash
# Nginx 설치
sudo apt install -y nginx

# 설정 파일 생성
sudo nano /etc/nginx/sites-available/school-complaint-system
```

Nginx 설정:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# 설정 활성화
sudo ln -s /etc/nginx/sites-available/school-complaint-system /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 3. SSL 인증서 설정 (Let's Encrypt)
```bash
# Certbot 설치
sudo apt install -y certbot python3-certbot-nginx

# SSL 인증서 발급
sudo certbot --nginx -d your-domain.com

# 자동 갱신 설정
sudo crontab -e
# 다음 줄 추가: 0 12 * * * /usr/bin/certbot renew --quiet
```

---

## 🔐 보안 설정

### 1. 방화벽 설정
```bash
# UFW 설치 및 활성화
sudo apt install -y ufw
sudo ufw enable

# 필요한 포트만 허용
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443

# 상태 확인
sudo ufw status
```

### 2. PostgreSQL 보안 설정
```bash
# PostgreSQL 설정 파일 편집
sudo nano /etc/postgresql/15/main/pg_hba.conf

# 다음 줄을 찾아서 수정
# local   all             all                                     peer
# 를 다음으로 변경:
# local   all             all                                     md5

# PostgreSQL 재시작
sudo systemctl restart postgresql
```

### 3. 환경 변수 보안
```bash
# .env 파일 권한 설정
chmod 600 .env

# 소유자만 읽기 가능하도록 설정
chown $USER:$USER .env
```

---

## 📊 모니터링 설정

### 1. 로그 모니터링
```bash
# 로그 파일 확인
tail -f logs/app.log

# PM2 로그 확인
pm2 logs --lines 100
```

### 2. 시스템 리소스 모니터링
```bash
# htop 설치
sudo apt install -y htop

# 실시간 모니터링
htop

# 디스크 사용량 확인
df -h

# 메모리 사용량 확인
free -h
```

---

## 🔧 문제 해결

### 일반적인 문제들

#### 1. 포트 3000 이미 사용 중
```bash
# 포트 사용 프로세스 확인
sudo lsof -i :3000

# 프로세스 종료
sudo kill -9 <PID>
```

#### 2. PostgreSQL 연결 실패
```bash
# PostgreSQL 상태 확인
sudo systemctl status postgresql

# 서비스 재시작
sudo systemctl restart postgresql

# 로그 확인
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

#### 3. 권한 문제
```bash
# 프로젝트 디렉토리 권한 수정
sudo chown -R $USER:$USER /path/to/project
chmod -R 755 /path/to/project
```

#### 4. 의존성 설치 실패
```bash
# npm 캐시 클리어
npm cache clean --force

# node_modules 삭제 후 재설치
rm -rf node_modules package-lock.json
npm install
```

---

## 📝 설치 완료 확인

### 1. 서버 상태 확인
```bash
curl http://localhost:3000/health
```

예상 응답:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:00:00.000Z",
  "version": "1.0.0",
  "environment": "production",
  "database": {
    "status": "connected",
    "responseTime": "15ms"
  }
}
```

### 2. API 테스트
```bash
curl http://localhost:3000/api
```

### 3. 데이터베이스 연결 테스트
```bash
psql -h localhost -U complaint_admin -d complaint_system -c "SELECT COUNT(*) FROM users;"
```

---

## 🚀 다음 단계

설치가 완료되면:
1. **API 개발**: 컨트롤러 및 라우터 구현
2. **모바일 앱**: React Native 개발 시작
3. **웹 관리자**: React.js 대시보드 개발
4. **테스트**: 통합 테스트 작성
5. **배포**: CI/CD 파이프라인 구축

---

## 📞 지원

설치 중 문제가 발생하면:
- **GitHub Issues**: [이슈 등록](https://github.com/indibery/school-complaint-system/issues)
- **이메일**: support@school-system.com
- **문서**: [API 문서](docs/API.md) 참조