import React, { useState, useEffect } from 'react';
import { useLearning } from '../hooks/useLearning';
import { TimeIcon, ChatIcon, SearchIcon } from 'tdesign-icons-react';

export function LearningTracker() {
  const { getCurrentDuration, stats } = useLearning();
  const [elapsed, setElapsed] = useState(0);

  // 每秒更新当前会话时长
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(getCurrentDuration());
    }, 1000);
    return () => clearInterval(timer);
  }, [getCurrentDuration]);

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}秒`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return `${mins}分${secs}秒`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}小时${remainingMins}分`;
  };

  const totalDuration = stats?.totalDuration || 0;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '8px 16px',
      backgroundColor: 'var(--td-bg-color-container)',
      borderTop: '1px solid var(--td-border-level-1-color)',
      fontSize: 12,
      color: 'var(--td-text-color-secondary)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <TimeIcon size={14} />
        <span>本次学习: {formatDuration(elapsed)}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <ChatIcon size={14} />
        <span>对话: {stats?.totalSessions || 0}次</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <SearchIcon size={14} />
        <span>查询: {stats?.totalQueries || 0}次</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <TimeIcon size={14} />
        <span>累计学习: {formatDuration(totalDuration)}</span>
      </div>
    </div>
  );
}
