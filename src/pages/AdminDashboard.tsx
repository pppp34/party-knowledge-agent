import React, { useEffect } from 'react';
import { AdminSidebar } from '../components/AdminSidebar';
import { useAdmin } from '../hooks/useAdmin';
import { Card, Loading } from 'tdesign-react';
import { ChatIcon, ChatBubbleIcon, UserIcon, TimeIcon } from 'tdesign-icons-react';

export function AdminDashboard() {
  const { stats, fetchStats, isLoading } = useAdmin();

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const statCards = [
    {
      title: '总对话数',
      value: stats?.totalConversations || 0,
      icon: <ChatIcon size={28} />,
      color: '#E53935'
    },
    {
      title: '总消息数',
      value: stats?.totalMessages || 0,
      icon: <ChatBubbleIcon size={28} />,
      color: '#1976D2'
    },
    {
      title: '7日活跃用户',
      value: stats?.activeUsers7d || 0,
      icon: <UserIcon size={28} />,
      color: '#388E3C'
    },
    {
      title: '累计学习(小时)',
      value: stats?.totalLearningHours || 0,
      icon: <TimeIcon size={28} />,
      color: '#F57C00'
    }
  ];

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <AdminSidebar />
      <div style={{ flex: 1, padding: 24, overflow: 'auto', backgroundColor: 'var(--td-bg-color-page)' }}>
        <h2 style={{ margin: '0 0 24px', fontSize: 20 }}>数据总览</h2>
        
        {isLoading ? (
          <Loading />
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {statCards.map((card, i) => (
                <Card key={i}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{
                      width: 52,
                      height: 52,
                      borderRadius: 12,
                      backgroundColor: card.color + '15',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: card.color
                    }}>
                      {card.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--td-text-color-primary)' }}>
                        {card.value}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--td-text-color-secondary)' }}>
                        {card.title}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <Card title="系统信息">
              <div style={{ fontSize: 14, lineHeight: 2 }}>
                <div>总用户数: {stats?.totalUsers || 0}</div>
                <div>总对话数: {stats?.totalConversations || 0}</div>
                <div>总消息数: {stats?.totalMessages || 0}</div>
                <div>累计学习时长: {stats?.totalLearningHours || 0} 小时</div>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
