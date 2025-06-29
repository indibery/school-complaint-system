/**
 * 📝 로깅 유틸리티
 * 
 * @description Winston 기반 로깅 시스템
 */

const path = require('path');
const fs = require('fs');

// 로그 디렉토리가 없으면 생성
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

/**
 * 간단한 콘솔 로거 (Winston 없이)
 */
class SimpleLogger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.logFile = process.env.LOG_FILE || path.join(logDir, 'app.log');
    
    // 로그 레벨 정의
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    
    this.currentLevel = this.levels[this.logLevel] || 2;
  }

  /**
   * 로그 메시지 포맷팅
   */
  formatMessage(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const formattedMessage = typeof message === 'string' 
      ? message 
      : JSON.stringify(message, null, 2);
    
    const logEntry = `${timestamp} [${level.toUpperCase()}] ${formattedMessage}`;
    
    // 추가 인수가 있으면 함께 출력
    if (args.length > 0) {
      const additionalInfo = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      return `${logEntry} ${additionalInfo}`;
    }
    
    return logEntry;
  }

  /**
   * 파일에 로그 쓰기
   */
  writeToFile(logEntry) {
    try {
      fs.appendFileSync(this.logFile, logEntry + '\n');
    } catch (error) {
      console.error('로그 파일 쓰기 실패:', error);
    }
  }

  /**
   * 로그 레벨 체크
   */
  shouldLog(level) {
    return this.levels[level] <= this.currentLevel;
  }

  /**
   * 에러 로그
   */
  error(message, ...args) {
    if (this.shouldLog('error')) {
      const logEntry = this.formatMessage('error', message, ...args);
      console.error(`\x1b[31m${logEntry}\x1b[0m`); // 빨간색
      this.writeToFile(logEntry);
    }
  }

  /**
   * 경고 로그
   */
  warn(message, ...args) {
    if (this.shouldLog('warn')) {
      const logEntry = this.formatMessage('warn', message, ...args);
      console.warn(`\x1b[33m${logEntry}\x1b[0m`); // 노란색
      this.writeToFile(logEntry);
    }
  }

  /**
   * 정보 로그
   */
  info(message, ...args) {
    if (this.shouldLog('info')) {
      const logEntry = this.formatMessage('info', message, ...args);
      console.log(`\x1b[36m${logEntry}\x1b[0m`); // 청록색
      this.writeToFile(logEntry);
    }
  }

  /**
   * 디버그 로그
   */
  debug(message, ...args) {
    if (this.shouldLog('debug')) {
      const logEntry = this.formatMessage('debug', message, ...args);
      console.log(`\x1b[37m${logEntry}\x1b[0m`); // 회색
      this.writeToFile(logEntry);
    }
  }

  /**
   * HTTP 요청 로그
   */
  http(req, res, responseTime) {
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      responseTime: `${responseTime}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id || null
    };

    const message = `${req.method} ${req.originalUrl} - ${res.statusCode} - ${responseTime}ms`;
    
    if (res.statusCode >= 400) {
      this.warn(message, logData);
    } else {
      this.info(message, logData);
    }
  }

  /**
   * 데이터베이스 쿼리 로그
   */
  query(sql, params, duration) {
    if (process.env.NODE_ENV === 'development') {
      this.debug('Database Query:', {
        sql: sql.replace(/\s+/g, ' ').trim(),
        params,
        duration: `${duration}ms`
      });
    }
  }

  /**
   * 로그 파일 정리 (일정 크기 초과 시)
   */
  rotateLogFile() {
    try {
      const stats = fs.statSync(this.logFile);
      const maxSize = 10 * 1024 * 1024; // 10MB
      
      if (stats.size > maxSize) {
        const backupFile = this.logFile + '.backup';
        fs.renameSync(this.logFile, backupFile);
        this.info('로그 파일이 순환되었습니다.');
      }
    } catch (error) {
      // 파일이 없거나 다른 오류는 무시
    }
  }
}

// 싱글톤 인스턴스 생성
const logger = new SimpleLogger();

// 주기적으로 로그 파일 순환 확인 (1시간마다)
setInterval(() => {
  logger.rotateLogFile();
}, 60 * 60 * 1000);

module.exports = logger;