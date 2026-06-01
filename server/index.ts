import "dotenv/config";
import express from "express";
import { query, unstable_v2_createSession, unstable_v2_authenticate, PermissionResult, CanUseTool } from "@tencent-ai/agent-sdk";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";
import * as db from "./db.js";
import { authMiddleware, adminMiddleware, hashPassword, verifyPassword, signToken, initDefaultAdmin, AuthenticatedRequest } from "./auth.js";
import adminRouter from "./admin.js";
import knowledgeRouter from "./knowledge.js";
import imaKnowledgeRouter from "./imaKnowledge.js";
import { getAvailableChineseModels, isChineseModel, getChineseModelConfig, streamChineseModel } from "./providers.js";

const execAsync = promisify(exec);

// 待处理的权限请求
interface PendingPermission {
  resolve: (result: PermissionResult) => void;
  reject: (error: Error) => void;
  toolName: string;
  input: Record<string, unknown>;
  sessionId: string;
  timestamp: number;
}

const pendingPermissions = new Map<string, PendingPermission>();

// 权限请求超时时间（5分钟）
const PERMISSION_TIMEOUT = 5 * 60 * 1000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// ========== 生产模式：静态文件托管 ==========
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  console.log(`[Server] 生产模式：托管静态文件 ${distPath}`);
  app.use(express.static(distPath));
}

// 缓存可用模型列表
let cachedModels: Array<{ modelId: string; name: string; description?: string }> = [];
const defaultModel = "claude-sonnet-4";

// 党建知识库 System Prompt
const partySystemPrompt = `你是"江开乡振院党建智能体"，专门为江苏开放大学乡村振兴学院党员和基层党组织提供党建知识服务。

你的职责：
1. 解答党建相关问题，包括党章党规、组织生活制度、时政要点等
2. 提供权威的党建知识引用
3. 协助党员理解党的方针政策
4. 回答需要基于事实，引用具体条文时注明出处

注意事项：
- 回答要准确、权威，不编造内容
- 涉及政策解读时注明来源和时效性
- 对不确定的问题诚实说明
- 语言正式、庄重，符合党建用语习惯
- 如果用户的问题与党建无关，可以适当回答，但应引导回到党建主题`;

// ============= 健康检查 =============

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ============= 认证 API =============

// 注册
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, password, displayName, branchName } = req.body;
    
    if (!username || !password || !displayName) {
      return res.status(400).json({ error: '请填写用户名、密码和显示名称' });
    }
    
    if (username.length < 3) {
      return res.status(400).json({ error: '用户名至少3个字符' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少6个字符' });
    }
    
    // 检查用户名是否已存在
    const existingUser = db.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: '用户名已存在' });
    }
    
    const passwordHash = await hashPassword(password);
    const userId = uuidv4();
    const now = new Date().toISOString();
    
    db.createUser({
      id: userId,
      username,
      password_hash: passwordHash,
      display_name: displayName,
      role: 'party_member',
      branch_name: branchName || null,
      created_at: now,
      last_login_at: now
    });
    
    const token = signToken({ userId, username, role: 'party_member' });
    
    res.json({
      token,
      user: {
        id: userId,
        username,
        displayName,
        role: 'party_member',
        branchName: branchName || null
      }
    });
  } catch (error: any) {
    console.error('[Auth] Register error:', error);
    res.status(500).json({ error: error?.message || '注册失败' });
  }
});

// 登录
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: '请填写用户名和密码' });
    }
    
    const user = db.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    if (!user.is_active) {
      return res.status(401).json({ error: '用户已被禁用' });
    }
    
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    // 更新最后登录时间
    db.updateUserLastLogin(user.id);
    
    const token = signToken({ userId: user.id, username: user.username, role: user.role });
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role,
        branchName: user.branch_name
      }
    });
  } catch (error: any) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({ error: error?.message || '登录失败' });
  }
});

// 获取当前用户信息
app.get("/api/auth/me", authMiddleware, (req: AuthenticatedRequest, res) => {
  try {
    const user = db.getUserById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json({
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
      branchName: user.branch_name,
      createdAt: user.created_at,
      lastLoginAt: user.last_login_at
    });
  } catch (error: any) {
    console.error('[Auth] Me error:', error);
    res.status(500).json({ error: error?.message || '获取用户信息失败' });
  }
});

// ============= 学习行为 API =============

