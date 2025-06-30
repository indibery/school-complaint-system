// 테스트 헬퍼 확장 - 토큰 관리 기능 추가
const { expectSuccess, expectError } = require('./testHelpers');

// 토큰 블랙리스트 모킹 시스템 확장
global.testData.tokens = global.testData.tokens || new Map();

// 모킹된 데이터베이스 함수 확장
const originalMockDatabase = global.testPool.query.toString();

global.testPool.query = async function(sql, params = []) {
  const sqlLower = sql.toLowerCase().trim();
  
  // 기존 모킹 로직
  if (sqlLower.startsWith('insert into users')) {
    // 기본 파라미터에서 NULL 값 검증
    if (params[0] === null) { // email이 null인 경우
      const error = new Error('null value in column "email" violates not-null constraint');
      error.code = '23502';
      throw error;
    }
    // NOT NULL 제약 조건 검증
    if (params[0] === null || params[0] === undefined) { // email이 null인 경우
      const error = new Error('null value in column "email" violates not-null constraint');
      error.code = '23502';
      throw error;
    }
    
    if (params[1] === null || params[1] === undefined) { // password가 null인 경우
      const error = new Error('null value in column "password" violates not-null constraint');
      error.code = '23502';
      throw error;
    }
    
    if (params[2] === null || params[2] === undefined) { // name이 null인 경우
      const error = new Error('null value in column "name" violates not-null constraint');
      error.code = '23502';
      throw error;
    }

    // 중복 검증은 값이 있을 때만
    const existingUsers = Array.from(global.testData.users.values());
    if (params[0] && existingUsers.some(u => u.email === params[0])) {
      const error = new Error('duplicate key value violates unique constraint "users_email_key"');
      error.code = '23505';
      throw error;
    }

    if (params[3] && existingUsers.some(u => u.phone === params[3])) {
      const error = new Error('duplicate key value violates unique constraint "users_phone_key"');
      error.code = '23505';
      throw error;
    }

    const userId = global.testData.nextUserId++;
    const user = {
      id: userId,
      email: params[0],
      password_hash: params[1], 
      name: params[2],
      phone: params[3] || null,
      role: params[4] || 'parent',
      is_active: params[5] !== undefined ? params[5] : true,
      is_email_verified: params[6] !== undefined ? params[6] : false,
      email_verification_token: null,
      email_verification_expires: null,
      password_reset_token: null,
      password_reset_expires: null,
      last_login_at: null,
      login_attempts: 0,
      locked_until: null,
      token_version: params[7] !== undefined ? params[7] : 0, // token_version 초기값 0
      created_at: new Date(),
      updated_at: new Date(),

      // 이전 버전과의 호환성을 위한 별칭들
      password: params[1], // 이전 버전 호환
      last_login: null    // 이전 버전 호환
    };
    
    global.testData.users.set(userId, user);
    return { rows: [user] };
  }

  // 토큰 블랙리스트 INSERT
  if (sqlLower.startsWith('insert into token_blacklist')) {
    const tokenId = global.testData.nextTokenId++;
    const token = {
      id: tokenId,
      token_id: params[0],  // token_jti를 token_id로 변경
      user_id: params[1],
      token_type: params[2] || 'access',
      expires_at: params[3],
      created_at: new Date()
    };
    
    global.testData.tokens.set(params[0], token); // token_id를 키로 사용
    return { rows: [token] };
  }
  
  // SELECT 문 처리 확장
  if (sqlLower.startsWith('select')) {
    // 토큰 블랙리스트 조회
    if (sqlLower.includes('from token_blacklist') && sqlLower.includes('where token_id = $1')) {
      const tokenId = params[0];
      const token = global.testData.tokens.get(tokenId);
      return { rows: token ? [token] : [] };
    }
    
    // 사용자 조회 (기존 로직)
    if (sqlLower.includes('where email = $1')) {
      const email = params[0];
      for (const user of global.testData.users.values()) {
        if (user.email === email) {
          return { rows: [user] };
        }
      }
      return { rows: [] };
    }
    
    if (sqlLower.includes('where id = $1')) {
      const id = params[0];
      const user = global.testData.users.get(id);
      return { rows: user ? [user] : [] };
    }
    
    if (sqlLower.includes('count(*)')) {
      if (sqlLower.includes('from users')) {
        return { rows: [{ count: global.testData.users.size.toString() }] };
      }
      if (sqlLower.includes('from token_blacklist')) {
        return { rows: [{ count: global.testData.tokens.size.toString() }] };
      }
    }
    
    // 기본 SELECT (모든 사용자)
    if (sqlLower.includes('from users')) {
      return { rows: Array.from(global.testData.users.values()) };
    }
    
    // 모든 토큰 반환
    if (sqlLower.includes('from token_blacklist')) {
      return { rows: Array.from(global.testData.tokens.values()) };
    }
  }
  
  // DELETE 문 처리 확장
  if (sqlLower.startsWith('delete')) {
    if (sqlLower.includes('from users')) {
      global.testData.users.clear();
    }
    if (sqlLower.includes('from token_blacklist')) {
      if (sqlLower.includes('where expires_at < now()')) {
        // 만료된 토큰만 삭제
        const now = new Date();
        for (const [jti, token] of global.testData.tokens.entries()) {
          if (new Date(token.expires_at) < now) {
            global.testData.tokens.delete(jti);
          }
        }
      } else {
        // 모든 토큰 삭제
        global.testData.tokens.clear();
      }
    }
    return { rows: [] };
  }
  
  // UPDATE 문 처리 확장
  if (sqlLower.startsWith('update users')) {
    let userId;
    let user;
    
    // WHERE 절에서 사용자 ID 찾기
    if (sqlLower.includes('where id = $')) {
      userId = params[params.length - 1];
      user = global.testData.users.get(userId);
    } else if (sqlLower.includes('where email = $')) {
      const email = params[params.length - 1];
      for (const [id, u] of global.testData.users.entries()) {
        if (u.email === email) {
          userId = id;
          user = u;
          break;
        }
      }
    }
    
    if (user) {
      // 다양한 UPDATE 패턴 처리
      if (sqlLower.includes('email_verification_token')) {
        user.email_verification_token = params[0];
        user.email_verification_expires = params[1];
        if (params.length > 3) user.is_email_verified = params[2];
      } else if (sqlLower.includes('login_attempts = login_attempts + 1')) {
        // 로그인 실패시 시도 횟수 증가
        user.login_attempts = (user.login_attempts || 0) + 1;
      } else if (sqlLower.includes('login_attempts = $')) {
        // 로그인 시도 횟수 직접 설정
        user.login_attempts = params[0];
      } else if (sqlLower.includes('login_attempts = 0')) {
        // 로그인 성공시 시도 횟수 초기화
        user.login_attempts = 0;
        user.locked_until = null;
        if (sqlLower.includes('last_login_at')) {
          user.last_login_at = new Date();
        }
      } else if (sqlLower.includes('locked_until = $')) {
        // 계정 잠금 설정
        user.locked_until = params[0];
        if (sqlLower.includes('login_attempts')) {
          // 잠금과 함께 시도횟수도 설정
          const attemptsParamIndex = sqlLower.indexOf('login_attempts') > sqlLower.indexOf('locked_until') ? 1 : 0;
          if (params[attemptsParamIndex] !== undefined) {
            user.login_attempts = params[attemptsParamIndex];
          }
        }
      } else if (sqlLower.includes('token_version')) {
        if (sqlLower.includes('token_version + 1')) {
          user.token_version += 1;
        } else {
          user.token_version = params[0];
        }
      } else if (sqlLower.includes('last_login')) {
        user.last_login = params[0];
        if (sqlLower.includes('login_attempts = 0')) {
          user.login_attempts = 0;
        }
      } else if (sqlLower.includes('password_reset_token')) {
        user.password_reset_token = params[0];
        user.password_reset_expires = params[1];
      }
      
      user.updated_at = new Date();
      global.testData.users.set(userId, user);
    }
    return { rows: [] };
  }
  
  // ALTER SEQUENCE (자동 ID 초기화)
  if (sqlLower.includes('alter sequence')) {
    if (sqlLower.includes('users_id_seq')) {
      global.testData.nextUserId = 1;
    }
    if (sqlLower.includes('token_blacklist_id_seq')) {
      global.testData.nextTokenId = 1;
    }
    return { rows: [] };
  }
  
  // NOW() 함수 모킹
  if (sqlLower.includes('now()')) {
    return { rows: [{ now: new Date() }] };
  }
  
  // 기타 CREATE, CREATE INDEX 등은 무시
  return { rows: [] };
};

console.log('✅ Extended mock database with token management');

// 모듈 export
module.exports = {
  mockQuery: global.testPool.query
};
