import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLearning } from '../hooks/useLearning';
import { LearningStats } from '../types';
import { Card, Button, Tag, Table, Loading } from 'tdesign-react';
import { ArrowLeftIcon, TimeIcon, ChatIcon, SearchIcon, UserIcon } from 'tdesign-icons-react';

export function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { stats, fetchStats, endSession } = useLearning();

  useEffect(() => {
    // 切换到档案页时结束当前会话计时
    endSession();
    fetchStats();
  }, [fetchStats, endSession]);

  if (!user) {
    navigate('/login');
    return null;
  }

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}秒`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}分${seconds % 60}秒`;
    const hours = Math.floor(mins / 60);
    return `${hours}小时${mins % 60}分`;
  };

  const roleLabel: Record<string, string> = {
    party_member: '党员',
    branch_admin: '支部管理员',
    system_admin: '系统管理员'
  };

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      {/* 返回按钮 */}
      <Button variant="text" onClick={() => navigate('/')} style={{ marginBottom: 16 }}>
        <ArrowLeftIcon /> 返回对话
      </Button>

      {/* 用户信息卡片 */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            backgroundColor: '#E53935',
            color: '#fff',
            fontSize: 24,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {user.displayName?.charAt(0) || user.username.charAt(0)}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20 }}>{user.displayName}</h2>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <Tag theme="primary" variant="light">{roleLabel[user.role] || user.role}</Tag>
              {user.branchName && <Tag variant="light">{user.branchName}</Tag>}
            </div>
          </div>
        </div>
      </Card>

      {/* 学习统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <Card>
          <div style={{ textAlign: 'center' }}>
            <ChatIcon style={{ color: '#E53935', marginBottom: 8 }} size={24} />
            <div style={{ fontSize: 28, fontWeight: 600 }}>{stats?.totalSessions || 0}</div>
            <div style={{ fontSize: 13, color: 'var(--td-text-color-secondary)' }}>对话次数</div>
          </div>
        </Card>
        <Card>
          <div style={{ textAlign: 'center' }}>
            <SearchIcon style={{ color: '#1976D2', marginBottom: 8 }} size={24} />
            <div style={{ fontSize: 28, fontWeight: 600 }}>{stats?.totalQueries || 0}</div>
            <div style={{ fontSize: 13, color: 'var(--td-text-color-secondary)' }}>查询次数</div>
          </div>
        </Card>
        <Card>
          <div style={{ textAlign: 'center' }}>
            <TimeIcon style={{ color: '#388E3C', marginBottom: 8 }} size={24} />
            <div style={{ fontSize: 28, fontWeight: 600 }}>{formatDuration(stats?.totalDuration || 0)}</div>
            <div style={{ fontSize: 13, color: 'var(--td-text-color-secondary)' }}>累计学习</div>
          </div>
        </Card>
        <Card>
          <div style={{ textAlign: 'center' }}>
            <UserIcon style={{ color: '#F57C00', marginBottom: 8 }} size={24} />
            <div style={{ fontSize: 28, fontWeight: 600 }}>{stats?.topKeywords?.length || 0}</div>
            <div style={{ fontSize: 13, color: 'var(--td-text-color-secondary)' }}>关注主题</div>
          </div>
        </Card>
      </div>

      {/* 高频关键词 */}
      {stats?.topKeywords && stats.topKeywords.length > 0 && (
        <Card title="关注主题" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {stats.topKeywords.map((kw, i) => (
              <Tag key={i} theme="primary" variant="light" size="medium">
                {kw.keyword} ({kw.count})
              </Tag>
            ))}
          </div>
        </Card>
      )}

      {/* 每日学习活动 */}
      {stats?.dailyActivity && stats.dailyActivity.length > 0 && (
        <Card title="最近学习活动">
          <Table
            data={stats.dailyActivity.map(d => ({
              date: d.date,
              sessions: d.sessions,
              queries: d.queries,
              duration: formatDuration(d.duration)
            }))}
            columns={[
              { colKey: 'date', title: '日期', width: 120 },
              { colKey: 'sessions', title: '对话次数', width: 100 },
              { colKey: 'queries', title: '查询次数', width: 100 },
              { colKey: 'duration', title: '学习时长', width: 120 }
            ]}
            size="small"
            bordered
          />
        </Card>
      )}
    </div>
  );
}
