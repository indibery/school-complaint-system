/**
 * 📱 QR코드 유틸리티
 * 
 * @description QR코드 생성 및 검증 시스템
 */

const QRCode = require('qrcode');
const { createHash } = require('./crypto');
const logger = require('./logger');

/**
 * QR코드 생성 옵션
 */
const defaultOptions = {
  errorCorrectionLevel: process.env.QR_CODE_ERROR_LEVEL || 'M',
  type: 'image/png',
  quality: 0.92,
  margin: 1,
  color: {
    dark: '#000000',
    light: '#FFFFFF'
  },
  width: parseInt(process.env.QR_CODE_SIZE) || 200
};

/**
 * 방문 예약용 QR코드 데이터 생성
 */
function generateVisitQRData(reservation) {
  const qrData = {
    type: 'visit_reservation',
    id: reservation.id,
    visitor_name: reservation.visitor_name,
    visit_date: reservation.visit_date,
    visit_time: reservation.visit_time,
    created_at: reservation.created_at,
    // 보안을 위한 해시값 추가
    hash: createHash(`${reservation.id}${reservation.visitor_name}${reservation.visit_date}${process.env.JWT_SECRET}`)
  };

  return JSON.stringify(qrData);
}

/**
 * QR코드 이미지 생성 (Base64)
 */
async function generateQRCode(data, options = {}) {
  try {
    const qrOptions = { ...defaultOptions, ...options };
    const qrCodeDataURL = await QRCode.toDataURL(data, qrOptions);
    
    logger.debug('QR코드 생성 완료:', {
      dataLength: data.length,
      options: qrOptions
    });

    return qrCodeDataURL;
  } catch (error) {
    logger.error('QR코드 생성 실패:', error);
    throw new Error('QR코드 생성 중 오류가 발생했습니다.');
  }
}

/**
 * QR코드 버퍼 생성 (파일 저장용)
 */
async function generateQRBuffer(data, options = {}) {
  try {
    const qrOptions = { ...defaultOptions, ...options };
    const buffer = await QRCode.toBuffer(data, qrOptions);
    
    return buffer;
  } catch (error) {
    logger.error('QR코드 버퍼 생성 실패:', error);
    throw new Error('QR코드 버퍼 생성 중 오류가 발생했습니다.');
  }
}

/**
 * QR코드 SVG 생성
 */
async function generateQRSVG(data, options = {}) {
  try {
    const qrOptions = { 
      ...defaultOptions, 
      ...options,
      type: 'svg'
    };
    
    const svg = await QRCode.toString(data, qrOptions);
    return svg;
  } catch (error) {
    logger.error('QR코드 SVG 생성 실패:', error);
    throw new Error('QR코드 SVG 생성 중 오류가 발생했습니다.');
  }
}

/**
 * 방문 예약 QR코드 생성
 */
async function createVisitQRCode(reservation, format = 'dataurl') {
  try {
    const qrData = generateVisitQRData(reservation);
    
    const customOptions = {
      color: {
        dark: '#2563eb', // 파란색
        light: '#ffffff'
      }
    };

    let result;
    switch (format) {
      case 'buffer':
        result = await generateQRBuffer(qrData, customOptions);
        break;
      case 'svg':
        result = await generateQRSVG(qrData, customOptions);
        break;
      default:
        result = await generateQRCode(qrData, customOptions);
    }

    logger.info('방문 예약 QR코드 생성:', {
      reservationId: reservation.id,
      visitorName: reservation.visitor_name,
      format
    });

    return {
      qrCode: result,
      qrData: qrData,
      hash: createHash(qrData)
    };
  } catch (error) {
    logger.error('방문 예약 QR코드 생성 실패:', error);
    throw error;
  }
}

/**
 * QR코드 데이터 검증
 */
