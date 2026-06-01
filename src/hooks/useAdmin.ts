import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { AdminStats, ConversationItem, LearningRecord, User } from '../types';

export function useAdmin() {
  const { token } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [conversationsTotal, setConversationsTotal] = useState(0);
  const [learningRecords, setLearningRecords] = useState<any[]>([]);
  const [learningTotal, setLearningTotal] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };

  // 获取总体统计
  const fetchStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/stats', { headers });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('[Admin] 获取统计失败:', error);
    }
  }, [token]);

  // 获取对话记录
  const fetchConversations = useCallback(async (params?: {
    userId?: string;
    startDate?: string;
    endDate?: string;
    keyword?: string;
    limit?: number;
    offset?: number;
  }) => {
    if (!token) return;
    setIsLoading(true);
    try {
      const searchParams = new URLSearchParams();
      if (params?.userId) searchParams.set('userId', params.userId);
      if (params?.startDate) searchParams.set('startDate', params.startDate);
      if (params?.endDate) searchParams.set('endDate', params.endDate);
      if (params?.keyword) searchParams.set('keyword', params.keyword);
      if (params?.limit) searchParams.set('limit', String(params.limit));
      if (params?.offset) searchParams.set('offset', String(params.offset));
      
      const res = await fetch(`/api/admin/conversations?${searchParams}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
        setConversationsTotal(data.total || 0);
      }
    } catch (error) {
      console.error('[Admin] 获取对话记录失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // 获取学习记录
  const fetchLearningRecords = useCallback(async (params?: {
    userId?: string;
    startDate?: string;
    endDate?: string;
    actionType?: string;
    limit?: number;
    offset?: number;
  }) => {
    if (!token) return;
    setIsLoading(true);
    try {
      const searchParams = new URLSearchParams();
      if (params?.userId) searchParams.set('userId', params.userId);
      if (params?.startDate) searchParams.set('startDate', params.startDate);
      if (params?.endDate) searchParams.set('endDate', params.endDate);
      if (params?.actionType) searchParams.set('actionType', params.actionType);
      if (params?.limit) searchParams.set('limit', String(params.limit));
      if (params?.offset) searchParams.set('offset', String(params.offset));
      
      const res = await fetch(`/api/admin/learning?${searchParams}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setLearningRecords(data.records || []);
        setLearningTotal(data.total || 0);
      }
    } catch (error) {
      console.error('[Admin] 获取学习记录失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // 获取用户列表
  const fetchUsers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/users', { headers });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('[Admin] 获取用户列表失败:', error);
    }
  }, [token]);

  // 更新用户
  const updateUser = useCallback(async (userId: string, updates: Partial<User>) => {
    if (!token) return false;
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        return true;
      }
      const data = await res.json();
      throw new Error(data.error || '更新失败');
    } catch (error: any) {
      console.error('[Admin] 更新用户失败:', error);
      throw error;
    }
  }, [token]);

  return {
    stats,
    conversations,
    conversationsTotal,
    learningRecords,
    learningTotal,
    users,
    isLoading,
    fetchStats,
    fetchConversations,
    fetchLearningRecords,
    fetchUsers,
    updateUser
  };
}
