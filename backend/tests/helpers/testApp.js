const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// 테스트 환경용 Express 앱 생성
function createTestApp() {
  const app = express();

  // 기본 미들웨어 설정
  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

  // 모킹된 인증 라우터
  setupMockedAuthRoutes(app);

  // 헬스체크 엔드포인트
  app.get('/health', (req, res) => {
    res.json({ 
      success: true, 
      message: 'Test server is running',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV 
    });
  });

  // 404 핸들러
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      message: 'API endpoint not found',
      path: req.originalUrl
    });
  });

  // 에러 핸들러
  app.use((err, req, res, next) => {
    console.error('Test App Error:', err);
    
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'test' && { stack: err.stack })
    });
  });

  return app;
}

// 모킹된 인증 라우터 설정
function setupMockedAuthRoutes(app) {
  
  // POST /api/auth/register - 회원가입
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password, name, phone, role = 'parent' } = req.body;

      // 입력 유효성 검사
      if (!email || !password || !name) {
        return res.status(400).json({
          success: false,
          message: '이메일, 비밀번호, 이름은 필수입니다.'
        });
      }

      // 이메일 형식 검사
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: '유효한 이메일 주소를 입력해주세요.'
        });
      }

      // 비밀번호 강도 검사 - 더욱 엄격하게
      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          message: '비밀번호는 8자 이상이어야 합니다.'
        });
      }

      if (!/(?=.*[a-z])/.test(password)) {
        return res.status(400).json({
          success: false,
          message: '비밀번호는 소문자를 포함해야 합니다.'
        });
      }

      if (!/(?=.*[A-Z])/.test(password)) {
        return res.status(400).json({
          success: false,
          message: '비밀번호는 대문자를 포함해야 합니다.'
        });
      }

      if (!/(?=.*\d)/.test(password)) {
        return res.status(400).json({
          success: false,
          message: '비밀번호는 숫자를 포함해야 합니다.'
        });
      }

      if (!/(?=.*[!@#$%^&*])/.test(password)) {
        return res.status(400).json({
          success: false,
          message: '비밀번호는 특수문자(!@#$%^&*)를 포함해야 합니다.'
        });
      }

      // 역할 검증
      const validRoles = ['parent', 'teacher', 'admin', 'guard'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: '유효하지 않은 역할입니다.'
        });
      }

      // 전화번호 검증 (있는 경우)
      if (phone && !/^010-\d{4}-\d{4}$/.test(phone)) {
        return res.status(400).json({
          success: false,
          message: '유효한 한국 전화번호를 입력해주세요. (예: 010-1234-5678)'
        });
      }

      // 중복 검사
      const normalizedEmailForCheck = email.toLowerCase();
      let normalizedPhoneForCheck = phone;
      if (phone) {
        normalizedPhoneForCheck = phone.replace(/[^\d]/g, '');
        if (normalizedPhoneForCheck.length === 11 && normalizedPhoneForCheck.startsWith('010')) {
          normalizedPhoneForCheck = normalizedPhoneForCheck.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
        }
      }

      for (const user of global.testData.users.values()) {
        if (user.email === normalizedEmailForCheck) {
          return res.status(409).json({
            success: false,
            message: '이미 사용 중인 이메일입니다.'
          });
        }
        if (normalizedPhoneForCheck && user.phone === normalizedPhoneForCheck) {
          return res.status(409).json({
            success: false,
            message: '이미 사용 중인 전화번호입니다.'
          });
        }
      }

      // 사용자 생성
      const userId = global.testData.nextUserId++;
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // 데이터 정규화
      const normalizedEmail = email.toLowerCase();
      let normalizedPhone = phone;
      if (phone) {
        normalizedPhone = phone.replace(/[^\d]/g, ''); // 숫자만 추출
        if (normalizedPhone.length === 11 && normalizedPhone.startsWith('010')) {
          normalizedPhone = normalizedPhone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
        }
      }
      
      const user = {
        id: userId,
        email: normalizedEmail,
        password: hashedPassword,
        name,
        phone: normalizedPhone || null,
        role,
        is_active: true,
        is_email_verified: false,
        email_verification_token: uuidv4(),
        email_verification_expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        password_reset_token: null,
        password_reset_expires: null,
        last_login: null,
        login_attempts: 0,
        locked_until: null,
        token_version: 0,
        created_at: new Date(),
        updated_at: new Date()
      };

      global.testData.users.set(userId, user);

      // 응답 (비밀번호 제외)
      const { password: _, ...userResponse } = user;
      
      res.status(201).json({
        success: true,
        message: '회원가입이 완료되었습니다. 이메일 인증을 진행해주세요.',
        data: {
          user: userResponse
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
        error: error.message
      });
    }
  });

  // POST /api/auth/validate-registration - 회원가입 유효성 검증
  app.post('/api/auth/validate-registration', (req, res) => {
    const { email, phone } = req.body;
    
    let emailAvailable = true;
    let phoneAvailable = true;

    for (const user of global.testData.users.values()) {
      if (email && user.email === email) {
        emailAvailable = false;
      }
      if (phone && user.phone === phone) {
        phoneAvailable = false;
      }
    }

    res.json({
      success: true,
      data: {
        emailAvailable,
        phoneAvailable
      }
    });
  });

  // POST /api/auth/verify-email - 이메일 인증
  app.post('/api/auth/verify-email', (req, res) => {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: '인증 토큰이 필요합니다.'
      });
    }

    if (token.length < 10) {
      return res.status(400).json({
        success: false,
        message: '유효하지 않은 토큰 형식입니다.'
      });
    }

    // 토큰으로 사용자 찾기
    let foundUser = null;
    let userId = null;

    for (const [id, user] of global.testData.users.entries()) {
      if (user.email_verification_token === token) {
        foundUser = user;
        userId = id;
        break;
      }
    }

    if (!foundUser) {
      return res.status(400).json({
        success: false,
        message: '유효하지 않은 인증 토큰입니다.'
      });
    }

    if (foundUser.is_email_verified) {
      return res.status(400).json({
        success: false,
        message: '이미 인증된 계정입니다.'
      });
    }

    if (new Date() > new Date(foundUser.email_verification_expires)) {
      return res.status(400).json({
        success: false,
        message: '만료된 인증 토큰입니다.'
      });
    }

    // 이메일 인증 완료
    foundUser.is_email_verified = true;
    foundUser.email_verification_token = null;
    foundUser.email_verification_expires = null;
    foundUser.updated_at = new Date();

    global.testData.users.set(userId, foundUser);

    res.json({
      success: true,
      message: '이메일 인증이 완료되었습니다.'
    });
  });

  // POST /api/auth/login - 로그인
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password, rememberMe = false } = req.body;

      // 입력 유효성 검사
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: '이메일과 비밀번호를 입력해주세요.'
        });
      }

      // 이메일 형식 검사
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: '유효한 이메일 주소를 입력해주세요.'
        });
      }

      // IP 기반 브루트포스 방어 (간단한 시뮬레이션)
      const clientIP = req.ip || '127.0.0.1';
      if (!global.testData.ipAttempts) {
        global.testData.ipAttempts = new Map();
      }
      
      const ipAttempts = global.testData.ipAttempts.get(clientIP) || 0;
      if (ipAttempts >= 20) {
        return res.status(429).json({
          success: false,
          message: '너무 많은 로그인 시도입니다. 잠시 후 다시 시도해주세요.'
        });
      }

      // 사용자 찾기
      let foundUser = null;
      let userId = null;

      for (const [id, user] of global.testData.users.entries()) {
        if (user.email === email.toLowerCase()) {
          foundUser = user;
          userId = id;
          break;
        }
      }

      if (!foundUser) {
        // IP 실패 횟수 증가
        global.testData.ipAttempts.set(clientIP, ipAttempts + 1);
        
        return res.status(401).json({
          success: false,
          message: '이메일 또는 비밀번호가 올바르지 않습니다.'
        });
      }

      // 계정 잠금 검사
      if (foundUser.locked_until && new Date() < new Date(foundUser.locked_until)) {
        const remainingTime = Math.ceil((new Date(foundUser.locked_until) - new Date()) / (1000 * 60));
        return res.status(423).json({
          success: false,
          message: `계정이 잠겨있습니다. ${remainingTime}분 후에 다시 시도해주세요.`
        });
      }

      // 비밀번호 검증
      const isValidPassword = await bcrypt.compare(password, foundUser.password);
      if (!isValidPassword) {
        // 실패 횟수 증가
        foundUser.login_attempts += 1;
        
        // IP 실패 횟수 증가
        global.testData.ipAttempts.set(clientIP, ipAttempts + 1);
        
        // 5회 실패시 계정 잠금 (30분)
        if (foundUser.login_attempts >= 5) {
          foundUser.locked_until = new Date(Date.now() + 30 * 60 * 1000);
        }
        
        foundUser.updated_at = new Date();
        global.testData.users.set(userId, foundUser);

        return res.status(401).json({
          success: false,
          message: '이메일 또는 비밀번호가 올바르지 않습니다.'
        });
      }

      // 계정 상태 검사
      if (!foundUser.is_active) {
        return res.status(403).json({
          success: false,
          message: '비활성화된 계정입니다.'
        });
      }

      if (!foundUser.is_email_verified) {
        return res.status(403).json({
          success: false,
          message: '이메일 인증이 필요합니다.'
        });
      }

      // 로그인 성공 처리
      foundUser.login_attempts = 0;
      foundUser.last_login = new Date();
      // foundUser.token_version += 1; // 로그인 시 토큰 버전을 증가시키지 않음
      foundUser.locked_until = null;
      foundUser.updated_at = new Date();
      global.testData.users.set(userId, foundUser);
      
      // IP 실패 횟수 초기화
      global.testData.ipAttempts.set(clientIP, 0);

      // JWT 토큰 생성
      const accessTokenPayload = {
        userId: foundUser.id,
        tokenVersion: foundUser.token_version,
        type: 'access',
        jti: uuidv4()
      };

      const refreshTokenPayload = {
        userId: foundUser.id,
        tokenVersion: foundUser.token_version,
        type: 'refresh',
        jti: uuidv4()
      };

      const accessToken = jwt.sign(accessTokenPayload, process.env.JWT_SECRET, { expiresIn: '24h' });
      const refreshToken = jwt.sign(refreshTokenPayload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

      // 응답
      const { password: _, ...userResponse } = foundUser;
      
      res.json({
        success: true,
        message: '로그인 성공',
        data: {
          user: userResponse,
          tokens: {
            accessToken,
            refreshToken,
            tokenType: 'Bearer',
            expiresIn: process.env.JWT_EXPIRES_IN || '24h'
          }
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
        error: error.message
      });
    }
  });

  // POST /api/auth/logout - 로그아웃
  app.post('/api/auth/logout', authenticateToken, (req, res) => {
    // 토큰을 블랙리스트에 추가
    if (req.tokenPayload) {
      const tokenData = {
        id: global.testData.nextTokenId++,
        token_jti: req.tokenPayload.jti,
        user_id: req.tokenPayload.userId,
        token_type: 'access',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        created_at: new Date()
      };
      global.testData.tokens.set(req.tokenPayload.jti, tokenData);
    }

    res.json({
      success: true,
      message: '로그아웃되었습니다.'
    });
  });

  // POST /api/auth/resend-verification - 인증 이메일 재발송
  app.post('/api/auth/resend-verification', authenticateToken, (req, res) => {
    const user = global.testData.users.get(req.tokenPayload.userId);
    
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: '비활성화된 계정입니다.'
      });
    }

    if (user.is_email_verified) {
      return res.status(400).json({
        success: false,
        message: '이미 인증된 계정입니다.'
      });
    }

    // 새로운 인증 토큰 생성
    user.email_verification_token = uuidv4();
    user.email_verification_expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    user.updated_at = new Date();
    
    global.testData.users.set(req.tokenPayload.userId, user);

    res.json({
      success: true,
      message: '인증 이메일이 재발송되었습니다.'
    });
  });

  // POST /api/auth/logout-all - 모든 디바이스 로그아웃
  app.post('/api/auth/logout-all', authenticateToken, (req, res) => {
    const { userId } = req.body;
    const currentUser = global.testData.users.get(req.tokenPayload.userId);
    
    // 다른 사용자 로그아웃 시도시 권한 확인
    if (userId && userId !== req.tokenPayload.userId) {
      if (currentUser.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: '권한이 없습니다.'
        });
      }
      
      // 관리자가 다른 사용자 로그아웃
      const targetUser = global.testData.users.get(userId);
      if (targetUser) {
        targetUser.token_version += 1;
        targetUser.updated_at = new Date();
        global.testData.users.set(userId, targetUser);
      }
      
      return res.json({
        success: true,
        message: '사용자의 모든 세션이 종료되었습니다.'
      });
    }
    
    // 자신의 모든 디바이스 로그아웃
    currentUser.token_version += 1;
    currentUser.updated_at = new Date();
    global.testData.users.set(req.tokenPayload.userId, currentUser);
    
    // 현재 토큰도 블랙리스트에 추가
    const tokenData = {
      id: global.testData.nextTokenId++,
      token_jti: req.tokenPayload.jti,
      user_id: req.tokenPayload.userId,
      token_type: 'access',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      created_at: new Date()
    };
    global.testData.tokens.set(req.tokenPayload.jti, tokenData);

    res.json({
      success: true,
      message: '모든 디바이스에서 로그아웃되었습니다.'
    });
  });

  // POST /api/auth/refresh - 토큰 갱신
  app.post('/api/auth/refresh', (req, res) => {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: '리프레시 토큰이 필요합니다.'
      });
    }

    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      
      // 블랙리스트 확인
      if (global.testData.tokens.has(decoded.jti)) {
        return res.status(401).json({
          success: false,
          message: '무효화된 토큰입니다.'
        });
      }

      // 사용자 확인
      const user = global.testData.users.get(decoded.userId);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: '유효하지 않은 사용자입니다.'
        });
      }

      // 토큰 버전 확인
      if (decoded.tokenVersion !== user.token_version) {
        return res.status(401).json({
          success: false,
          message: '토큰 버전이 일치하지 않습니다.'
        });
      }

      // 기존 토큰들 블랙리스트에 추가
      const oldAccessTokenData = {
        id: global.testData.nextTokenId++,
        token_jti: decoded.jti + '-old-access',
        user_id: decoded.userId,
        token_type: 'access',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        created_at: new Date()
      };
      
      const oldRefreshTokenData = {
        id: global.testData.nextTokenId++,
        token_jti: decoded.jti,
        user_id: decoded.userId,
        token_type: 'refresh',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        created_at: new Date()
      };
      
      global.testData.tokens.set(decoded.jti + '-old-access', oldAccessTokenData);
      global.testData.tokens.set(decoded.jti, oldRefreshTokenData);

      // 새로운 토큰 생성
      const newAccessTokenPayload = {
        userId: user.id,
        tokenVersion: user.token_version,
        type: 'access',
        jti: uuidv4()
      };

      const newRefreshTokenPayload = {
        userId: user.id,
        tokenVersion: user.token_version,
        type: 'refresh',
        jti: uuidv4()
      };

      const newAccessToken = jwt.sign(newAccessTokenPayload, process.env.JWT_SECRET, { expiresIn: '24h' });
      const newRefreshToken = jwt.sign(newRefreshTokenPayload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

      res.json({
        success: true,
        data: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken
        }
      });

    } catch (error) {
      return res.status(401).json({
        success: false,
        message: '유효하지 않은 리프레시 토큰입니다.'
      });
    }
  });

  // GET /api/auth/me - 사용자 정보 조회
  app.get('/api/auth/me', authenticateToken, (req, res) => {
    const user = global.testData.users.get(req.tokenPayload.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    const { password, ...userResponse } = user;
    
    res.json({
      success: true,
      data: {
        user: userResponse
      }
    });
  });
}

// 모킹된 인증 미들웨어
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: '인증이 필요합니다.'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 블랙리스트 검사
    if (global.testData.tokens.has(decoded.jti)) {
      return res.status(401).json({
        success: false,
        message: '무효화된 토큰입니다.'
      });
    }

    // 사용자 존재 확인
    const user = global.testData.users.get(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '유효하지 않은 사용자입니다.'
      });
    }

    // 토큰 버전 확인
    if (decoded.tokenVersion !== user.token_version) {
      return res.status(401).json({
        success: false,
        message: '토큰 버전이 일치하지 않습니다.'
      });
    }

    req.user = user;
    req.tokenPayload = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: '유효하지 않은 토큰입니다.'
    });
  }
}

module.exports = { createTestApp };