// 记录学习行为
app.post("/api/learning/record", authMiddleware, (req: AuthenticatedRequest, res) => {
  try {
    const { sessionId, actionType, queryKeyword, durationSeconds, metadata } = req.body;
    
    const record = db.createLearningRecord({
      id: uuidv4(),
      user_id: req.user!.userId,
      session_id: sessionId || null,
      action_type: actionType,
      query_keyword: queryKeyword || null,
      duration_seconds: durationSeconds || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
      created_at: new Date().toISOString()
    });
    
    res.json({ success: true, record });
  } catch (error: any) {
    console.error('[Learning] Record error:', error);
    res.status(500).json({ error: error?.message || '记录学习行为失败' });
  }
});

// 获取个人学习统计
app.get("/api/learning/my-stats", authMiddleware, (req: AuthenticatedRequest, res) => {
  try {
    const stats = db.getUserLearningStats(req.user!.userId);
    const dailyActivity = db.getDailyLearningActivity(req.user!.userId, 30);
    res.json({ ...stats, dailyActivity });
  } catch (error: any) {
    console.error('[Learning] Stats error:', error);
    res.status(500).json({ error: error?.message || '获取学习统计失败' });
  }
});

// 获取个人学习记录
app.get("/api/learning/my-records", authMiddleware, (req: AuthenticatedRequest, res) => {
  try {
    const { limit } = req.query;
    const records = db.getLearningRecordsByUser(req.user!.userId, limit ? parseInt(limit as string) : 100);
    res.json({ records });
  } catch (error: any) {
    console.error('[Learning] Records error:', error);
    res.status(500).json({ error: error?.message || '获取学习记录失败' });
  }
});

// ============= 管理后台路由 =============

app.use("/api/admin", adminRouter);
app.use("/api/knowledge", knowledgeRouter);
app.use("/api/ima", imaKnowledgeRouter);

// ============= CodeBuddy SDK 配置 =============

// 登录方式类型
type LoginMethod = 'env' | 'cli' | 'none';

interface LoginStatusResponse {
  isLoggedIn: boolean;
  method?: LoginMethod;
  envConfigured?: boolean;
  cliConfigured?: boolean;
  error?: string;
  apiKey?: string;
  envVars?: {
    apiKey?: string;
    authToken?: string;
    internetEnv?: string;
    baseUrl?: string;
  };
}

// 检查 CodeBuddy CLI 登录状态
app.get("/api/check-login", async (req, res) => {
  const response: LoginStatusResponse = {
    isLoggedIn: false,
    envConfigured: false,
    cliConfigured: false,
    envVars: {},
  };
  
  const apiKey = process.env.CODEBUDDY_API_KEY;
  const authToken = process.env.CODEBUDDY_AUTH_TOKEN;
  const internetEnv = process.env.CODEBUDDY_INTERNET_ENVIRONMENT;
  const baseUrl = process.env.CODEBUDDY_BASE_URL;
  
  if (apiKey || authToken) {
    response.envConfigured = true;
    if (apiKey) {
      response.envVars!.apiKey = apiKey.slice(0, 8) + '****' + apiKey.slice(-4);
      response.apiKey = response.envVars!.apiKey;
    }
    if (authToken) {
      response.envVars!.authToken = authToken.slice(0, 8) + '****' + authToken.slice(-4);
    }
    if (internetEnv) { response.envVars!.internetEnv = internetEnv; }
    if (baseUrl) { response.envVars!.baseUrl = baseUrl; }
  }
  
  try {
    let needsLogin = false;
    
    const result = await unstable_v2_authenticate({
      environment: 'external',
      onAuthUrl: async (authState) => {
        needsLogin = true;
        response.error = '未登录，请先登录 CodeBuddy CLI';
      }
    });
    
    if (!needsLogin && result?.userinfo) {
      response.isLoggedIn = true;
      response.cliConfigured = true;
      response.method = response.envConfigured ? 'env' : 'cli';
    } else if (!needsLogin) {
      response.isLoggedIn = true;
      response.cliConfigured = true;
      response.method = response.envConfigured ? 'env' : 'cli';
    }
  } catch (error: any) {
    if (response.envConfigured) {
      response.isLoggedIn = true;
      response.method = 'env';
    } else {
      response.error = error?.message || String(error);
      response.method = 'none';
    }
  }
  
  res.json(response);
});

