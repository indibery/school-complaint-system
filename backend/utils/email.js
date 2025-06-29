/**
 * 📧 이메일 유틸리티 (개선된 버전)
 * 
 * @description Nodemailer를 사용한 이메일 발송 시스템
 */

const nodemailer = require('nodemailer');
const authEmailTemplates = require('../templates/authEmailTemplates');
const logger = require('./logger');

/**
 * 이메일 전송기 설정
 */
let transporter = null;

function createTransporter() {
  if (transporter) return transporter;

  const emailConfig = {
    service: process.env.EMAIL_SERVICE || 'gmail',
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    },
    pool: true, // 연결 풀 사용
    maxConnections: 5, // 최대 연결 수
    maxMessages: 100, // 연결당 최대 메시지 수
    rateDelta: 1000, // Rate limiting
    rateLimit: 5 // 초당 최대 5개 이메일
  };

  transporter = nodemailer.createTransporter(emailConfig);

  // 연결 테스트
  transporter.verify((error, success) => {
    if (error) {
      logger.error('이메일 서버 연결 실패:', {
        error: error.message,
        host: emailConfig.host,
        port: emailConfig.port,
        service: emailConfig.service
      });
    } else {
      logger.info('이메일 서버 연결 성공:', {
        host: emailConfig.host,
        port: emailConfig.port,
        service: emailConfig.service,
        user: emailConfig.auth.user
      });
    }
  });

  return transporter;
}

/**
 * 이메일 발송 (개선된 버전)
 * @param {Object} options - 이메일 옵션
 * @param {string} options.to - 수신자 이메일
 * @param {string} options.subject - 제목 (선택사항, 템플릿에서 가져올 수 있음)
 * @param {string} options.template - 템플릿 이름
 * @param {Object} options.data - 템플릿 데이터
 * @param {string} options.html - 직접 HTML (템플릿 미사용시)
 * @param {string} options.text - 직접 텍스트 (템플릿 미사용시)
 * @param {Array} options.attachments - 첨부파일 배열
 * @returns {Promise<Object>} 발송 결과
 */
const sendEmail = async (options) => {
  try {
    // 이메일 전송 설정 확인
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      logger.warn('이메일 설정이 완료되지 않음 - 개발 모드에서 스킵');
      return { success: true, messageId: 'dev-mode-skip', message: '개발 모드에서 스킵됨' };
    }

    const emailTransporter = createTransporter();
    
    let emailContent = {
      html: options.html || '',
      text: options.text || '',
      subject: options.subject || ''
    };

    // 템플릿 사용
    if (options.template && authEmailTemplates[options.template]) {
      const templateFunction = authEmailTemplates[options.template];
      const templateResult = templateFunction(options.data || {});
      
      emailContent = {
        html: templateResult.html,
        text: templateResult.text,
        subject: options.subject || templateResult.subject
      };
    }

    // 기본 발신자 정보
    const fromName = process.env.EMAIL_FROM_NAME || '학교 민원시스템';
    const fromAddress = process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER;

    const mailOptions = {
      from: `"${fromName}" <${fromAddress}>`,
      to: options.to,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
      attachments: options.attachments || [],
      
      // 메일 헤더 추가
      headers: {
        'X-Mailer': 'School Complaint System v1.0',
        'X-Priority': options.priority || '3', // 1: High, 3: Normal, 5: Low
        'Reply-To': process.env.EMAIL_REPLY_TO || fromAddress
      },

      // 배달 옵션
      envelope: {
        from: fromAddress,
        to: options.to
      }
    };

    // 이메일 발송
    logger.info('이메일 발송 시작:', {
      to: options.to,
      subject: emailContent.subject,
      template: options.template || 'custom',
      hasAttachments: !!(options.attachments && options.attachments.length > 0)
    });

    const result = await emailTransporter.sendMail(mailOptions);

    logger.info('이메일 발송 성공:', {
      messageId: result.messageId,
      to: options.to,
      subject: emailContent.subject,
      response: result.response
    });

    return {
      success: true,
      messageId: result.messageId,
      response: result.response,
      to: options.to,
      subject: emailContent.subject
    };

  } catch (error) {
    logger.error('이메일 발송 실패:', {
      to: options.to,
      subject: options.subject,
      template: options.template,
      error: error.message,
      code: error.code,
      command: error.command
    });

    // 에러 타입별 상세 로깅
    if (error.code === 'EAUTH') {
      logger.error('이메일 인증 실패 - 설정을 확인하세요');
    } else if (error.code === 'ECONNECTION') {
      logger.error('이메일 서버 연결 실패');
    } else if (error.code === 'EMESSAGE') {
      logger.error('이메일 메시지 오류');
    }

    throw error;
  }
};

