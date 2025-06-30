/**
 * 💾 데이터베이스 유틸리티
 * 
 * @description PostgreSQL 연결 및 유틸리티 함수
 */

const { Pool } = require('pg');
const logger = require('./logger');

/**
 * PostgreSQL 연결 풀 설정
 */
let pool;

if (process.env.NODE_ENV === 'test') {
  // 테스트 환경에서는 모킹된 pool 사용
  pool = global.testPool || {
    query: async (text, params) => {
      // 모킹된 데이터베이스 처리
      const mockDatabase = require('../tests/helpers/mockExtensions');
      return await mockDatabase.mockQuery(text, params);
    },
    connect: async () => ({
      query: async (text, params) => {
        const mockDatabase = require('../tests/helpers/mockExtensions');
        return await mockDatabase.mockQuery(text, params);
      },
      release: () => {}
    }),
    totalCount: 1,
    idleCount: 1,
    waitingCount: 0
  };
} else {
  pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'complaint_system',
    user: process.env.DB_USER || 'complaint_admin',
    password: process.env.DB_PASSWORD,
    max: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
}

/**
 * 데이터베이스 연결 이벤트 리스너
 */
if (process.env.NODE_ENV !== 'test') {
  pool.on('connect', (client) => {
    logger.debug('새로운 데이터베이스 클라이언트가 연결되었습니다.');
  });

  pool.on('error', (err, client) => {
    logger.error('데이터베이스 풀에서 오류가 발생했습니다.', err);
  });
}

/**
 * 데이터베이스 연결 상태 확인
 */
async function dbHealthCheck() {
  const startTime = Date.now();
  
  try {
    if (process.env.NODE_ENV === 'test') {
      // 테스트 환경에서는 모킹된 응답 반환
      return {
        status: 'connected',
        responseTime: '1ms',
        currentTime: new Date(),
        version: 'Mock PostgreSQL 14.0',
        poolInfo: {
          totalConnections: 1,
          idleConnections: 1,
          waitingRequests: 0
        }
      };
    }
    
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as version');
    const responseTime = Date.now() - startTime;
    
    client.release();
    
    return {
      status: 'connected',
      responseTime: `${responseTime}ms`,
      currentTime: result.rows[0].current_time,
      version: result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1],
      poolInfo: {
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingRequests: pool.waitingCount
      }
    };
  } catch (error) {
    logger.error('데이터베이스 헬스체크 실패:', error);
    throw new Error(`데이터베이스 연결 실패: ${error.message}`);
  }
}

/**
 * 쿼리 실행 래퍼 함수
 */
async function query(text, params = []) {
  const startTime = Date.now();
  
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - startTime;
    
    logger.query(text, params, duration);
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('데이터베이스 쿼리 오류:', {
      sql: text,
      params,
      duration: `${duration}ms`,
      error: error.message
    });
    throw error;
  }
}

/**
 * 트랜잭션 실행 함수
 */
async function transaction(callback) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    logger.debug('트랜잭션 시작');
    
    const result = await callback(client);
    
    await client.query('COMMIT');
    logger.debug('트랜잭션 커밋');
    
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('트랜잭션 롤백:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 페이지네이션을 위한 쿼리 빌더
 */
function buildPaginationQuery(baseQuery, page = 1, limit = 10, orderBy = 'created_at', orderDirection = 'DESC') {
  const offset = (page - 1) * limit;
  const paginatedQuery = `
    ${baseQuery}
    ORDER BY ${orderBy} ${orderDirection}
    LIMIT $${baseQuery.split('$').length} OFFSET $${baseQuery.split('$').length + 1}
  `;
  
  return {
    query: paginatedQuery,
    countQuery: `SELECT COUNT(*) FROM (${baseQuery}) as count_query`,
    params: [limit, offset]
  };
}

/**
 * 검색 조건 빌더
 */
function buildSearchCondition(searchTerm, searchFields) {
  if (!searchTerm || !searchFields || searchFields.length === 0) {
    return { condition: '', params: [] };
  }
  
  const conditions = searchFields.map((field, index) => {
    return `${field} ILIKE $${index + 1}`;
  });
  
  const condition = `(${conditions.join(' OR ')})`;
  const params = searchFields.map(() => `%${searchTerm}%`);
  
  return { condition, params };
}

/**
 * 데이터베이스 스키마 검증
 */
async function validateSchema() {
  try {
    const tables = ['users', 'complaints', 'visit_reservations', 'notifications'];
    const results = {};
    
    for (const table of tables) {
      const result = await query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table]);
      
      results[table] = result.rows;
    }
    
    logger.info('데이터베이스 스키마 검증 완료');
    return results;
  } catch (error) {
    logger.error('스키마 검증 실패:', error);
    throw error;
  }
}

/**
 * 연결 풀 종료
 */
async function closePool() {
  try {
    await pool.end();
    logger.info('데이터베이스 연결 풀이 종료되었습니다.');
  } catch (error) {
    logger.error('연결 풀 종료 중 오류 발생:', error);
  }
}

/**
 * 데이터베이스 통계 정보
 */
async function getStats() {
  try {
    const stats = await query(`
      SELECT 
        schemaname,
        tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        n_live_tup as live_tuples,
        n_dead_tup as dead_tuples
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
    `);
    
    return stats.rows;
  } catch (error) {
    logger.error('데이터베이스 통계 조회 실패:', error);
    throw error;
  }
}

module.exports = {
  pool,
  query,
  transaction,
  dbHealthCheck,
  buildPaginationQuery,
  buildSearchCondition,
  validateSchema,
  closePool,
  getStats
};