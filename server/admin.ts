import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as db from './db.js';
import { authMiddleware, adminMiddleware, AuthenticatedRequest, hashPassword } from './auth.js';

const router = Router();

// ============= 对话记录查询 =============

router.get('/conversations', authMiddleware, adminMiddleware, (req: AuthenticatedRequest, res) => {
  try {
    const { userId, startDate, endDate, keyword, limit, offset } = req.query;
    
    const result = db.getConversationsFiltered({
      userId: userId as string,
      startDate: startDate as string,
      endDate: endDate as string,
      keyword: keyword as string,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0
    });
    
    res.json(result);
  } catch (error: any) {
    console.error('[Admin] Get conversations error:', error);
    res.status(500).json({ error: error?.message || '获取对话记录失败' });
  }
});

// ============= 学习记录查询 =============

router.get('/learning', authMiddleware, adminMiddleware, (req: AuthenticatedRequest, res) => {
  try {
    const { userId, startDate, endDate, actionType, limit, offset } = req.query;
    
    const result = db.getLearningRecordsFiltered({
      userId: userId as string,
      startDate: startDate as string,
      endDate: endDate as string,
      actionType: actionType as string,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0
    });
    
    // 附加用户名信息
    const recordsWithUser = result.records.map(record => {
      const user = db.getUserById(record.user_id);
      return {
        ...record,
        user_display_name: user?.display_name || '未知用户',
        user_username: user?.username || ''
      };
    });
    
    res.json({ records: recordsWithUser, total: result.total });
  } catch (error: any) {
    console.error('[Admin] Get learning records error:', error);
    res.status(500).json({ error: error?.message || '获取学习记录失败' });
  }
});

// ============= 总体统计 =============

router.get('/stats', authMiddleware, adminMiddleware, (req: AuthenticatedRequest, res) => {
  try {
    const stats = db.getAdminStats();
    res.json(stats);
  } catch (error: any) {
    console.error('[Admin] Get stats error:', error);
    res.status(500).json({ error: error?.message || '获取统计数据失败' });
  }
});

// ============= 用户管理 =============

router.get('/users', authMiddleware, adminMiddleware, (req: AuthenticatedRequest, res) => {
  try {
    const users = db.getAllUsers().map(u => ({
      id: u.id,
      username: u.username,
      displayName: u.display_name,
      role: u.role,
      branchName: u.branch_name,
      createdAt: u.created_at,
      lastLoginAt: u.last_login_at,
      isActive: !!u.is_active
    }));
    res.json({ users });
  } catch (error: any) {
    console.error('[Admin] Get users error:', error);
    res.status(500).json({ error: error?.message || '获取用户列表失败' });
  }
});

router.patch('/users/:id', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { displayName, role, branchName, isActive } = req.body;
    
    // 系统管理员不能禁用自己
    if (req.user?.userId === id && isActive === false) {
      return res.status(400).json({ error: '不能禁用自己' });
    }
    
    // 只有 system_admin 可以修改角色
    if (role && req.user?.role !== 'system_admin') {
      return res.status(403).json({ error: '只有系统管理员可以修改用户角色' });
    }
    
    const success = db.updateUser(id, {
      display_name: displayName,
      role: role as any,
      branch_name: branchName,
      is_active: isActive !== undefined ? (isActive ? 1 : 0) : undefined
    });
    
    if (!success) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Admin] Update user error:', error);
    res.status(500).json({ error: error?.message || '更新用户失败' });
  }
});

export default router;
