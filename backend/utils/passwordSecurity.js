/**
 * 🔐 비밀번호 보안 유틸리티
 * 
 * @description 비밀번호 강도 검증 및 보안 기능
 */

/**
 * 비밀번호 강도 검증
 * @param {string} password - 검증할 비밀번호
 * @returns {Object} 검증 결과
 */
const validatePasswordStrength = (password) => {
  const result = {
    isValid: true,
    score: 0,
    errors: [],
    suggestions: []
  };

  // 길이 검증
  if (password.length < 8) {
    result.isValid = false;
    result.errors.push('비밀번호는 최소 8자 이상이어야 합니다.');
  } else if (password.length >= 8) {
    result.score += 1;
  }

  if (password.length >= 12) {
    result.score += 1;
  }

  // 복잡성 검증
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[@$!%*?&]/.test(password);

  if (!hasLowercase) {
    result.isValid = false;
    result.errors.push('소문자를 포함해야 합니다.');
  } else {
    result.score += 1;
  }

  if (!hasUppercase) {
    result.isValid = false;
    result.errors.push('대문자를 포함해야 합니다.');
  } else {
    result.score += 1;
  }

  if (!hasNumbers) {
    result.isValid = false;
    result.errors.push('숫자를 포함해야 합니다.');
  } else {
    result.score += 1;
  }

  if (!hasSpecialChars) {
    result.isValid = false;
    result.errors.push('특수문자(@$!%*?&)를 포함해야 합니다.');
  } else {
    result.score += 1;
  }

  // 추가 보안 검증
  // 연속된 문자 검증
  if (/(.)\1{2,}/.test(password)) {
    result.score -= 1;
    result.suggestions.push('동일한 문자를 3번 이상 연속으로 사용하지 마세요.');
  }

  // 순차적 문자 검증
  const sequences = ['123', '456', '789', 'abc', 'def', 'ghi', 'qwe', 'rty'];
  for (const seq of sequences) {
    if (password.toLowerCase().includes(seq)) {
      result.score -= 1;
      result.suggestions.push('순차적인 문자나 숫자를 피해주세요.');
      break;
    }
  }

  // 일반적인 패턴 검증
  const commonPatterns = [
    /password/i,
    /123456/,
    /qwerty/i,
    /admin/i,
    /login/i
  ];

  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      result.score -= 2;
      result.suggestions.push('일반적인 패턴이나 단어를 피해주세요.');
      break;
    }
  }

  // 강도 레벨 결정
  if (result.score >= 5) {
    result.strength = 'strong';
  } else if (result.score >= 3) {
    result.strength = 'medium';
  } else {
    result.strength = 'weak';
  }

  return result;
};

/**
 * 비밀번호 히스토리 검증 (최근 5개 비밀번호와 중복 확인)
 * @param {string} newPassword - 새 비밀번호
 * @param {Array} passwordHistory - 이전 비밀번호 해시 배열
 * @returns {Promise<boolean>} 사용 가능 여부
 */
const checkPasswordHistory = async (newPassword, passwordHistory) => {
  const bcrypt = require('bcryptjs');
  
  for (const oldHash of passwordHistory) {
    const isMatch = await bcrypt.compare(newPassword, oldHash);
    if (isMatch) {
      return false; // 이전에 사용한 비밀번호
    }
  }
  
  return true; // 사용 가능
};

/**
 * 비밀번호 만료 검증
 * @param {Date} lastPasswordChange - 마지막 비밀번호 변경일
 * @param {number} maxDays - 최대 유효 기간 (기본: 90일)
 * @returns {Object} 만료 정보
 */
const checkPasswordExpiry = (lastPasswordChange, maxDays = 90) => {
  const now = new Date();
  const diffTime = Math.abs(now - new Date(lastPasswordChange));
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return {
    isExpired: diffDays > maxDays,
    daysRemaining: Math.max(0, maxDays - diffDays),
    daysSinceChange: diffDays
  };
};

/**
 * 사용자별 비밀번호 변경 빈도 제한
 * @param {number} userId - 사용자 ID
 * @param {number} minHours - 최소 변경 간격 (기본: 1시간)
 * @returns {Promise<boolean>} 변경 가능 여부
 */
const checkPasswordChangeFrequency = async (userId, minHours = 1) => {
  const { query } = require('./database');
  
  try {
    const result = await query(
      `SELECT updated_at FROM users 
       WHERE id = $1 AND updated_at > NOW() - INTERVAL '${minHours} hours'`,
      [userId]
    );
    
    return result.rows.length === 0; // 최근에 변경하지 않았으면 true
  } catch (error) {
    console.error('비밀번호 변경 빈도 확인 오류:', error);
    return true; // 오류 시 허용
  }
};

module.exports = {
  validatePasswordStrength,
  checkPasswordHistory,
  checkPasswordExpiry,
  checkPasswordChangeFrequency
};