function validateQRData(qrDataString) {
  try {
    const qrData = JSON.parse(qrDataString);
    
    // 필수 필드 확인
    const requiredFields = ['type', 'id', 'visitor_name', 'visit_date', 'hash'];
    for (const field of requiredFields) {
      if (!qrData[field]) {
        return {
          valid: false,
          error: `필수 필드가 누락되었습니다: ${field}`
        };
      }
    }

    // 타입 확인
    if (qrData.type !== 'visit_reservation') {
      return {
        valid: false,
        error: '지원하지 않는 QR코드 타입입니다.'
      };
    }

    // 해시 검증
    const expectedHash = createHash(`${qrData.id}${qrData.visitor_name}${qrData.visit_date}${process.env.JWT_SECRET}`);
    if (qrData.hash !== expectedHash) {
      return {
        valid: false,
        error: 'QR코드가 변조되었거나 유효하지 않습니다.'
      };
    }

    // 날짜 검증
    const visitDate = new Date(qrData.visit_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (visitDate < today) {
      return {
        valid: false,
        error: '만료된 QR코드입니다.'
      };
    }

    return {
      valid: true,
      data: qrData
    };
  } catch (error) {
    logger.error('QR코드 검증 실패:', error);
    return {
      valid: false,
      error: 'QR코드 형식이 올바르지 않습니다.'
    };
  }
}

/**
 * 교문 체크인용 QR코드 스캔 처리
 */
async function processQRScan(qrDataString, scannerId) {
  try {
    const validation = validateQRData(qrDataString);
    
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      };
    }

    const qrData = validation.data;
    
    logger.info('QR코드 스캔 처리:', {
      reservationId: qrData.id,
      visitorName: qrData.visitor_name,
      scannerId,
      scanTime: new Date().toISOString()
    });

    return {
      success: true,
      reservationId: qrData.id,
      visitorName: qrData.visitor_name,
      visitDate: qrData.visit_date,
      visitTime: qrData.visit_time,
      scanTime: new Date().toISOString()
    };
  } catch (error) {
    logger.error('QR코드 스캔 처리 실패:', error);
    return {
      success: false,
      error: '스캔 처리 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 테스트용 QR코드 생성
 */
async function generateTestQRCode() {
  const testData = {
    type: 'visit_reservation',
    id: 'test-12345',
    visitor_name: '테스트 방문자',
    visit_date: new Date().toISOString().split('T')[0],
    visit_time: '14:00',
    created_at: new Date().toISOString(),
    hash: createHash(`test-12345테스트 방문자${new Date().toISOString().split('T')[0]}${process.env.JWT_SECRET}`)
  };

  const qrDataString = JSON.stringify(testData);
  const qrCode = await generateQRCode(qrDataString);

  return {
    qrCode,
    qrData: qrDataString,
    testData
  };
}

/**
 * QR코드 통계 생성
 */
function generateQRStats(qrScanHistory) {
  const stats = {
    totalScans: qrScanHistory.length,
    successfulScans: qrScanHistory.filter(scan => scan.success).length,
    failedScans: qrScanHistory.filter(scan => !scan.success).length,
    uniqueVisitors: new Set(qrScanHistory.map(scan => scan.visitor_name)).size,
    scansByHour: {},
    scansByDate: {},
    errorTypes: {}
  };

  // 시간대별 스캔 통계
  qrScanHistory.forEach(scan => {
    const hour = new Date(scan.scan_time).getHours();
    stats.scansByHour[hour] = (stats.scansByHour[hour] || 0) + 1;

    const date = new Date(scan.scan_time).toISOString().split('T')[0];
    stats.scansByDate[date] = (stats.scansByDate[date] || 0) + 1;

    if (!scan.success && scan.error) {
      stats.errorTypes[scan.error] = (stats.errorTypes[scan.error] || 0) + 1;
    }
  });

  return stats;
}

/**
 * QR코드 일괄 생성 (여러 예약)
 */
async function generateBulkQRCodes(reservations, format = 'dataurl') {
  const results = [];
  
  for (const reservation of reservations) {
    try {
      const qrResult = await createVisitQRCode(reservation, format);
      results.push({
        reservationId: reservation.id,
        success: true,
        qrCode: qrResult.qrCode,
        qrData: qrResult.qrData
      });
    } catch (error) {
      results.push({
        reservationId: reservation.id,
        success: false,
        error: error.message
      });
    }
  }

  const successCount = results.filter(r => r.success).length;
  logger.info(`QR코드 일괄 생성 완료: ${successCount}/${reservations.length}`);

  return results;
}

module.exports = {
  generateQRCode,
  generateQRBuffer,
  generateQRSVG,
  createVisitQRCode,
  validateQRData,
  processQRScan,
  generateTestQRCode,
  generateQRStats,
  generateBulkQRCodes
};