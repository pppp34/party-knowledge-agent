import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DashboardIcon, ChatIcon, BookIcon, UserIcon, RollbackIcon, FolderOpenIcon, AppIcon } from 'tdesign-icons-react';

export function AdminSidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { value: '/admin', label: '数据总览', icon: <DashboardIcon /> },
    { value: '/admin/conversations', label: '对话查询', icon: <ChatIcon /> },
    { value: '/admin/learning', label: '学习统计', icon: <BookIcon /> },
    { value: '/admin/users', label: '用户管理', icon: <UserIcon /> },
    { value: '/admin/knowledge', label: '知识库', icon: <FolderOpenIcon /> },
    { value: '/admin/skills', label: '技能管理', icon: <AppIcon /> },
  ];

  const activeMenu = menuItems.find(item => location.pathname === item.value)?.value || '/admin';

  return (
    <div style={{
      width: 200,
      backgroundColor: 'var(--td-bg-color-container)',
      borderRight: '1px solid var(--td-border-level-1-color)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }}>
      <div style={{
        padding: '16px 16px 8px',
        fontSize: 16,
        fontWeight: 600,
        color: 'var(--td-text-color-primary)'
      }}>
        管理后台
      </div>

      {/* 简化的菜单 - 不用 TDesign Menu 组件 */}
      <div style={{ flex: 1, padding: '8px 12px' }}>
        {menuItems.map(item => {
          const isActive = activeMenu === item.value;
          return (
            <div
              key={item.value}
              onClick={() => navigate(item.value)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14,
                marginBottom: 4,
                color: isActive ? '#fff' : 'var(--td-text-color-primary)',
                backgroundColor: isActive ? '#1976D2' : 'transparent',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'var(--td-bg-color-container-hover)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              {item.icon}
              {item.label}
            </div>
          );
        })}
      </div>

      <div style={{ padding: 12, borderTop: '1px solid var(--td-border-level-1-color)' }}>
        <div
          onClick={() => navigate('/')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            cursor: 'pointer',
            borderRadius: 6,
            fontSize: 14,
            color: 'var(--td-text-color-secondary)',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--td-bg-color-container-hover)';
            e.currentTarget.style.color = 'var(--td-text-color-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--td-text-color-secondary)';
          }}
        >
          <RollbackIcon size={16} /> 返回前台
        </div>
      </div>
    </div>
  );
}
