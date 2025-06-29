/**
 * 📧 인증 이메일 템플릿 시스템 (확장판)
 * 
 * @description 인증 관련 모든 이메일 템플릿 생성 및 관리
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
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationLink}" class="button">📧 이메일 인증하기</a>
              <a href="${loginLink}" class="button" style="background: #28a745;">🚪 로그인하기</a>
            </div>
            
            <p>문의사항이 있으시면 언제든지 연락해주세요!</p>
          </div>
          
          <div class="footer">
            <p>© 2025 학교 민원시스템. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `🏫 학교 민원시스템 가입을 환영합니다!\n\n안녕하세요, ${name}님!\n\n학교 민원시스템에 ${roleNames[role]}로 가입해주셔서 감사합니다.\n\n이메일 인증: ${verificationLink}\n로그인: ${loginLink}\n\n© 2025 학교 민원시스템`
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
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginLink}" class="button">🚪 로그인하기</a>
            </div>
          </div>
          
          <div class="footer">
            <p>© 2025 학교 민원시스템. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `✅ 이메일 인증이 완료되었습니다\n\n축하합니다, ${name}님!\n\n이메일 인증이 성공적으로 완료되었습니다.\n\n로그인하기: ${loginLink}\n\n© 2025 학교 민원시스템`
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
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationLink}" class="button">📧 이메일 인증하기</a>
            </div>
          </div>
          
          <div class="footer">
            <p>© 2025 학교 민원시스템. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `📧 이메일 인증 재발송\n\n안녕하세요, ${name}님!\n\n요청하신 이메일 인증 링크를 재발송해드립니다.\n\n인증 링크: ${verificationLink}\n\n주의사항:\n- 이 링크는 24시간 동안만 유효합니다\n- 보안을 위해 링크를 다른 사람과 공유하지 마세요\n\n© 2025 학교 민원시스템`
  };
};

/**
 * 비밀번호 재설정 템플릿
 */
