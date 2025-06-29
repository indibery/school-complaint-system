/**
 * 📧 이메일 유틸리티
 * 
 * @description Nodemailer를 사용한 이메일 발송 시스템
 */

const nodemailer = require('nodemailer');
const logger = require('./logger');

/**
 * 이메일 전송기 설정
 */
let transporter = null;

function createTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransporter({
    service: process.env.EMAIL_SERVICE || 'gmail',
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_PORT === '465',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });

  // 연결 확인
  transporter.verify((error, success) => {
    if (error) {
      logger.error('이메일 설정 오류:', error);
    } else {
      logger.info('이메일 서버 연결 성공');
    }
  });

  return transporter;
}

/**
 * 이메일 템플릿 생성
 */
function createEmailTemplate(type, data) {
  const baseStyle = `
    <style>
      body { font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
      .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
      .content { padding: 30px; line-height: 1.6; color: #333; }
      .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
      .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
      .code { background: #f8f9fa; padding: 15px; border-radius: 5px; font-family: monospace; font-size: 18px; text-align: center; margin: 20px 0; border: 2px dashed #dee2e6; }
    </style>
  `;

  const templates = {
    // 회원가입 환영 이메일
    welcome: `
      ${baseStyle}
      <div class="container">
        <div class="header">
          <h1>🏫 학교 민원시스템</h1>
          <p>회원가입을 환영합니다!</p>
        </div>
        <div class="content">
          <h2>안녕하세요, ${data.name}님!</h2>
          <p>학교 민원시스템에 가입해 주셔서 감사합니다.</p>
          <p>이제 다음과 같은 서비스를 이용하실 수 있습니다:</p>
          <ul>
            <li>📝 민원 신청 및 처리 현황 확인</li>
            <li>📅 학교 방문 예약</li>
            <li>🔔 실시간 알림 서비스</li>
            <li>👥 교사 및 관리자와의 소통</li>
          </ul>
          <p>궁금한 사항이 있으시면 언제든지 문의해 주세요.</p>
        </div>
        <div class="footer">
          <p>© 2025 학교 민원시스템. All rights reserved.</p>
        </div>
      </div>
    `,

    // 민원 접수 확인 이메일
    complaint_received: `
      ${baseStyle}
      <div class="container">
        <div class="header">
          <h1>📝 민원 접수 완료</h1>
        </div>
        <div class="content">
          <h2>민원이 정상적으로 접수되었습니다</h2>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p><strong>민원 번호:</strong> ${data.complaintId}</p>
            <p><strong>제목:</strong> ${data.title}</p>
            <p><strong>카테고리:</strong> ${data.category}</p>
            <p><strong>접수일:</strong> ${data.createdAt}</p>
            <p><strong>상태:</strong> 접수 완료</p>
          </div>
          <p>담당자가 검토 후 빠른 시일 내에 답변드리겠습니다.</p>
          <p>민원 처리 현황은 앱에서 실시간으로 확인하실 수 있습니다.</p>
        </div>
        <div class="footer">
          <p>민원 처리에 관한 문의: admin@school-system.com</p>
        </div>
      </div>
    `,

    // 방문 예약 확인 이메일
    visit_confirmed: `
      ${baseStyle}
      <div class="container">
        <div class="header">
          <h1>📅 방문 예약 확정</h1>
        </div>
        <div class="content">
          <h2>방문 예약이 승인되었습니다</h2>
          <div style="background: #e8f5e8; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
            <p><strong>방문자:</strong> ${data.visitorName}</p>
            <p><strong>방문일:</strong> ${data.visitDate}</p>
            <p><strong>방문시간:</strong> ${data.visitTime}</p>
            <p><strong>방문목적:</strong> ${data.purpose}</p>
            <p><strong>QR코드:</strong></p>
            <div class="code">${data.qrCode}</div>
          </div>
          <p>⚠️ <strong>중요 안내사항:</strong></p>
          <ul>
            <li>방문 시 QR코드를 교문에서 제시해 주세요</li>
            <li>신분증을 지참해 주세요</li>
            <li>예약 시간 10분 전까지 도착해 주세요</li>
            <li>변경 사항이 있을 시 미리 연락 부탁드립니다</li>
          </ul>
        </div>
        <div class="footer">
          <p>방문 관련 문의: 031-123-4567</p>
        </div>
      </div>
    `,

    // 비밀번호 재설정 이메일
    password_reset: `
      ${baseStyle}
      <div class="container">
        <div class="header">
          <h1>🔐 비밀번호 재설정</h1>
        </div>
        <div class="content">
          <h2>비밀번호 재설정 요청</h2>
          <p>안녕하세요, ${data.name}님.</p>
          <p>비밀번호 재설정을 요청하셨습니다. 아래 버튼을 클릭하여 새 비밀번호를 설정해 주세요.</p>
          <div style="text-align: center;">
            <a href="${data.resetLink}" class="button">비밀번호 재설정하기</a>
          </div>
          <p>또는 아래 인증코드를 입력해 주세요:</p>
          <div class="code">${data.resetCode}</div>
          <p><strong>⚠️ 보안 안내:</strong></p>
          <ul>
            <li>이 링크는 1시간 후 만료됩니다</li>
            <li>요청하지 않으셨다면 이 이메일을 무시해 주세요</li>
            <li>비밀번호는 타인과 공유하지 마세요</li>
          </ul>
        </div>
        <div class="footer">
          <p>보안 관련 문의: security@school-system.com</p>
        </div>
      </div>
    `,

    // 알림 이메일
    notification: `
      ${baseStyle}
      <div class="container">
        <div class="header">
          <h1>${data.icon} ${data.title}</h1>
        </div>
        <div class="content">
          <p>${data.message}</p>
          ${data.details ? `<div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">${data.details}</div>` : ''}
          ${data.actionUrl ? `<div style="text-align: center;"><a href="${data.actionUrl}" class="button">확인하기</a></div>` : ''}
        </div>
        <div class="footer">
          <p>이 알림은 자동으로 발송되었습니다.</p>
        </div>
      </div>
    `
  };

  return templates[type] || templates.notification;
}

/**
 * 이메일 발송
 */
async function sendEmail(to, subject, type, data, attachments = []) {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      logger.warn('이메일 설정이 완료되지 않았습니다.');
      return false;
    }

    const emailTransporter = createTransporter();
    const html = createEmailTemplate(type, data);

    const mailOptions = {
      from: {
        name: process.env.EMAIL_FROM_NAME || '학교 민원시스템',
        address: process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER
      },
      to,
      subject,
      html,
      attachments
    };

    const result = await emailTransporter.sendMail(mailOptions);
    
    logger.info('이메일 발송 성공:', {
      to,
      subject,
      messageId: result.messageId
    });

    return true;
  } catch (error) {
    logger.error('이메일 발송 실패:', error);
    return false;
  }
}

/**
 * 대량 이메일 발송
 */
async function sendBulkEmail(recipients, subject, type, data) {
  const results = [];
  
  for (const recipient of recipients) {
    try {
      const success = await sendEmail(recipient.email, subject, type, {
        ...data,
        name: recipient.name
      });
      
      results.push({
        email: recipient.email,
        success,
        name: recipient.name
      });
      
      // 이메일 발송 간격 (스팸 방지)
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      logger.error(`이메일 발송 실패 (${recipient.email}):`, error);
      results.push({
        email: recipient.email,
        success: false,
        error: error.message
      });
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  logger.info(`대량 이메일 발송 완료: ${successCount}/${recipients.length}`);
  
  return results;
}

/**
 * 이메일 템플릿 미리보기
 */
function previewTemplate(type, data) {
  return createEmailTemplate(type, data);
}

/**
 * 이메일 서비스 상태 확인
 */
async function checkEmailService() {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      return { status: 'disabled', message: '이메일 설정이 완료되지 않았습니다.' };
    }

    const emailTransporter = createTransporter();
    await emailTransporter.verify();
    
    return { status: 'active', message: '이메일 서비스가 정상 작동 중입니다.' };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}

module.exports = {
  sendEmail,
  sendBulkEmail,
  previewTemplate,
  checkEmailService
};