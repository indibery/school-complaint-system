/**
 * 메모리 DB용 테스트 헬퍼 함수들
 * 기존 testHelpers.js와 병렬로 사용 가능
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getMemoryDb } = require('./memoryDb');

// JWT 설정 (실제 환경과 동일하게)
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-memory-db';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'school-complaint-system';
const JWT_ISSUER = process.env.JWT_ISSUER || 'school-complaint-api';

class MemoryTestHelpers {
  constructor() {
    this.memoryDb = getMemoryDb();
  }

  /**
   * 메모리 DB 초기화 및 연결
   */
  async setupMemoryDb() {
    if (!this.memoryDb.isConnected) {
      await this.memoryDb.connect();
    }
    await this.memoryDb.cleanup();
    console.log('🧪 Memory test database setup completed');
  }

  /**
   * 메모리 DB 정리
   */
  async cleanupMemoryDb() {
    await this.memoryDb.cleanup();
    console.log('🧹 Memory test database cleaned up');
  }

  /**
   * 메모리 DB 연결 종료
   */
  async closeMemoryDb() {
    await this.memoryDb.close();
    console.log('📄 Memory test database closed');
  }

  /**
   * 테스트용 사용자 생성 (메모리 DB)
   */
  async createTestUser(userData = {}) {
    const user = await this.memoryDb.createTestUser(userData);
    console.log(`👤 Created test user in memory: ${user.email} (${user.role})`);
    return user;
  }

  /**
   * 테스트용 관리자 사용자 생성
   */
  async createAdminUser(userData = {}) {
    const adminData = {
      role: 'admin',
      name: '테스트 관리자',
      email: `admin${Date.now()}@test.com`,
      ...userData
    };
    return await this.createTestUser(adminData);
  }

  /**
   * 테스트용 교사 사용자 생성
   */
  async createTeacherUser(userData = {}) {
    const teacherData = {
      role: 'teacher',
      name: '테스트 교사',
      email: `teacher${Date.now()}@test.com`,
      ...userData
    };
    return await this.createTestUser(teacherData);
  }

  /**
   * 테스트용 민원 생성 (메모리 DB)
   */
  async createTestComplaint(userId, complaintData = {}) {
    const complaint = await this.memoryDb.createTestComplaint(userId, complaintData);
    console.log(`📝 Created test complaint in memory: ${complaint.title}`);
    return complaint;
  }

  /**
   * JWT 토큰 생성 (실제 환경과 동일한 설정)
   */
  generateTestToken(user, expiresIn = '1h') {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    return jwt.sign(payload, JWT_SECRET, {
      expiresIn,
      audience: JWT_AUDIENCE,
      issuer: JWT_ISSUER
    });
  }

  /**
   * Authorization 헤더 생성
   */
  getAuthHeader(user) {
    const token = this.generateTestToken(user);
    return `Bearer ${token}`;
  }

  /**
   * 다중 사용자 생성 (성능 테스트용)
   */
  async createMultipleUsers(count = 10, baseRole = 'parent') {
    const users = [];
    const db = this.memoryDb.getDb();

    // 배치 삽입으로 성능 최적화
    await db.exec('BEGIN TRANSACTION');

    try {
      for (let i = 0; i < count; i++) {
        const userData = {
          role: baseRole,
          email: `test${Date.now()}_${i}@example.com`,
          name: `테스트 사용자 ${i + 1}`
        };
        
        const user = await this.createTestUser(userData);
        users.push(user);
      }

      await db.exec('COMMIT');
      console.log(`👥 Created ${count} test users in memory database`);
      
      return users;
    } catch (error) {
      await db.exec('ROLLBACK');
      throw error;
    }
  }

  /**
   * 다중 민원 생성 (성능 테스트용)
   */
  async createMultipleComplaints(userId, count = 5) {
    const complaints = [];
    const db = this.memoryDb.getDb();

    await db.exec('BEGIN TRANSACTION');

    try {
      for (let i = 0; i < count; i++) {
        const complaintData = {
          title: `테스트 민원 ${i + 1}`,
          description: `민원 내용 ${i + 1}`,
          category: ['facility', 'meal', 'safety', 'education'][i % 4],
          priority: ['low', 'medium', 'high'][i % 3]
        };
        
        const complaint = await this.createTestComplaint(userId, complaintData);
        complaints.push(complaint);
      }

      await db.exec('COMMIT');
      console.log(`📝 Created ${count} test complaints in memory database`);
      
      return complaints;
    } catch (error) {
      await db.exec('ROLLBACK');
      throw error;
    }
  }

  /**
   * 데이터베이스 상태 확인
   */
  async getDatabaseStats() {
    const db = this.memoryDb.getDb();
    
    const stats = {
      users: await db.get('SELECT COUNT(*) as count FROM users'),
      complaints: await db.get('SELECT COUNT(*) as count FROM complaints'),
      notifications: await db.get('SELECT COUNT(*) as count FROM notifications'),
      visitReservations: await db.get('SELECT COUNT(*) as count FROM visit_reservations')
    };

    console.log('📊 Memory Database Stats:', {
      users: stats.users.count,
      complaints: stats.complaints.count,
      notifications: stats.notifications.count,
      visitReservations: stats.visitReservations.count
    });

    return stats;
  }

  /**
   * SQL 쿼리 직접 실행 (디버깅용)
   */
  async executeQuery(sql, params = []) {
    return await this.memoryDb.query(sql, params);
  }

  /**
   * 테이블 스키마 확인 (디버깅용)
   */
  async getTableSchema(tableName) {
    const db = this.memoryDb.getDb();
    return await db.all(`PRAGMA table_info(${tableName})`);
  }

  /**
   * 모든 테이블 목록 조회
   */
  async getAllTables() {
    const db = this.memoryDb.getDb();
    const tables = await db.all(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);
    
    console.log('📋 Available tables:', tables.map(t => t.name));
    return tables;
  }

  /**
   * 성능 측정 헬퍼
   */
  async measurePerformance(testName, testFunction) {
    const startTime = process.hrtime.bigint();
    
    try {
      const result = await testFunction();
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // ms로 변환
      
      console.log(`⚡ ${testName} completed in ${duration.toFixed(2)}ms`);
      return { result, duration };
    } catch (error) {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;
      
      console.log(`❌ ${testName} failed after ${duration.toFixed(2)}ms`);
      throw error;
    }
  }

  /**
   * 메모리 사용량 확인
   */
  getMemoryUsage() {
    const usage = process.memoryUsage();
    const memoryInfo = {
      rss: `${Math.round(usage.rss / 1024 / 1024 * 100) / 100} MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100} MB`,
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100} MB`,
      external: `${Math.round(usage.external / 1024 / 1024 * 100) / 100} MB`
    };
    
    console.log('💾 Memory Usage:', memoryInfo);
    return memoryInfo;
  }
}

// 싱글톤 인스턴스
let memoryTestHelpersInstance = null;

/**
 * 메모리 테스트 헬퍼 싱글톤 인스턴스 반환
 */
function getMemoryTestHelpers() {
  if (!memoryTestHelpersInstance) {
    memoryTestHelpersInstance = new MemoryTestHelpers();
  }
  return memoryTestHelpersInstance;
}

module.exports = {
  MemoryTestHelpers,
  getMemoryTestHelpers
};
