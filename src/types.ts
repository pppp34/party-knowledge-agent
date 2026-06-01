/**
 * 类型定义
 */

export type PermissionMode = 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions';

// ============= 用户与认证 =============

export type UserRole = 'party_member' | 'branch_admin' | 'system_admin';

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  branchName?: string | null;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  displayName: string;
  branchName?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// ============= 学习行为 =============

export type LearningActionType = 'session_start' | 'session_end' | 'query' | 'knowledge_view' | 'file_upload';

export interface LearningRecord {
  id: string;
  userId: string;
  sessionId?: string | null;
  actionType: LearningActionType;
  queryKeyword?: string | null;
  durationSeconds?: number | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  // 关联信息（管理后台查询时填充）
  userDisplayName?: string;
  userUsername?: string;
}

export interface LearningStats {
  totalSessions: number;
  totalQueries: number;
  totalDuration: number;
  topKeywords: Array<{ keyword: string; count: number }>;
  dailyActivity: Array<{
    date: string;
    sessions: number;
    queries: number;
    duration: number;
  }>;
}

// ============= 管理后台 =============

export interface AdminStats {
  totalConversations: number;
  totalMessages: number;
  totalUsers: number;
  activeUsers7d: number;
  totalLearningHours: number;
}

export interface ConversationItem {
  id: string;
  title: string;
  model: string;
  user_id: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
  user_display_name?: string;
  user_username?: string;
}

// ============= 模型与工具 =============

export interface Model {
  modelId: string;
  name: string;
  description?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input?: Record<string, unknown>;
  status: 'running' | 'completed' | 'error';
  result?: string;
  isError?: boolean;
}

export type ContentBlock = 
  | { type: 'text'; text: string }
  | { type: 'tool_use'; toolCall: ToolCall };

// ============= 消息与会话 =============

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  timestamp: Date;
  isStreaming?: boolean;
  toolCalls?: ToolCall[];
  contentBlocks?: ContentBlock[];
}

export interface Session {
  id: string;
  title: string;
  model: string;
  agentId?: string;
  userId?: string;
  cwd?: string;
  permissionMode?: PermissionMode;
  createdAt: Date;
  messages: Message[];
}

export interface CustomAgent {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  icon?: string;
  color?: string;
  permissionMode?: PermissionMode;
  createdAt: Date;
  updatedAt: Date;
}

export type Agent = CustomAgent;

export type Theme = 'light' | 'dark';

export interface PermissionRequest {
  requestId: string;
  toolUseId: string;
  toolName: string;
  input: Record<string, unknown>;
  sessionId: string;
  timestamp: number;
}

export interface PermissionResponse {
  requestId: string;
  behavior: 'allow' | 'deny';
  message?: string;
}