const passwordResetTemplate = (data) => {
  const { name, email, resetLink, resetCode, expiresIn } = data;
  
  return {
    subject: '🔐 비밀번호 재설정 요청',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>비밀번호 재설정</title>
        <style>
          body { font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px 0; }
          .button:hover { background: #c82333; }
          .reset-code { background: #e9ecef; border: 2px dashed #6c757d; padding: 15px; text-align: center; font-size: 18px; font-weight: bold; margin: 20px 0; border-radius: 4px; }
          .warning-box { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 15px; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 비밀번호 재설정</h1>
            <p>비밀번호 재설정 요청</p>
          </div>
          
          <div class="content">
            <h2>안녕하세요, ${name}님!</h2>
            
            <p><strong>${email}</strong> 계정의 비밀번호 재설정 요청을 받았습니다.</p>
            
            <div class="reset-code">
              <div>재설정 코드</div>
              <div style="color: #dc3545; font-size: 24px; margin-top: 5px;">${resetCode}</div>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" class="button">🔒 비밀번호 재설정하기</a>
            </div>
            
            <div class="warning-box">
              <strong>⚠️ 보안 안내:</strong>
              <ul>
                <li>이 링크는 <strong>${expiresIn}</strong> 동안만 유효합니다</li>
                <li>비밀번호 재설정을 요청하지 않으셨다면 이 이메일을 무시하세요</li>
                <li>링크를 다른 사람과 공유하지 마세요</li>
                <li>의심스러운 활동이 있다면 즉시 관리자에게 문의하세요</li>
              </ul>
            </div>
            
            <p>문의사항이 있으시면 고객지원팀에 연락해주세요.</p>
          </div>
          
          <div class="footer">
            <p>© 2025 학교 민원시스템. All rights reserved.</p>
            <p>이 이메일은 자동으로 발송되었습니다. 회신하지 마세요.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `🔐 비밀번호 재설정 요청\n\n안녕하세요, ${name}님!\n\n${email} 계정의 비밀번호 재설정 요청을 받았습니다.\n\n재설정 코드: ${resetCode}\n재설정 링크: ${resetLink}\n\n보안 안내:\n- 이 링크는 ${expiresIn} 동안만 유효합니다\n- 비밀번호 재설정을 요청하지 않으셨다면 이 이메일을 무시하세요\n\n© 2025 학교 민원시스템`
  };
};

/**
 * 비밀번호 변경 완료 템플릿
 */
const passwordChangedTemplate = (data) => {
  const { name, changeTime, ip, loginLink } = data;
  
  return {
    subject: '🔒 비밀번호가 변경되었습니다',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>비밀번호 변경 완료</title>
        <style>
          body { font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px 0; }
          .info-box { background: white; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .warning-box { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔒 비밀번호 변경</h1>
            <p>비밀번호가 성공적으로 변경되었습니다</p>
          </div>
          
          <div class="content">
            <h2>안녕하세요, ${name}님!</h2>
            
            <p>귀하의 계정 비밀번호가 <strong>성공적으로 변경</strong>되었습니다.</p>
            
            <div class="info-box">
              <h3>🔍 변경 정보</h3>
              <ul>
                <li><strong>변경 시간:</strong> ${changeTime}</li>
                <li><strong>접속 IP:</strong> ${ip}</li>
                <li><strong>상태:</strong> 완료</li>
              </ul>
            </div>
            
            <div class="warning-box">
              <strong>⚠️ 보안 안내:</strong>
              <ul>
                <li>본인이 변경하지 않으셨다면 <strong>즉시 관리자에게 문의</strong>하세요</li>
                <li>보안을 위해 다른 사이트에서도 비밀번호를 변경하시기 바랍니다</li>
                <li>정기적으로 비밀번호를 변경하는 것을 권장합니다</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginLink}" class="button">🚪 로그인하기</a>
            </div>
          </div>
          
          <div class="footer">
            <p>© 2025 학교 민원시스템. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `🔒 비밀번호가 변경되었습니다\n\n안녕하세요, ${name}님!\n\n귀하의 계정 비밀번호가 성공적으로 변경되었습니다.\n\n변경 정보:\n- 변경 시간: ${changeTime}\n- 접속 IP: ${ip}\n\n보안 안내:\n- 본인이 변경하지 않으셨다면 즉시 관리자에게 문의하세요\n\n로그인하기: ${loginLink}\n\n© 2025 학교 민원시스템`
  };
};

/**
 * 계정 잠금 해제 템플릿
 */
const accountUnlockedTemplate = (data) => {
  const { name, unlockTime, reason, loginLink } = data;
  
  return {
    subject: '🔓 계정 잠금이 해제되었습니다',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>계정 잠금 해제</title>
        <style>
          body { font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #17a2b8 0%, #138496 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px 0; }
          .info-box { background: white; border-left: 4px solid #17a2b8; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .footer { text-align: center; margin-top: 30px; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔓 계정 잠금 해제</h1>
            <p>계정 잠금이 해제되었습니다</p>
          </div>
          
          <div class="content">
            <h2>안녕하세요, ${name}님!</h2>
            
            <p>귀하의 계정 잠금이 <strong>해제</strong>되었습니다.</p>
            
            <div class="info-box">
              <h3>📋 해제 정보</h3>
              <ul>
                <li><strong>해제 시간:</strong> ${unlockTime}</li>
                <li><strong>해제 사유:</strong> ${reason}</li>
                <li><strong>상태:</strong> 활성화됨</li>
              </ul>
            </div>
            
            <p>이제 정상적으로 시스템에 로그인하실 수 있습니다.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginLink}" class="button">🚪 로그인하기</a>
            </div>
          </div>
          
          <div class="footer">
            <p>© 2025 학교 민원시스템. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `🔓 계정 잠금이 해제되었습니다\n\n안녕하세요, ${name}님!\n\n귀하의 계정 잠금이 해제되었습니다.\n\n해제 정보:\n- 해제 시간: ${unlockTime}\n- 해제 사유: ${reason}\n\n이제 정상적으로 시스템에 로그인하실 수 있습니다.\n\n로그인하기: ${loginLink}\n\n© 2025 학교 민원시스템`
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
            
            <p>문의사항이 있으시면 <strong>${contactEmail || 'admin@school-system.com'}</strong>로 연락해주세요.</p>
          </div>
          
          <div class="footer">
            <p>© 2025 학교 민원시스템. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `🔔 계정 상태 변경 알림\n\n안녕하세요, ${name}님!\n\n귀하의 계정이 ${statusText}되었습니다.\n\n변경 정보:\n- 상태: ${statusText}\n- 변경일: ${new Date().toLocaleString('ko-KR')}\n${reason ? `- 사유: ${reason}` : ''}\n\n문의사항이 있으시면 ${contactEmail || 'admin@school-system.com'}로 연락해주세요.\n\n© 2025 학교 민원시스템`
  };
};

module.exports = {
  welcome: welcomeTemplate,
  email_verified: emailVerifiedTemplate,
  resend_verification: resendVerificationTemplate,
  password_reset: passwordResetTemplate,
  password_changed: passwordChangedTemplate,
  account_unlocked: accountUnlockedTemplate,
  account_status_change: accountStatusChangeTemplate
};
