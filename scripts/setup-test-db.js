#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

// 테스트 데이터베이스 설정
const setupTestDatabase = async () => {
  console.log('🔧 Setting up test database...');

  // 관리자 연결 (postgres 데이터베이스)
  const adminPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: 'postgres', // 관리자 DB
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
  });

  try {
    // 테스트 데이터베이스 존재 확인
    const dbCheckResult = await adminPool.query(
      "SELECT 1 FROM pg_database WHERE datname = 'school_complaint_test'"
    );

    if (dbCheckResult.rows.length === 0) {
      // 테스트 데이터베이스 생성
      await adminPool.query('CREATE DATABASE school_complaint_test');
      console.log('✅ Test database created: school_complaint_test');
    } else {
      console.log('✅ Test database already exists: school_complaint_test');
    }

    await adminPool.end();

    // 테스트 데이터베이스 연결
    const testPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: 'school_complaint_test',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
    });

    // 테스트 테이블 생성
    console.log('📋 Creating test tables...');

    // Users 테이블
    await testPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        role VARCHAR(20) NOT NULL DEFAULT 'parent',
        is_active BOOLEAN DEFAULT true,
        is_email_verified BOOLEAN DEFAULT false,
        email_verification_token VARCHAR(255),
        email_verification_expires TIMESTAMP,
        password_reset_token VARCHAR(255),
        password_reset_expires TIMESTAMP,
        last_login TIMESTAMP,
        failed_login_attempts INTEGER DEFAULT 0,
        account_locked_until TIMESTAMP,
        token_version INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Token blacklist 테이블
    await testPool.query(`
      CREATE TABLE IF NOT EXISTS token_blacklist (
        id SERIAL PRIMARY KEY,
        token_jti VARCHAR(255) UNIQUE NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        token_type VARCHAR(20) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 인덱스 생성
    await testPool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_token_version ON users(token_version);
      CREATE INDEX IF NOT EXISTS idx_token_blacklist_jti ON token_blacklist(token_jti);
      CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at);
      CREATE INDEX IF NOT EXISTS idx_token_blacklist_user_id ON token_blacklist(user_id);
    `);

    // 자동 정리 함수 생성
    await testPool.query(`
      CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
      RETURNS void AS $$
      BEGIN
        DELETE FROM token_blacklist WHERE expires_at < NOW();
      END;
      $$ LANGUAGE plpgsql;
    `);

    console.log('✅ Test tables and indexes created successfully');
    
    await testPool.end();
    console.log('🎉 Test database setup completed!');

  } catch (error) {
    console.error('❌ Error setting up test database:', error);
    process.exit(1);
  }
};

// 스크립트 실행
if (require.main === module) {
  setupTestDatabase();
}

module.exports = { setupTestDatabase };