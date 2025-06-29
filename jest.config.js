module.exports = {
  // 테스트 환경 설정
  testEnvironment: 'node',
  
  // 테스트 파일 패턴
  testMatch: [
    '**/backend/tests/**/*.test.js',
    '**/backend/tests/**/*.spec.js'
  ],
  
  // 테스트 전후 설정
  setupFilesAfterEnv: ['<rootDir>/backend/tests/helpers/setup.js'],
  
  // 환경 변수 파일 로드
  setupFiles: ['<rootDir>/backend/tests/helpers/env.js'],
  
  // 커버리지 설정
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  collectCoverageFrom: [
    'backend/**/*.js',
    '!backend/tests/**',
    '!backend/node_modules/**',
    '!**/node_modules/**',
    '!coverage/**'
  ],
  
  // 커버리지 임계값
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // 테스트 시간 제한
  testTimeout: 30000,
  
  // 테스트 실행 모드
  verbose: true,
  
  // 병렬 실행 설정
  maxWorkers: 4,
  
  // 전역 변수 설정
  globals: {
    'process.env.NODE_ENV': 'test'
  },
  
  // 모듈 경로 설정
  moduleDirectories: ['node_modules', 'backend'],
  
  // 테스트 결과 리포터
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: './test-report',
      filename: 'test-report.html',
      expand: true
    }]
  ]
};
