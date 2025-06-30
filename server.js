/**
 * 🏫 학교 민원시스템 메인 서버
 * 
 * @description Express.js 기반 RESTful API 서버
 * @author indibery
 * @version 1.0.0
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// 미들웨어 및 유틸리티 임포트
const { errorHandler, notFoundHandler } = require('./backend/middleware/errorHandler');
const { dbHealthCheck } = require('./backend/utils/database');
const logger = require('./backend/utils/logger');

// 라우터 임포트
const authRoutes = require('./backend/routes/auth');
const complaintRoutes = require('./backend/routes/complaints');
const visitRoutes = require('./backend/routes/visits');
const securityRoutes = require('./backend/routes/security');
const userRoutes = require('./backend/routes/users');
// const notificationRoutes = require('./backend/routes/notifications');

const app = express();

// =================================
// 🔧 기본 설정
// =================================
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';

// =================================
// 🛡️ 보안 미들웨어
// =================================

// Helmet - 보안 헤더 설정
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS 설정
const corsOptions = {
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate Limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15분
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // 최대 100 요청
  message: {
    error: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.',
    code: 'TOO_MANY_REQUESTS'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// =================================
// 📝 로깅 미들웨어
// =================================
if (NODE_ENV === 'production') {
  app.use(morgan('combined', {
    stream: { write: message => logger.info(message.trim()) }
  }));
} else {
  app.use(morgan('dev'));
}

// =================================
// 📦 기본 미들웨어
// =================================
app.use(compression()); // Gzip 압축
app.use(express.json({ limit: '10mb' })); // JSON 파싱
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // URL 인코딩

// 정적 파일 제공
app.use('/uploads', express.static('uploads'));
app.use('/public', express.static('public'));

// =================================
// 🏥 헬스체크 엔드포인트
// =================================
app.get('/health', async (req, res) => {
  try {
    const dbStatus = await dbHealthCheck();
    
    const healthInfo = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: NODE_ENV,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: dbStatus
    };

    res.status(200).json(healthInfo);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// =================================
// 🚀 API 라우트
// =================================
app.get('/api', (req, res) => {
  res.json({
    message: '🏫 학교 민원시스템 API',
    version: '1.0.0',
    status: 'running',
    endpoints: [
      'GET /health - 시스템 상태 확인',
      'POST /api/auth/login - 로그인',
      'POST /api/auth/register - 회원가입',
      'GET /api/complaints - 민원 목록',
      'POST /api/complaints - 민원 등록',
      'GET /api/visits - 방문 예약 목록',
      'POST /api/visits - 방문 예약',
      'GET /api/security/visitors/current - 현재 방문자 현황',
      'POST /api/security/checkin - 방문자 체크인',
      'POST /api/security/checkout - 방문자 체크아웃',
      'GET /api/users/profile - 내 프로필 조회',
      'PUT /api/users/profile - 프로필 수정',
      'PUT /api/users/password - 비밀번호 변경',
      'GET /api/users/stats - 사용자 통계'
    ],
    documentation: NODE_ENV === 'development' ? '/docs/API.md' : null
  });
});

// API 라우터 연결
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/users', userRoutes);
// app.use('/api/notifications', notificationRoutes);

// =================================
// 🚫 에러 처리 미들웨어
// =================================
app.use(notFoundHandler);
app.use(errorHandler);

// =================================
// 🎯 서버 시작
// =================================
async function startServer() {
  try {
    // 데이터베이스 연결 확인
    await dbHealthCheck();
    logger.info('✅ 데이터베이스 연결 성공');

    // 서버 시작
    const server = app.listen(PORT, HOST, () => {
      logger.info('🚀 서버가 시작되었습니다!');
      logger.info(`📍 주소: http://${HOST}:${PORT}`);
      logger.info(`🌍 환경: ${NODE_ENV}`);
      logger.info(`💾 프로세스 ID: ${process.pid}`);
      
      if (NODE_ENV === 'development') {
        console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    🏫 학교 민원시스템                        ║
║                                                              ║
║  🚀 서버 주소: http://localhost:${PORT}                       ║
║  📊 헬스체크: http://localhost:${PORT}/health                 ║
║  📖 API 문서: http://localhost:${PORT}/api                    ║
║                                                              ║
║  🔧 개발 모드로 실행 중...                                    ║
║  📚 API 라우터 연결 완료:                                     ║
║    - 🔐 /api/auth (인증)                                    ║
║    - 📝 /api/complaints (민원)                              ║
║    - 📅 /api/visits (방문예약)                               ║
║    - 🚪 /api/security (교문관리)                             ║
╚══════════════════════════════════════════════════════════════╝
        `);
      }
    });

    // Graceful shutdown 처리
    const gracefulShutdown = (signal) => {
      logger.info(`${signal} 신호를 받았습니다. 서버를 정상 종료합니다...`);
      
      server.close((err) => {
        if (err) {
          logger.error('서버 종료 중 오류 발생:', err);
          process.exit(1);
        }
        
        logger.info('✅ 서버가 정상적으로 종료되었습니다.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('❌ 서버 시작 실패:', error);
    process.exit(1);
  }
}

// 처리되지 않은 예외 처리
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// 서버 시작
if (require.main === module) {
  startServer();
}

module.exports = app;