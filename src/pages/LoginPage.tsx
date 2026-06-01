import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoginRequest, RegisterRequest } from '../types';
import { Button, Input, Form, MessagePlugin, Tabs } from 'tdesign-react';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, register, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('login');

  // 登录表单
  const [loginData, setLoginData] = useState<LoginRequest>({ username: '', password: '' });

  // 注册表单
  const [registerData, setRegisterData] = useState<RegisterRequest>({
    username: '',
    password: '',
    displayName: '',
    branchName: ''
  });

  const handleLogin = async () => {
    if (!loginData.username || !loginData.password) {
      MessagePlugin.warning('请填写用户名和密码');
      return;
    }
    try {
      await login(loginData);
      MessagePlugin.success('登录成功');
      navigate('/');
    } catch (error: any) {
      MessagePlugin.error(error.message || '登录失败');
    }
  };

  const handleRegister = async () => {
    if (!registerData.username || !registerData.password || !registerData.displayName) {
      MessagePlugin.warning('请填写必填信息');
      return;
    }
    try {
      await register(registerData);
      MessagePlugin.success('注册成功');
      navigate('/');
    } catch (error: any) {
      MessagePlugin.error(error.message || '注册失败');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent, action: 'login' | 'register') => {
    if (e.key === 'Enter') {
      if (action === 'login') handleLogin();
      else handleRegister();
    }
  };

  return (
    <div className="login-page" style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: 'var(--td-bg-color-page)'
    }}>
      <div style={{
        width: 420,
        padding: 40,
        borderRadius: 12,
        backgroundColor: 'var(--td-bg-color-container)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            backgroundColor: '#E53935',
            color: '#fff',
            fontSize: 28,
            fontWeight: 'bold',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 12
          }}>
            江
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--td-text-color-primary)', margin: 0 }}>
            江开乡振院党建智能体
          </h1>
          <p style={{ fontSize: 14, color: 'var(--td-text-color-secondary)', marginTop: 8 }}>
            党建知识智能问答平台
          </p>
        </div>

        {/* 标签页切换 */}
        <Tabs
          value={activeTab}
          onChange={(val) => setActiveTab(val as string)}
          style={{ marginBottom: 24 }}
        >
          <Tabs.TabPanel value="login" label="登录">
            <div onKeyPress={(e) => handleKeyPress(e, 'login')}>
              <Form labelAlign="top">
                <Form.FormItem label="用户名">
                  <Input
                    value={loginData.username}
                    onChange={(val) => setLoginData({ ...loginData, username: val as string })}
                    placeholder="请输入用户名"
                    clearable
                  />
                </Form.FormItem>
                <Form.FormItem label="密码">
                  <Input
                    type="password"
                    value={loginData.password}
                    onChange={(val) => setLoginData({ ...loginData, password: val as string })}
                    placeholder="请输入密码"
                    clearable
                  />
                </Form.FormItem>
                <Button
                  theme="primary"
                  block
                  onClick={handleLogin}
                  loading={isLoading}
                  style={{ marginTop: 8 }}
                >
                  登录
                </Button>
              </Form>
            </div>
          </Tabs.TabPanel>
          <Tabs.TabPanel value="register" label="注册">
            <div onKeyPress={(e) => handleKeyPress(e, 'register')}>
              <Form labelAlign="top">
                <Form.FormItem label="用户名" requiredMark>
                  <Input
                    value={registerData.username}
                    onChange={(val) => setRegisterData({ ...registerData, username: val as string })}
                    placeholder="至少3个字符"
                    clearable
                  />
                </Form.FormItem>
                <Form.FormItem label="密码" requiredMark>
                  <Input
                    type="password"
                    value={registerData.password}
                    onChange={(val) => setRegisterData({ ...registerData, password: val as string })}
                    placeholder="至少6个字符"
                    clearable
                  />
                </Form.FormItem>
                <Form.FormItem label="显示名称" requiredMark>
                  <Input
                    value={registerData.displayName}
                    onChange={(val) => setRegisterData({ ...registerData, displayName: val as string })}
                    placeholder="如：张三"
                    clearable
                  />
                </Form.FormItem>
                <Form.FormItem label="所属支部">
                  <Input
                    value={registerData.branchName}
                    onChange={(val) => setRegisterData({ ...registerData, branchName: val as string })}
                    placeholder="如：第一党支部"
                    clearable
                  />
                </Form.FormItem>
                <Button
                  theme="primary"
                  block
                  onClick={handleRegister}
                  loading={isLoading}
                  style={{ marginTop: 8 }}
                >
                  注册
                </Button>
              </Form>
            </div>
          </Tabs.TabPanel>
        </Tabs>
      </div>
    </div>
  );
}