/**
 * 대량 이메일 발송
 * @param {Array} recipients - 수신자 배열 [{ email, data }]
 * @param {string} template - 템플릿 이름
 * @param {Object} commonData - 공통 데이터
 * @param {Object} options - 추가 옵션
 * @returns {Promise<Object>} 발송 결과 통계
 */
const sendBulkEmail = async (recipients, template, commonData = {}, options = {}) => {
  const results = {
    total: recipients.length,
    success: 0,
    failed: 0,
    errors: []
  };

  const batchSize = options.batchSize || 10;
  const delay = options.delayMs || 1000;

  logger.info('대량 이메일 발송 시작:', {
    total: recipients.length,
    template,
    batchSize
  });

  // 배치 단위로 처리
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (recipient) => {
      try {
        const emailData = { ...commonData, ...recipient.data };
        
        await sendEmail({
          to: recipient.email,
          template,
          data: emailData,
          ...options
        });

        results.success++;
        
        logger.debug('대량 이메일 개별 발송 성공:', {
          email: recipient.email,
          template
        });

      } catch (error) {
        results.failed++;
        results.errors.push({
          email: recipient.email,
          error: error.message
        });

        logger.error('대량 이메일 개별 발송 실패:', {
          email: recipient.email,
          error: error.message
        });
      }
    });

    // 배치 완료 대기
    await Promise.allSettled(batchPromises);

    // 다음 배치 전 대기 (Rate limiting)
    if (i + batchSize < recipients.length) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  logger.info('대량 이메일 발송 완료:', results);

  return results;
};

/**
 * 이메일 템플릿 미리보기 생성
 * @param {string} template - 템플릿 이름
 * @param {Object} data - 템플릿 데이터
 * @returns {Object} 미리보기 HTML 및 텍스트
 */
const previewTemplate = (template, data) => {
  if (!authEmailTemplates[template]) {
    throw new Error(`템플릿 '${template}'을 찾을 수 없습니다.`);
  }

  const templateFunction = authEmailTemplates[template];
  const result = templateFunction(data);

  return {
    subject: result.subject,
    html: result.html,
    text: result.text
  };
};

/**
 * 이메일 서버 연결 상태 확인
 * @returns {Promise<boolean>} 연결 ��태
 */
const checkEmailConnection = async () => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      return false;
    }

    const emailTransporter = createTransporter();
    await emailTransporter.verify();
    
    logger.info('이메일 서버 연결 확인 성공');
    return true;
  } catch (error) {
    logger.error('이메일 서버 연결 확인 실패:', error.message);
    return false;
  }
};

/**
 * 이메일 큐 상태 확인 (간단한 구현)
 */
const getEmailQueueStatus = () => {
  // 실제 환경에서는 Redis나 다른 큐 시스템 사용 권장
  return {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    transporter: !!transporter
  };
};

/**
 * 이메일 발송 통계
 */
let emailStats = {
  totalSent: 0,
  totalFailed: 0,
  lastSent: null,
  startTime: Date.now()
};

const getEmailStats = () => {
  return {
    ...emailStats,
    uptime: Date.now() - emailStats.startTime,
    successRate: emailStats.totalSent > 0 
      ? ((emailStats.totalSent / (emailStats.totalSent + emailStats.totalFailed)) * 100).toFixed(2)
      : 0
  };
};

// 통계 업데이트 함수
const updateEmailStats = (success) => {
  if (success) {
    emailStats.totalSent++;
    emailStats.lastSent = new Date();
  } else {
    emailStats.totalFailed++;
  }
};

module.exports = {
  sendEmail,
  sendBulkEmail,
  previewTemplate,
  checkEmailConnection,
  getEmailQueueStatus,
  getEmailStats,
  createTransporter
};
