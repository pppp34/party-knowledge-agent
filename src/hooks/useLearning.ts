import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { LearningStats, LearningRecord } from '../types';
import APP_CONFIG from '../config';

export function useLearning() {
  const { user, token } = useAuth();
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [records, setRecords] = useState<LearningRecord[]>([]);
  const sessionStartRef = useRef<Date | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 记录学习行为
  const recordAction = useCallback(async (
    actionType: string,
    options?: {
      sessionId?: string;
      queryKeyword?: string;
      durationSeconds?: number;
      metadata?: Record<string, unknown>;
    }
  ) => {
    if (!user || !token) return;
    
    try {
      await fetch('/api/learning/record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionId: options?.sessionId || currentSessionIdRef.current,
          actionType,
          queryKeyword: options?.queryKeyword,
          durationSeconds: options?.durationSeconds,
          metadata: options?.metadata
        })
      });
    } catch (error) {
      console.error('[Learning] 记录失败:', error);
    }
  }, [user, token]);

  // 开始学习会话
  const startSession = useCallback((sessionId: string) => {
    currentSessionIdRef.current = sessionId;
    sessionStartRef.current = new Date();
    recordAction('session_start', { sessionId });

    // 定时上报学习时长
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (sessionStartRef.current) {
        const elapsed = Math.floor((Date.now() - sessionStartRef.current.getTime()) / 1000);
        if (elapsed >= APP_CONFIG.minLearningDuration) {
          recordAction('session_end', {
            sessionId: currentSessionIdRef.current || undefined,
            durationSeconds: APP_CONFIG.learningReportInterval / 1000
          });
          // 重置计时起点（累计计时）
          sessionStartRef.current = new Date();
        }
      }
    }, APP_CONFIG.learningReportInterval);
  }, [recordAction]);

  // 结束学习会话
  const endSession = useCallback(() => {
    if (sessionStartRef.current) {
      const elapsed = Math.floor((Date.now() - sessionStartRef.current.getTime()) / 1000);
      if (elapsed >= APP_CONFIG.minLearningDuration) {
        recordAction('session_end', {
          sessionId: currentSessionIdRef.current || undefined,
          durationSeconds: elapsed
        });
      }
    }
    sessionStartRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [recordAction]);

  // 获取个人学习统计
  const fetchStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/learning/my-stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('[Learning] 获取统计失败:', error);
    }
  }, [token]);

  // 获取个人学习记录
  const fetchRecords = useCallback(async (limit: number = 100) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/learning/my-records?limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
      }
    } catch (error) {
      console.error('[Learning] 获取记录失败:', error);
    }
  }, [token]);

  // 计算当前会话学习时长
  const getCurrentDuration = useCallback((): number => {
    if (!sessionStartRef.current) return 0;
    return Math.floor((Date.now() - sessionStartRef.current.getTime()) / 1000);
  }, []);

  // 组件卸载时结束会话
  useEffect(() => {
    return () => {
      endSession();
    };
  }, [endSession]);

  return {
    stats,
    records,
    startSession,
    endSession,
    recordAction,
    fetchStats,
    fetchRecords,
    getCurrentDuration
  };
}