// 保存环境变量配置
app.post("/api/save-env-config", (req, res) => {
  const { apiKey, authToken, internetEnv, baseUrl } = req.body;
  
  if (!apiKey && !authToken) {
    return res.status(400).json({ error: '请至少配置 API Key 或 Auth Token' });
  }
  
  const configuredVars: string[] = [];
  
  if (apiKey) { process.env.CODEBUDDY_API_KEY = apiKey; configuredVars.push('CODEBUDDY_API_KEY'); }
  if (authToken) { process.env.CODEBUDDY_AUTH_TOKEN = authToken; configuredVars.push('CODEBUDDY_AUTH_TOKEN'); }
  if (internetEnv) { process.env.CODEBUDDY_INTERNET_ENVIRONMENT = internetEnv; configuredVars.push('CODEBUDDY_INTERNET_ENVIRONMENT'); }
  if (baseUrl) { process.env.CODEBUDDY_BASE_URL = baseUrl; configuredVars.push('CODEBUDDY_BASE_URL'); }
  
  cachedModels = [];
  
  res.json({ 
    success: true, 
    message: `已设置: ${configuredVars.join(', ')}`,
    note: '环境变量仅在当前服务器进程有效，重启后需要重新设置'
  });
});

// 获取可用模型列表（CodeBuddy + 国产模型）
app.get("/api/models", async (req, res) => {
  try {
    // 获取 CodeBuddy 模型
    let codebuddyModels: Array<{ modelId: string; name: string }> = [];
    if (cachedModels.length === 0) {
      try {
        const session = await unstable_v2_createSession({ cwd: process.cwd() });
        const models = await session.getAvailableModels();
        if (models && Array.isArray(models)) {
          cachedModels = models;
        }
      } catch (e) {
        console.log("[Models] CodeBuddy 模型获取失败，使用国产模型:", e);
      }
    }
    codebuddyModels = cachedModels;

    // 获取已配置的国产模型
    const chineseModels = getAvailableChineseModels().map(m => ({
      modelId: m.modelId,
      name: m.name
    }));

    // 合并模型列表（国产模型在前）
    const allModels = [...chineseModels, ...codebuddyModels];

    // 默认模型：优先使用第一个可用的国产模型，否则用 CodeBuddy 默认模型
    const effectiveDefault = chineseModels.length > 0
      ? chineseModels[0].modelId
      : (codebuddyModels.length > 0 ? codebuddyModels[0].modelId : defaultModel);

    res.json({
      models: allModels.length > 0 ? allModels : [{ modelId: defaultModel, name: "Default Model" }],
      defaultModel: effectiveDefault
    });
  } catch (error: any) {
    const chineseModels = getAvailableChineseModels().map(m => ({
      modelId: m.modelId,
      name: m.name
    }));
    res.json({
      models: chineseModels.length > 0 ? chineseModels : [
        { modelId: "claude-sonnet-4", name: "Claude Sonnet 4" }
      ],
      defaultModel: chineseModels.length > 0 ? chineseModels[0].modelId : defaultModel,
      error: error?.message || String(error)
    });
  }
});

// ============= 会话 API =============

// 获取所有会话（包含消息数量）- 支持按用户筛选
app.get("/api/sessions", authMiddleware, (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.query;
    // 普通用户只能看自己的会话，管理员可查看所有
    const isAdmin = req.user && (req.user.role === 'branch_admin' || req.user.role === 'system_admin');
    const sessions = (userId && isAdmin) ? db.getSessionsByUser(userId as string)
      : isAdmin ? db.getAllSessions()
      : db.getSessionsByUser(req.user!.userId);
    const sessionsWithMessages = sessions.map(session => {
      const messages = db.getMessagesBySession(session.id);
      return {
        ...session,
        messageCount: messages.length
      };
    });
    res.json({ sessions: sessionsWithMessages });
  } catch (error: any) {
    console.error("[Sessions] Error:", error);
    res.status(500).json({ error: error?.message || "获取会话失败" });
  }
});

