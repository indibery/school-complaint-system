/**
 * 📧 이메일 템플릿 시스템
 * 
 * @description 인증 관련 이메일 템플릿 생성 및 관리
 */

/**
 * 환영 이메일 템플릿
 */
const welcomeTemplate = (data) => {
  const { name, email, role, verificationLink, loginLink } = data;
  
  const roleNames = {
    parent: '학부모',
    teacher: '교사',
    admin: '관리자',
    security: '교문지킴이'
  };

  return {
    subject: '🏫 학교 민원시스템 가입을 환영합니다!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>환영합니다!</title>
        <style>
          body { font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px 5px; }
          .button:hover { background: #0056b3; }
          .info-box { background: white; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .footer { text-align: center; margin-top: 30px; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏫 학교 민원시스템</h1>
            <p>가입을 환영합니다!</p>
          </div>
          
          <div class="content">
            <h2>안녕하세요, ${name}님!</h2>
            
            <p><strong>학교 민원시스템</strong>에 <strong>${roleNames[role]}</strong>로 가입해주셔서 감사합니다.</p>
            
            <div class="info-box">
              <h3>📋 가입 정보</h3>
              <ul>
                <li><strong>이메일:</strong> ${email}</li>
                <li><strong>역할:</strong> ${roleNames[role]}</li>
                <li><strong>가입일:</strong> ${new Date().toLocaleDateString('ko-KR')}</li>
              </ul>
            </div>
            
            <p><strong>✅ 다음 단계:</strong></p>
            <ol>
              <li><strong>이메일 인증</strong>을 완료해주세요</li>
              <li>시스템에 로그인하여 기능을 확인해보세요</li>
              <li>프로필 정보를 업데이트해주세요</li>
            </ol>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationLink}" class="button">📧 이메일 인증하기</a>
              <a href="${loginLink}" class="button" style="background: #28a745;">🚪 로그인하기</a>
            </div>
            
            <div class="info-box">
              <h3>🎯 주요 기능</h3>
              <ul>
                <li><strong>민원 관리:</strong> 시설, 급식, 안전 등 다양한 민원 신청</li>
                <li><strong>방문 예약:</strong> QR코드 기반 학교 방문 예약</li>
                <li><strong>실시간 알림:</strong> 민원 처리 상황 및 중요 공지사항</li>
                ${role === 'teacher' ? '<li><strong>민원 처리:</strong> 학부모 민원 확인 및 답변</li>' : ''}
                ${role === 'admin' ? '<li><strong>시스템 관리:</strong> 전체 민원 및 사용자 관리</li>' : ''}
                ${role === 'security' ? '<li><strong>교문 관리:</strong> 방문자 체크인/아웃 관리</li>' : ''}
              </ul>
            </div>
            
            <p>문의사항이 있으시면 언제든지 연락해주세요!</p>
          </div>
          
          <div class="footer">
            <p>© 2025 학교 민원시스템. All rights reserved.</p>
            <p>이 이메일은 자동으로 발송되었습니다. 회신하지 마세요.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      🏫 학교 민원시스템 가입을 환영합니다!
      
      안녕하세요, ${name}님!
      
      학교 민원시스템에 ${roleNames[role]}로 가입해주셔서 감사합니다.
      
      가입 정보:
      - 이메일: ${email}
      - 역할: ${roleNames[role]}
      - 가입일: ${new Date().toLocaleDateString('ko-KR')}
      
      다음 단계:
      1. 이메일 인증을 완료해주세요: ${verificationLink}
      2. 시스템에 로그인해보세요: ${loginLink}
      
      문의사항이 있으시면 언제든지 연락해주세요!
      
      © 2025 학교 민원시스템
    `
  };
};

/**
 * 이메일 인증 완료 템플릿
 */
const emailVerifiedTemplate = (data) => {
  const { name, loginLink } = data;
  
  return {
    subject: '✅ 이메일 인증이 완료되었습니다',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>인증 완료</title>
        <style>
          body { font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px 0; }
          .success-icon { font-size: 48px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="success-icon">✅</div>
            <h1>인증 완료!</h1>
          </div>
          
          <div class="content">
            <h2>축하합니다, ${name}님!</h2>
            
            <p>이메일 인증이 <strong>성공적으로 완료</strong>되었습니다.</p>
            <p>이제 학교 민원시스템의 모든 기능을 이용하실 수 있습니다.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginLink}" class="button">🚪 로그인하기</a>
            </div>
            
            <p>학교 민원시스템을 이용해주셔서 감사합니다!</p>
          </div>
          
          <div class="footer">
            <p>© 2025 학교 민원시스템. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      ✅ 이메일 인증이 완료되었습니다
      
      축하합니다, ${name}님!
      
      이메일 인증이 성공적으로 완료되었습니다.
      이제 학교 민원시스템의 모든 기능을 이용하실 수 있습니다.
      
      로그인하기: ${loginLink}
      
      학교 민원시스템을 이용해주셔서 감사합니다!
      
      © 2025 학교 민원시스템
    `
  };
};

/**
 * 인증 이메일 재발송 템플릿
 */
const resendVerificationTemplate = (data) => {
  const { name, verificationLink } = data;
  
  return {
    subject: '📧 이메일 인증 재발송',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>이메일 인증 재발송</title>
        <style>
          body { font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px 0; }
          .warning-box { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📧 이메일 인증</h1>
            <p>인증 링크 재발송</p>
          </div>
          
          <div class="content">
            <h2>안녕하세요, ${name}님!</h2>
            
            <p>요청하신 <strong>이메일 인증 링크</strong>를 재발송해드립니다.</p>
            
            <div class="warning-box">
              <strong>⚠️ 주의사항:</strong>
              <ul>
                <li>이 링크는 <strong>24시간</strong> 동안만 유효합니다</li>
                <li>보안을 위해 링크를 다른 사람과 공유하지 마세요</li>
                <li>이미 인증을 완료하셨다면 이 이메일을 무시하세요</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationLink}" class="button">📧 이메일 인증하기</a>
            </div>
            
            <p>인증에 문제가 있으시면 고객지원팀에 문의해주세요.</p>
          </div>
          
          <div class="footer">
            <p>© 2025 학교 민원시스템. All rights reserved.</p>
            <p>이 이메일은 자동으로 발송되었습니다. 회신하지 마세요.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      📧 이메일 인증 재발송
      
      안녕하세요, ${name}님!
      
      요청하신 이메일 인증 링크를 재발송해드립니다.
      
      인증 링크: ${verificationLink}
      
      주의사항:
      - 이 링크는 24시간 동안만 유효합니다
      - 보안을 위해 링크를 다른 사람과 공유하지 마세요
      - 이미 인증을 완료하셨다면 이 이메일을 무시하세요
      
      인증에 문제가 있으시면 고객지원팀에 문의해주세요.
      
      © 2025 학교 민원시스템
    `
  };
};

/**
 * 계정 상태 변경 템플릿
 */
const accountStatusChangeTemplate = (data) => {
  const { name, statusText, reason, contactEmail } = data;
  
  return {
    subject: `🔔 계정이 ${statusText}되었습니다`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>계정 상태 변경</title>
        <style>
          body { font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${statusText === '활성화' ? '#28a745' : '#dc3545'}; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .info-box { background: white; border-left: 4px solid ${statusText === '활성화' ? '#28a745' : '#dc3545'}; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .footer { text-align: center; margin-top: 30px; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔔 계정 상태 변경</h1>
            <p>계정이 ${statusText}되었습니다</p>
          </div>
          
          <div class="content">
            <h2>안녕하세요, ${name}님!</h2>
            
            <p>귀하의 계정이 <strong>${statusText}</strong>되었습니다.</p>
            
            <div class="info-box">
              <h3>📋 변경 정보</h3>
              <ul>
                <li><strong>상태:</strong> ${statusText}</li>
                <li><strong>변경일:</strong> ${new Date().toLocaleString('ko-KR')}</li>
                ${reason ? `<li><strong>사유:</strong> ${reason}</li>` : ''}
              </ul>
            </div>
            
            ${statusText === '비활성화' ? `
              <p><strong>⚠️ 주의사항:</strong></p>
              <ul>
                <li>계정이 비활성화되어 시스템에 로그인할 수 없습니다</li>
                <li>기존 세션은 모두 무효화되었습니다</li>
                <li>계정 복구가 필요하시면 관리자에게 문의해주세요</li>
              </ul>
            ` : `
              <p><strong>✅ 안내사항:</strong></p>
              <ul>
                <li>계정이 활성화되어 시스템을 정상적으로 이용하실 수 있습니다</li>
                <li>모든 기능이 복구되었습니다</li>
                <li>보안을 위해 비밀번호를 변경하시기 바랍니다</li>
              </ul>
            `}
            
            <p>문의사항이 있으시면 <strong>${contactEmail || 'admin@school-system.com'}</strong>로 연락해주세요.</p>
          </div>
          
          <div class="footer">
            <p>© 2025 학교 민원시스템. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      🔔 계정 상태 변경 알림
      
      안녕하세요, ${name}님!
      
      귀하의 계정이 ${statusText}되었습니다.
      
      변경 정보:
      - 상태: ${statusText}
      - 변경일: ${new Date().toLocaleString('ko-KR')}
      ${reason ? `- 사유: ${reason}` : ''}
      
      문의사항이 있으시면 ${contactEmail || 'admin@school-system.com'}로 연락해주세요.
      
      © 2025 학교 민원시스템
    `
  };
};

module.exports = {
  welcome: welcomeTemplate,
  email_verified: emailVerifiedTemplate,
  resend_verification: resendVerificationTemplate,
  account_status_change: accountStatusChangeTemplate
};
