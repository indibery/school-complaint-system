// 테스트 환경 변수 로드
require('dotenv').config({ path: '.env.test' });

// 필수 환경 변수 확인
const requiredEnvVars = [
  'NODE_ENV',
  'DB_HOST',
  'DB_PORT', 
  'DB_NAME',
  'DB_USER',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Required environment variable ${envVar} is not set`);
  }
}

console.log('✅ Test environment variables loaded successfully');
