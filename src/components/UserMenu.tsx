import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Dropdown, MessagePlugin } from 'tdesign-react';
import { UserIcon, LogoutIcon, SettingIcon, ChartIcon } from 'tdesign-icons-react';

export function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const isAdmin = user.role === 'branch_admin' || user.role === 'system_admin';

  const handleLogout = () => {
    logout();
    navigate('/login');
    MessagePlugin.success('已退出登录');
  };

  const dropdownItems = [
    {
      content: '我的学习档案',
      prefixIcon: <UserIcon />,
      onClick: () => navigate('/profile')
    },
    ...(isAdmin ? [{
      content: '管理后台',
      prefixIcon: <ChartIcon />,
      onClick: () => navigate('/admin')
    }] : []),
    {
      content: '退出登录',
      prefixIcon: <LogoutIcon />,
      onClick: handleLogout
    }
  ];

  return (
    <Dropdown options={dropdownItems} trigger="click">
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
        padding: '4px 12px',
        borderRadius: 8,
        transition: 'background-color 0.2s',
      }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--td-bg-color-container-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <div style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          backgroundColor: '#E53935',
          color: '#fff',
          fontSize: 14,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          {user.displayName?.charAt(0) || user.username.charAt(0)}
        </div>
        <span style={{ 
          fontSize: 14, 
          color: 'var(--td-text-color-primary)',
          maxWidth: 100,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {user.displayName}
        </span>
      </div>
    </Dropdown>
  );
}
