import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useParams, useLocation, Navigate } from 'react-router-dom';
import '@tdesign-react/chat/es/style/index.js';

import { AuthProvider, useAuth } from './context/AuthContext';
import { useAgents } from './hooks/useAgents';
import { useTheme } from './hooks/useTheme';
import { useSessions } from './hooks/useSessions';
import { useModels } from './hooks/useModels';
import { useChat } from './hooks/useChat';
import { useLearning } from './hooks/useLearning';
import { PermissionMode } from './types';

import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { SettingsPage } from './components/SettingsPage';
import { ChatPage } from './pages/ChatPage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { LearningTracker } from './components/LearningTracker';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminConversations } from './pages/AdminConversations';
import { AdminLearning } from './pages/AdminLearning';
import { AdminUsers } from './pages/AdminUsers';
import { AdminKnowledge } from './pages/AdminKnowledge';
import { ErrorBoundary } from './components/ErrorBoundary';

// 认证守卫组件
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

// 管理员守卫组件
function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (user?.role !== 'branch_admin' && user?.role !== 'system_admin') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

// 主应用内容（需要认证）
function MainApp() {
  const navigate = useNavigate();
  const { sessionId: urlSessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const isSettingsPage = location.pathname === '/settings';
  const { user, token } = useAuth();
  const { startSession, endSession } = useLearning();
  
  // Hooks
  const { theme, toggleTheme } = useTheme();
  const { agents, addAgent, updateAgent, deleteAgent, getAgent } = useAgents();
  const { models, selectedModel, setSelectedModel, fetchModels } = useModels();
  const {
    sessions,
    setSessions,
    currentSessionId,
    setCurrentSessionId,
    currentSession,
    sessionModels,
    fetchSessions,
    deleteSession,
    updateSessionModel,
    addSession,
    updateSession,
    updateSessionMessages,
  } = useSessions();

  const {
    isLoading,
    inputValue,
    setInputValue,
    permissionRequest,
    sendMessage,
    handleStop,
    handlePermissionAllow,
    handlePermissionDeny,
  } = useChat({
    currentSession,
    currentSessionId,
    selectedModel,
    getAgent,
    addSession,
    updateSession,
    updateSessionMessages,
    updateSessionModel,
    setCurrentSessionId,
    setSessions,
  });

  const currentAgent = currentSession?.agentId ? getAgent(currentSession.agentId) : getAgent('default');

  // 从 URL 同步 sessionId
  useEffect(() => {
    if (urlSessionId && urlSessionId !== currentSessionId) {
      setCurrentSessionId(urlSessionId);
      // 开始学习会话追踪
      startSession(urlSessionId);
    } else if (!urlSessionId && !isSettingsPage && currentSessionId) {
      setCurrentSessionId(null);
    }
  }, [urlSessionId, isSettingsPage, currentSessionId, setCurrentSessionId, startSession]);

  // 当切换会话时，恢复该会话的模型选择
  useEffect(() => {
    if (currentSessionId && sessionModels[currentSessionId]) {
      setSelectedModel(sessionModels[currentSessionId]);
    } else if (currentSession) {
      setSelectedModel(currentSession.model);
    }
  }, [currentSessionId, sessionModels, currentSession, setSelectedModel]);

  // 初始加载会话列表
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const updateCurrentSessionModel = useCallback((modelId: string) => {
    setSelectedModel(modelId);
    if (currentSessionId) {
      updateSessionModel(currentSessionId, modelId);
    }
  }, [currentSessionId, updateSessionModel, setSelectedModel]);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    // 结束学习会话
    endSession();
    const navigateTo = await deleteSession(sessionId);
    if (navigateTo) {
      navigate(navigateTo);
    }
  }, [deleteSession, navigate, endSession]);

  const handleNewChat = useCallback(() => {
    endSession();
    setCurrentSessionId(null);
    navigate('/');
  }, [navigate, setCurrentSessionId, endSession]);

  const handleSelectSession = useCallback((sessionId: string) => {
    endSession();
    setCurrentSessionId(sessionId);
    navigate(`/chat/${sessionId}`);
    startSession(sessionId);
  }, [navigate, setCurrentSessionId, endSession, startSession]);

  const handleOpenSettings = useCallback(() => {
    navigate('/settings');
  }, [navigate]);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [permissionMode, setPermissionMode] = useState<PermissionMode>('default');

  return (
    <div 
      className="flex h-screen w-screen"
      style={{ backgroundColor: 'var(--td-bg-color-page)' }}
    >
      {/* 侧边栏 */}
      <Sidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        isSettingsPage={isSettingsPage}
        sidebarOpen={sidebarOpen}
        agents={agents}
        getAgent={getAgent}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onOpenSettings={handleOpenSettings}
      />

      {/* 主内容区 */}
      <main 
        className="flex-1 flex flex-col min-w-0"
        style={{ backgroundColor: 'var(--td-bg-color-page)' }}
      >
        {/* 顶部栏 */}
        <Header
          isSettingsPage={isSettingsPage}
          sidebarOpen={sidebarOpen}
          theme={theme}
          currentSession={currentSession}
          currentAgent={currentAgent}
          models={models}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onToggleTheme={toggleTheme}
          onRefreshModels={fetchModels}
        />

        {/* 设置页面或聊天页面 */}
        <div className="flex-1 overflow-hidden">
          {isSettingsPage ? (
            <SettingsPage
              agents={agents}
              onAdd={addAgent}
              onUpdate={updateAgent}
              onDelete={deleteAgent}
            />
          ) : (
            <ChatPage
              currentSession={currentSession}
              models={models}
              selectedModel={selectedModel}
              agents={agents}
              isLoading={isLoading}
              inputValue={inputValue}
              permissionRequest={permissionRequest}
              permissionMode={permissionMode}
              onSendMessage={sendMessage}
              onStop={handleStop}
              onInputChange={setInputValue}
              onModelChange={updateCurrentSessionModel}
              onPermissionAllow={handlePermissionAllow}
              onPermissionDeny={handlePermissionDeny}
              onPermissionModeChange={setPermissionMode}
            />
          )}
        </div>

        {/* 学习追踪器 */}
        <LearningTracker />
      </main>
    </div>
  );
}

// 路由组件
function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/profile" element={<AuthGuard><ProfilePage /></AuthGuard>} />
      <Route path="/admin" element={<AdminGuard><ErrorBoundary><AdminDashboard /></ErrorBoundary></AdminGuard>} />
      <Route path="/admin/conversations" element={<AdminGuard><ErrorBoundary><AdminConversations /></ErrorBoundary></AdminGuard>} />
      <Route path="/admin/learning" element={<AdminGuard><ErrorBoundary><AdminLearning /></ErrorBoundary></AdminGuard>} />
      <Route path="/admin/users" element={<AdminGuard><ErrorBoundary><AdminUsers /></ErrorBoundary></AdminGuard>} />
      <Route path="/admin/knowledge" element={<AdminGuard><ErrorBoundary><AdminKnowledge /></ErrorBoundary></AdminGuard>} />
      <Route path="/" element={<AuthGuard><MainApp /></AuthGuard>} />
      <Route path="/chat/:sessionId" element={<AuthGuard><MainApp /></AuthGuard>} />
      <Route path="/settings" element={<AuthGuard><MainApp /></AuthGuard>} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