// 获取单个会话及其消息
app.get("/api/sessions/:sessionId", authMiddleware, (req: AuthenticatedRequest, res) => {
  try {
    const { sessionId } = req.params;
    const session = db.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: "会话不存在" });
    }
    
    // 检查权限：普通用户只能看自己的会话
    const isAdmin = req.user!.role === 'branch_admin' || req.user!.role === 'system_admin';
    if (!isAdmin && session.user_id && session.user_id !== req.user!.userId) {
      return res.status(403).json({ error: "无权访问此会话" });
    }
    
    const messages = db.getMessagesBySession(sessionId);
    
    const parsedMessages = messages.map(msg => ({
      ...msg,
      tool_calls: msg.tool_calls ? JSON.parse(msg.tool_calls) : null
    }));
    
    res.json({ session, messages: parsedMessages });
  } catch (error: any) {
    console.error("[Session] Error:", error);
    res.status(500).json({ error: error?.message || "获取会话失败" });
  }
});

// 创建新会话
app.post("/api/sessions", (req, res) => {
  try {
    const { model = defaultModel, title = "新对话", userId } = req.body;
    const now = new Date().toISOString();
    
    const session = db.createSession({
      id: uuidv4(),
      title,
      model,
      user_id: userId || null,
      sdk_session_id: null,
      created_at: now,
      updated_at: now
    });
    
    res.json({ session });
  } catch (error: any) {
    console.error("[Create Session] Error:", error);
    res.status(500).json({ error: error?.message || "创建会话失败" });
  }
});

// 更新会话
app.patch("/api/sessions/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title, model } = req.body;
    
    const success = db.updateSession(sessionId, { title, model });
    
    if (!success) {
      return res.status(404).json({ error: "会话不存在" });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Update Session] Error:", error);
    res.status(500).json({ error: error?.message || "更新会话失败" });
  }
});

// 删除会话
app.delete("/api/sessions/:sessionId", authMiddleware, (req: AuthenticatedRequest, res) => {
  try {
    const { sessionId } = req.params;
    const session = db.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "会话不存在" });
    }
    // 普通用户只能删自己的会话
    const isAdmin = req.user!.role === 'branch_admin' || req.user!.role === 'system_admin';
    if (!isAdmin && session.user_id && session.user_id !== req.user!.userId) {
      return res.status(403).json({ error: "无权删除此会话" });
    }
    const success = db.deleteSession(sessionId);
    
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Delete Session] Error:", error);
    res.status(500).json({ error: error?.message || "删除会话失败" });
  }
});

// ============= 聊天 API =============

// 权限响应 API
app.post("/api/permission-response", (req, res) => {
  const { requestId, behavior, message } = req.body;
  
  const pending = pendingPermissions.get(requestId);
  if (!pending) {
    return res.status(404).json({ error: "权限请求不存在或已超时" });
  }
  
  pendingPermissions.delete(requestId);
  
  if (behavior === 'allow') {
    pending.resolve({ behavior: 'allow', updatedInput: pending.input });
  } else {
    pending.resolve({ behavior: 'deny', message: message || '用户拒绝了此操作' });
  }
  
  res.json({ success: true });
});

