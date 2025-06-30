/**
 * 메모리 기반 SQLite 데이터베이스 클래스
 * 테스트용으로 PostgreSQL을 대체하여 빠른 테스트 실행과 완전한 격리 제공
 */

const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const bcrypt = require('bcryptjs');

class MemoryDatabase {
  constructor() {
    this.db = null;
    this.isConnected = false;
  }

  /**
   * 메모리 DB 연결 및 테이블 생성
   */
  async connect() {
    try {
      this.db = await open({
        filename: ':memory:',
        driver: sqlite3.Database
      });
      
      // SQLite 설정 최적화
      await this.db.exec('PRAGMA journal_mode = MEMORY');
      await this.db.exec('PRAGMA synchronous = OFF');
      await this.db.exec('PRAGMA cache_size = 1000000');
      await this.db.exec('PRAGMA locking_mode = EXCLUSIVE');
      await this.db.exec('PRAGMA temp_store = MEMORY');
      
      await this.createTables();
      this.isConnected = true;
      
      console.log('📄 Memory Database connected successfully');
      return this.db;
    } catch (error) {
      console.error('❌ Memory Database connection failed:', error);
      throw error;
    }
  }

  /**
   * PostgreSQL 스키마를 SQLite로 변환하여 테이블 생성
   */
  async createTables() {
    // 1. Users 테이블 (PostgreSQL UUID → SQLite TEXT)
    await this.db.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        role TEXT NOT NULL DEFAULT 'parent',
        is_active BOOLEAN DEFAULT 1,
        email_verified BOOLEAN DEFAULT 0,
        profile_image TEXT,
        email_notifications BOOLEAN DEFAULT 1,
        sms_notifications BOOLEAN DEFAULT 0,
        language TEXT DEFAULT 'ko',
        timezone TEXT DEFAULT 'Asia/Seoul',
        login_attempts INTEGER DEFAULT 0,
        locked_until DATETIME NULL,
        last_login_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        CHECK (role IN ('parent', 'teacher', 'admin', 'security'))
      );
    `);

    // 2. Complaints 테이블
    await this.db.exec(`
      CREATE TABLE complaints (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        priority TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'submitted',
        anonymous BOOLEAN DEFAULT 0,
        is_deleted BOOLEAN DEFAULT 0,
        resolved_at DATETIME NULL,
        deleted_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CHECK (category IN ('facility', 'meal', 'safety', 'education', 'administration', 'other')),
        CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
        CHECK (status IN ('submitted', 'in_progress', 'resolved', 'closed'))
      );
    `);

    // 3. Visit Reservations 테이블
    await this.db.exec(`
      CREATE TABLE visit_reservations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        visitor_name TEXT NOT NULL,
        visitor_phone TEXT NOT NULL,
        purpose TEXT NOT NULL,
        visit_date DATE NOT NULL,
        visit_time TIME NOT NULL,
        duration_minutes INTEGER DEFAULT 60,
        status TEXT DEFAULT 'pending',
        approved_by TEXT NULL,
        approved_at DATETIME NULL,
        qr_code_hash TEXT UNIQUE,
        notes TEXT,
        checked_in_at DATETIME NULL,
        checked_out_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
        CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled'))
      );
    `);

    // 4. Notifications 테이블
    await this.db.exec(`
      CREATE TABLE notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT 0,
        data TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CHECK (type IN ('complaint', 'visit', 'general', 'system'))
      );
    `);

    // 5. 보안 관련 테이블들
    await this.db.exec(`
      CREATE TABLE password_reset_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        used BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    await this.db.exec(`
      CREATE TABLE email_verification_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        verified BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    await this.db.exec(`
      CREATE TABLE token_blacklist (
        id TEXT PRIMARY KEY,
        token_hash TEXT UNIQUE NOT NULL,
        user_id TEXT NOT NULL,
        reason TEXT,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // 6. 민원 관련 추가 테이블들
    await this.db.exec(`
      CREATE TABLE complaint_comments (
        id TEXT PRIMARY KEY,
        complaint_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        content TEXT NOT NULL,
        is_internal BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    await this.db.exec(`
      CREATE TABLE complaint_attachments (
        id TEXT PRIMARY KEY,
        complaint_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
      );
    `);

    await this.db.exec(`
      CREATE TABLE complaint_history (
        id TEXT PRIMARY KEY,
        complaint_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        old_status TEXT,
        new_status TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // 인덱스 생성 (성능 최적화)
    await this.createIndexes();
    
    console.log('📋 All tables created successfully in memory database');
  }

  /**
   * 성능 최적화를 위한 인덱스 생성
   */
  async createIndexes() {
    const indexes = [
      'CREATE INDEX idx_users_email ON users(email)',
      'CREATE INDEX idx_users_role ON users(role)',
      'CREATE INDEX idx_users_active ON users(is_active)',
      'CREATE INDEX idx_complaints_user_id ON complaints(user_id)',
      'CREATE INDEX idx_complaints_status ON complaints(status)',
      'CREATE INDEX idx_complaints_category ON complaints(category)',
      'CREATE INDEX idx_complaints_created_at ON complaints(created_at)',
      'CREATE INDEX idx_complaints_deleted ON complaints(is_deleted)',
      'CREATE INDEX idx_visit_reservations_user_id ON visit_reservations(user_id)',
      'CREATE INDEX idx_visit_reservations_status ON visit_reservations(status)',
      'CREATE INDEX idx_visit_reservations_date ON visit_reservations(visit_date)',
      'CREATE INDEX idx_notifications_user_id ON notifications(user_id)',
      'CREATE INDEX idx_notifications_read ON notifications(is_read)',
      'CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token)',
      'CREATE INDEX idx_email_verification_tokens_token ON email_verification_tokens(token)',
      'CREATE INDEX idx_token_blacklist_hash ON token_blacklist(token_hash)',
      'CREATE INDEX idx_complaint_comments_complaint_id ON complaint_comments(complaint_id)',
      'CREATE INDEX idx_complaint_attachments_complaint_id ON complaint_attachments(complaint_id)',
      'CREATE INDEX idx_complaint_history_complaint_id ON complaint_history(complaint_id)'
    ];

    for (const indexSql of indexes) {
      await this.db.exec(indexSql);
    }

    console.log(`📈 Created ${indexes.length} indexes for performance optimization`);
  }

  /**
   * UUID 생성 (SQLite용)
   */
  generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * 테스트용 데이터 생성 헬퍼 메서드들
   */
  async createTestUser(userData = {}) {
    const defaultUser = {
      id: this.generateId(),
      email: `test${Date.now()}@example.com`,
      password_hash: await bcrypt.hash('password123!', 10),
      name: '테스트 사용자',
      phone: '010-1234-5678',
      role: 'parent',
      is_active: 1,
      email_verified: 1,
      ...userData
    };

    await this.db.run(`
      INSERT INTO users (
        id, email, password_hash, name, phone, role, 
        is_active, email_verified, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      defaultUser.id, defaultUser.email, defaultUser.password_hash,
      defaultUser.name, defaultUser.phone, defaultUser.role,
      defaultUser.is_active, defaultUser.email_verified
    ]);

    return defaultUser;
  }

  async createTestComplaint(userId, complaintData = {}) {
    const defaultComplaint = {
      id: this.generateId(),
      user_id: userId,
      title: '테스트 민원',
      description: '테스트용 민원 내용입니다.',
      category: 'facility',
      priority: 'medium',
      status: 'submitted',
      anonymous: 0,
      ...complaintData
    };

    await this.db.run(`
      INSERT INTO complaints (
        id, user_id, title, description, category, priority, status, anonymous,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      defaultComplaint.id, defaultComplaint.user_id, defaultComplaint.title,
      defaultComplaint.description, defaultComplaint.category, defaultComplaint.priority,
      defaultComplaint.status, defaultComplaint.anonymous
    ]);

    return defaultComplaint;
  }

  /**
   * 테이블 데이터 초기화
   */
  async cleanup() {
    if (!this.isConnected || !this.db) return;

    const tables = [
      'complaint_history', 'complaint_attachments', 'complaint_comments',
      'token_blacklist', 'email_verification_tokens', 'password_reset_tokens',
      'notifications', 'visit_reservations', 'complaints', 'users'
    ];

    for (const table of tables) {
      await this.db.run(`DELETE FROM ${table}`);
    }

    console.log('🧹 Memory database cleaned up');
  }

  /**
   * 연결 종료
   */
  async close() {
    if (this.db) {
      await this.db.close();
      this.isConnected = false;
      console.log('📄 Memory database connection closed');
    }
  }

  /**
   * 데이터베이스 인스턴스 반환
   */
  getDb() {
    return this.db;
  }

  /**
   * SQL 쿼리 실행 (PostgreSQL 쿼리를 SQLite로 변환)
   */
  async query(sql, params = []) {
    // PostgreSQL 특수 구문을 SQLite로 변환
    let convertedSql = sql
      .replace(/\$(\d+)/g, '?')  // $1, $2 → ?
      .replace(/NOW\(\)/gi, 'CURRENT_TIMESTAMP')  // NOW() → CURRENT_TIMESTAMP
      .replace(/RETURNING \*/gi, '')  // RETURNING * 제거
      .replace(/::uuid/gi, '')  // ::uuid 캐스팅 제거
      .replace(/gen_random_uuid\(\)/gi, `'${this.generateId()}'`)  // UUID 생성
      .replace(/ILIKE/gi, 'LIKE')  // ILIKE → LIKE
      .replace(/LIMIT \$(\d+) OFFSET \$(\d+)/gi, 'LIMIT ? OFFSET ?');  // LIMIT/OFFSET 순서

    try {
      if (convertedSql.trim().toUpperCase().startsWith('SELECT')) {
        return await this.db.all(convertedSql, params);
      } else if (convertedSql.trim().toUpperCase().startsWith('INSERT')) {
        const result = await this.db.run(convertedSql, params);
        return { insertId: result.lastID, changes: result.changes };
      } else {
        const result = await this.db.run(convertedSql, params);
        return { changes: result.changes };
      }
    } catch (error) {
      console.error('❌ Memory DB Query Error:', error.message);
      console.error('📝 SQL:', convertedSql);
      console.error('📝 Params:', params);
      throw error;
    }
  }
}

// 싱글톤 인스턴스
let memoryDbInstance = null;

/**
 * 메모리 DB 싱글톤 인스턴스 반환
 */
function getMemoryDb() {
  if (!memoryDbInstance) {
    memoryDbInstance = new MemoryDatabase();
  }
  return memoryDbInstance;
}

module.exports = {
  MemoryDatabase,
  getMemoryDb
};
