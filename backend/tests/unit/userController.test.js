const userController = require('../../controllers/userController');
const { pool, query } = require('../../utils/database');
const bcrypt = require('bcryptjs');

// Mock dependencies
jest.mock('../../utils/database');
jest.mock('bcryptjs');

describe('User Controller Unit Tests', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: { id: 1 },
      body: {},
      params: {},
      query: {},
      file: null
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    
    // Mock 초기화
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    test('성공적으로 프로필을 조회해야 함', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        name: '테스트 사용자',
        phone: '010-1234-5678',
        role: 'parent',
        is_active: true,
        email_verified: true,
        profile_image: null,
        created_at: new Date(),
        updated_at: new Date(),
        email_notifications: true,
        sms_notifications: false,
        language: 'ko',
        timezone: 'Asia/Seoul'
      };

      query.mockResolvedValue({
        rows: [mockUser]
      });

      await userController.getProfile(req, res);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, email, name'),
        [1]
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user: mockUser
        }
      });
    });

    test('사용자를 찾을 수 없을 때 404를 반환해야 함', async () => {
      query.mockResolvedValue({
        rows: []
      });

      await userController.getProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    });

    test('데이터베이스 오류 시 500을 반환해야 함', async () => {
      query.mockRejectedValue(new Error('Database error'));

      await userController.getProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: '프로필 조회 중 오류가 발생했습니다.'
      });
    });
  });

  describe('updateProfile', () => {
    test('성공적으로 프로필을 수정해야 함', async () => {
      req.body = {
        name: '새로운 이름',
        phone: '010-9876-5432'
      };

      const updatedUser = {
        id: 1,
        email: 'test@example.com',
        name: '새로운 이름',
        phone: '010-9876-5432',
        role: 'parent',
        profile_image: null,
        updated_at: new Date()
      };

      query
        .mockResolvedValueOnce({ rows: [] }) // UPDATE 쿼리
        .mockResolvedValueOnce({ rows: [updatedUser] }); // SELECT 쿼리

      await userController.updateProfile(req, res);

      expect(query).toHaveBeenCalledTimes(2);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: '프로필이 성공적으로 수정되었습니다.',
        data: {
          user: updatedUser
        }
      });
    });

    test('수정할 정보가 없을 때 400을 반환해야 함', async () => {
      req.body = {}; // 빈 객체

      await userController.updateProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: '수정할 정보를 입력해주세요.'
      });
    });
  });

  describe('changePassword', () => {
    test('성공적으로 비밀번호를 변경해야 함', async () => {
      req.body = {
        currentPassword: 'oldPassword123!',
        newPassword: 'newPassword123!'
      };

      const mockUser = {
        password_hash: 'hashedOldPassword'
      };

      query
        .mockResolvedValueOnce({ rows: [mockUser] }) // 현재 사용자 조회
        .mockResolvedValueOnce({ rows: [] }); // 비밀번호 업데이트

      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue('hashedNewPassword');

      await userController.changePassword(req, res);

      expect(bcrypt.compare).toHaveBeenCalledWith('oldPassword123!', 'hashedOldPassword');
      expect(bcrypt.hash).toHaveBeenCalledWith('newPassword123!', 12);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: '비밀번호가 성공적으로 변경되었습니다.'
      });
    });

    test('현재 비밀번호가 틀릴 때 400을 반환해야 함', async () => {
      req.body = {
        currentPassword: 'wrongPassword',
        newPassword: 'newPassword123!'
      };

      const mockUser = {
        password_hash: 'hashedOldPassword'
      };

      query.mockResolvedValueOnce({ rows: [mockUser] });
      bcrypt.compare.mockResolvedValue(false);

      await userController.changePassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: '현재 비밀번호가 올바르지 않습니다.'
      });
    });
  });
});
