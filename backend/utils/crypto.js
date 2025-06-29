/**
 * 🔐 암호화 유틸리티
 * 
 * @description bcrypt를 사용한 비밀번호 해싱 및 검증
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * 비밀번호 해싱
 */
async function hashPassword(password) {
  try {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
  } catch (error) {
    throw new Error('비밀번호 해싱 중 오류가 발생했습니다.');
  }
}

/**
 * 비밀번호 검증
 */
async function verifyPassword(password, hashedPassword) {
  try {
    const isValid = await bcrypt.compare(password, hashedPassword);
    return isValid;
  } catch (error) {
    throw new Error('비밀번호 검증 중 오류가 발생했습니다.');
  }
}

/**
 * 랜덤 문자열 생성
 */
function generateRandomString(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * 랜덤 숫자 생성
 */
function generateRandomNumber(min = 100000, max = 999999) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 안전한 랜덤 UUID 생성
 */
function generateSecureId() {
  return crypto.randomUUID();
}

/**
 * 해시 생성 (SHA-256)
 */
function createHash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * HMAC 생성
 */
function createHMAC(data, secret) {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * 데이터 암호화 (AES-256-GCM)
 */
function encrypt(text, secretKey) {
  try {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(secretKey, 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  } catch (error) {
    throw new Error('데이터 암호화 중 오류가 발생했습니다.');
  }
}

/**
 * 데이터 복호화 (AES-256-GCM)
 */
function decrypt(encryptedData, secretKey) {
  try {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(secretKey, 'salt', 32);
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');
    
    const decipher = crypto.createDecipher(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error('데이터 복호화 중 오류가 발생했습니다.');
  }
}

/**
 * 마스킹 처리 (개인정보 보호)
 */
function maskEmail(email) {
  const [username, domain] = email.split('@');
  const maskedUsername = username.length > 2 
    ? username.substring(0, 2) + '*'.repeat(username.length - 2)
    : username;
  return `${maskedUsername}@${domain}`;
}

/**
 * 전화번호 마스킹
 */
function maskPhone(phone) {
  if (phone.length < 8) return phone;
  return phone.substring(0, 3) + '****' + phone.substring(phone.length - 4);
}

/**
 * 이름 마스킹
 */
function maskName(name) {
  if (name.length <= 2) return name;
  return name.charAt(0) + '*'.repeat(name.length - 2) + name.charAt(name.length - 1);
}

/**
 * 비밀번호 강도 검사
 */
function checkPasswordStrength(password) {
  const checks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    numbers: /\d/.test(password),
    symbols: /[@$!%*?&]/.test(password)
  };
  
  const score = Object.values(checks).filter(Boolean).length;
  
  let strength = 'weak';
  if (score >= 4) strength = 'strong';
  else if (score >= 3) strength = 'medium';
  
  return {
    score,
    strength,
    checks,
    isValid: score >= 4
  };
}

/**
 * API 키 생성
 */
function generateApiKey(prefix = 'sk') {
  const randomPart = crypto.randomBytes(32).toString('base64')
    .replace(/[+/=]/g, '')
    .substring(0, 48);
  
  return `${prefix}_${randomPart}`;
}

/**
 * 토큰 생성 (이메일 인증 등)
 */
function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateRandomString,
  generateRandomNumber,
  generateSecureId,
  createHash,
  createHMAC,
  encrypt,
  decrypt,
  maskEmail,
  maskPhone,
  maskName,
  checkPasswordStrength,
  generateApiKey,
  generateVerificationToken
};