// 发送消息并获取流式响应
app.post("/api/chat", async (req, res) => {
  const { sessionId, message, model, systemPrompt, cwd, permissionMode, userId } = req.body;
  
  console.log(`\n[Chat] ========== 新请求 ==========`);
  console.log(`[Chat] SessionId: ${sessionId}`);
  console.log(`[Chat] Model: ${model}`);
  console.log(`[Chat] Message: ${message?.slice(0, 100)}${message?.length > 100 ? '...' : ''}`);
  console.log(`[Chat] UserId: ${userId || 'anonymous'}`);

  if (!message) {
    return res.status(400).json({ error: "消息不能为空" });
  }

  // 获取或创建会话
  let session = sessionId ? db.getSession(sessionId) : null;
  const now = new Date().toISOString();
  
  if (!session) {
    session = db.createSession({
      id: sessionId || uuidv4(),
      title: message.slice(0, 30) + (message.length > 30 ? '...' : ''),
      model: model || defaultModel,
      sdk_session_id: null,
      user_id: userId || null,
      created_at: now,
      updated_at: now
    });
  }

  const selectedModel = model || session.model;
  const sdkSessionId = session.sdk_session_id;
  const userMessageId = uuidv4();
  const assistantMessageId = uuidv4();

  // 保存用户消息到数据库
  try {
    db.createMessage({
      id: userMessageId,
      session_id: session.id,
      role: 'user',
      content: message,
      model: null,
      created_at: now,
      tool_calls: null
    });
  } catch (dbError: any) {
    return res.status(500).json({ error: "保存消息失败", detail: dbError?.message });
  }

  // 记录学习行为：query
  if (userId) {
    try {
      // 简单关键词提取：取消息前20个字符作为关键词
      const keyword = message.slice(0, 20).replace(/[，。？！、；：""''（）\s]/g, '');
      db.createLearningRecord({
        id: uuidv4(),
        user_id: userId,
        session_id: session.id,
        action_type: 'query',
        query_keyword: keyword || null,
        duration_seconds: null,
        metadata: null,
        created_at: now
      });
    } catch (e) {
      console.error('[Chat] 记录学习行为失败:', e);
    }
  }

  // 设置 SSE 头
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // 使用党建知识库 System Prompt
  let effectiveSystemPrompt = systemPrompt || partySystemPrompt;

  // ===== 知识库检索 =====
  try {
    const kbResults = db.searchKnowledgeDocs(message, 3);
    if (kbResults.length > 0) {
      const contexts: string[] = [];
      for (const r of kbResults) {
        const doc = db.getKnowledgeDoc(r.id);
        if (doc) {
          contexts.push(`【${r.title}】\n${doc.content.substring(0, 1500)}`);
        }
      }
      if (contexts.length > 0) {
        effectiveSystemPrompt += `\n\n## 知识库参考资料\n以下是从本地知识库中检索到的相关资料，请优先参考这些内容回答问题：\n\n${contexts.join('\n\n---\n\n')}`;
        console.log(`[Chat] 本地知识库检索到 ${contexts.length} 条结果`);
      }
    }
  } catch (e) {
    console.log('[Chat] 本地知识库检索失败:', e);
  }

  const workingDir = cwd || process.cwd();

  // 判断是否为国产模型
  const chineseModelConfig = getChineseModelConfig(selectedModel);

  res.write(`data: ${JSON.stringify({
    type: "init",
    sessionId: session.id,
    userMessageId,
    assistantMessageId,
    model: selectedModel
  })}\n\n`);

  let fullResponse = "";
  let toolCalls: Array<{
    id: string;
    name: string;
    input?: Record<string, unknown>;
    status: string;
    result?: string;
    isError?: boolean;
  }> = [];

  try {
    if (chineseModelConfig) {
      // ========== 国产模型路径（OpenAI 兼容格式）==========
      console.log(`[Chat] 使用国产模型: ${chineseModelConfig.name} (${chineseModelConfig.provider})`);

      // 构造历史消息（取最近 10 轮）
      const historyMessages = db.getMessagesBySession(session.id);
      const recentMessages = historyMessages.slice(-20); // 最多 20 条
      const apiMessages = recentMessages.map(m => ({
        role: m.role as string,
        content: m.content
      }));

      const startTime = Date.now();
      for await (const chunk of streamChineseModel(chineseModelConfig, apiMessages, effectiveSystemPrompt)) {
        fullResponse += chunk.content;
        res.write(`data: ${JSON.stringify({ type: "text", content: chunk.content })}\n\n`);
      }
      const duration = Date.now() - startTime;

      res.write(`data: ${JSON.stringify({ type: "done", duration, cost: null })}\n\n`);

    } else {
      // ========== CodeBuddy SDK 路径（原有逻辑）==========
      const canUseTool: CanUseTool = async (toolName, input, options) => {
        if (permissionMode === 'bypassPermissions') {
          return { behavior: 'allow', updatedInput: input };
        }

        const requestId = uuidv4();
        const permissionRequest = {
          requestId,
          toolUseId: options.toolUseID,
          toolName,
          input,
          sessionId: session!.id,
          timestamp: Date.now()
        };

        res.write(`data: ${JSON.stringify({
          type: "permission_request",
          ...permissionRequest
        })}\n\n`);

        return new Promise<PermissionResult>((resolve, reject) => {
          const pending: PendingPermission = {
            resolve,
            reject,
            toolName,
            input,
            sessionId: session!.id,
            timestamp: Date.now()
          };

          pendingPermissions.set(requestId, pending);

          setTimeout(() => {
            if (pendingPermissions.has(requestId)) {
              pendingPermissions.delete(requestId);
              resolve({ behavior: 'deny', message: '权限请求超时' });
            }
          }, PERMISSION_TIMEOUT);
        });
      };

      const stream = query({
        prompt: message,
        options: {
          cwd: workingDir,
          model: selectedModel,
          maxTurns: 10,
          systemPrompt: effectiveSystemPrompt,
          permissionMode: permissionMode || 'default',
          canUseTool,
          ...(sdkSessionId ? { resume: sdkSessionId } : {})
        }
      });

      let newSdkSessionId: string | null = null;
      let currentToolId: string | null = null;

      for await (const msg of stream) {
        if (msg.type === "system" && (msg as any).subtype === "init") {
          newSdkSessionId = (msg as any).session_id;
          if (newSdkSessionId && newSdkSessionId !== sdkSessionId) {
            db.updateSession(session.id, { sdk_session_id: newSdkSessionId });
          }
        } else if (msg.type === "assistant") {
          const content = msg.message.content;

          if (typeof content === "string") {
            fullResponse += content;
            res.write(`data: ${JSON.stringify({ type: "text", content })}\n\n`);
          } else if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === "text") {
                fullResponse += block.text;
                res.write(`data: ${JSON.stringify({ type: "text", content: block.text })}\n\n`);
              } else if (block.type === "tool_use") {
                currentToolId = block.id || uuidv4();
                const toolInput = (block as any).input || {};

                const toolCall = {
                  id: currentToolId,
                  name: block.name,
                  input: toolInput,
                  status: "running"
                };
                toolCalls.push(toolCall);
                res.write(`data: ${JSON.stringify({
                  type: "tool",
                  id: toolCall.id,
                  name: toolCall.name,
                  input: toolCall.input,
                  status: toolCall.status
                })}\n\n`);
              }
            }
          }
        } else if (msg.type === "tool_result") {
          const msgAny = msg as any;
          const toolId = msgAny.tool_use_id || currentToolId;
          const isError = msgAny.is_error || false;
          const content = msgAny.content;

          const tool = toolCalls.find(t => t.id === toolId) || toolCalls[toolCalls.length - 1];
          if (tool) {
            tool.status = isError ? "error" : "completed";
            tool.isError = isError;
            tool.result = typeof content === 'string' ? content : JSON.stringify(content);
            res.write(`data: ${JSON.stringify({
              type: "tool_result",
              toolId: tool.id,
              content: tool.result,
              isError: isError
            })}\n\n`);
          }
          currentToolId = null;
        } else if (msg.type === "result") {
          toolCalls.forEach(tool => {
            if (tool.status === "running") {
              tool.status = "completed";
              res.write(`data: ${JSON.stringify({ type: "tool_result", toolId: tool.id, content: tool.result || "已完成" })}\n\n`);
            }
          });
          res.write(`data: ${JSON.stringify({ type: "done", duration: msg.duration, cost: msg.cost })}\n\n`);
        }
      }
    }

    // 保存助手回复
    db.createMessage({
      id: assistantMessageId,
      session_id: session.id,
      role: 'assistant',
      content: fullResponse,
      model: selectedModel,
      created_at: new Date().toISOString(),
      tool_calls: toolCalls.length > 0 ? JSON.stringify(toolCalls) : null
    });

    const messages = db.getMessagesBySession(session.id);
    if (messages.length <= 2) {
      db.updateSession(session.id, { 
        title: message.slice(0, 30) + (message.length > 30 ? '...' : ''),
        model: selectedModel
      });
    }

    console.log(`[Chat] 请求完成 ✓`);
    res.end();
  } catch (error: any) {
    console.error(`[Chat] 错误:`, error?.message);
    const errorMessage = error?.message || "处理请求时发生错误";
    res.write(`data: ${JSON.stringify({ type: "error", message: errorMessage })}\n\n`);
    res.end();
  }
});

// ========== 生产模式：SPA fallback ==========
if (fs.existsSync(distPath)) {
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ============= 启动服务器 =============

app.listen(PORT, async () => {
  // 初始化默认管理员
  await initDefaultAdmin();

  // 显示已配置的国产模型
  const chineseModels = getAvailableChineseModels();
  const chineseModelsInfo = chineseModels.length > 0
    ? `║     国产模型: ${chineseModels.map(m => m.name).join(', ')}`
    : '║     国产模型: 未配置（可在 .env 中添加 API Key）';

  console.log(`
╔════════════════════════════════════════════════╗
║                                                ║
║     ◉ 江开乡振院党建智能体 - 服务器已启动        ║
║                                                ║
║     地址: http://localhost:${PORT}                ║
║     数据库: SQLite (data/chat.db)              ║
║     默认管理员: admin / admin123                ║
${chineseModelsInfo.padEnd(49, ' ')}║
║                                                ║
╚════════════════════════════════════════════════╝
  `);
});
