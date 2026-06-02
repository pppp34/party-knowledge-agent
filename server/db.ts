import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库文件路径
const dbPath = path.join(__dirname, '..', 'data', 'chat.db');

// 确保 data 目录存在
import fs from 'fs';
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 创建数据库连接
const db = new Database(dbPath);

// 启用 WAL 模式以提高性能
db.pragma('journal_mode = WAL');

// 初始化数据库表
db.exec(`
  -- 会话表
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    model TEXT NOT NULL,
    sdk_session_id TEXT,
    user_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- 消息表
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    model TEXT,
    created_at TEXT NOT NULL,
    tool_calls TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  -- 用户表
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('party_member', 'branch_admin', 'system_admin')),
    branch_name TEXT,
    created_at TEXT NOT NULL,
    last_login_at TEXT,
    is_active INTEGER NOT NULL DEFAULT 1
  );

  -- 学习行为记录表
  CREATE TABLE IF NOT EXISTS learning_records (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_id TEXT,
    action_type TEXT NOT NULL CHECK (action_type IN (
      'session_start',
      'session_end',
      'query',
      'knowledge_view',
      'file_upload'
    )),
    query_keyword TEXT,
    duration_seconds INTEGER,
    metadata TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  -- 技能模板表
  CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    system_prompt TEXT NOT NULL,
    icon TEXT DEFAULT 'Bot',
    color TEXT DEFAULT '#0052d9',
    is_builtin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  -- 知识库文档表
  CREATE TABLE IF NOT EXISTS knowledge_docs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    file_type TEXT NOT NULL DEFAULT 'txt',
    uploaded_by TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
  );

  -- 索引
  CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_learning_user_id ON learning_records(user_id);
  CREATE INDEX IF NOT EXISTS idx_learning_created_at ON learning_records(created_at);
  CREATE INDEX IF NOT EXISTS idx_learning_action_type ON learning_records(action_type);
  CREATE INDEX IF NOT EXISTS idx_knowledge_docs_title ON knowledge_docs(title);
`);

// 创建 FTS5 全文索引（独立于 IF NOT EXISTS）
try {
  db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_docs_fts USING fts5(
    title,
    content,
    content='knowledge_docs',
    content_rowid='rowid'
  )`);
} catch (e) {
  console.log("[DB] FTS5 索引已存在或创建失败:", e);
}

// 触发器：保持 FTS5 与 knowledge_docs 同步
try {
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS kd_ai AFTER INSERT ON knowledge_docs BEGIN
      INSERT INTO knowledge_docs_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
    END;
    CREATE TRIGGER IF NOT EXISTS kd_ad AFTER DELETE ON knowledge_docs BEGIN
      INSERT INTO knowledge_docs_fts(knowledge_docs_fts, rowid, title, content) VALUES('delete', old.rowid, old.title, old.content);
    END;
    CREATE TRIGGER IF NOT EXISTS kd_au AFTER UPDATE ON knowledge_docs BEGIN
      INSERT INTO knowledge_docs_fts(knowledge_docs_fts, rowid, title, content) VALUES('delete', old.rowid, old.title, old.content);
      INSERT INTO knowledge_docs_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
    END;
  `);
} catch (e) {
  console.log("[DB] FTS5 触发器创建失败:", e);
}

// 数据库迁移：添加 sdk_session_id 列（如果不存在）
try {
  const tableInfo = db.prepare("PRAGMA table_info(sessions)").all() as Array<{ name: string }>;
  const hasColumn = tableInfo.some(col => col.name === 'sdk_session_id');
  if (!hasColumn) {
    db.exec("ALTER TABLE sessions ADD COLUMN sdk_session_id TEXT");
    console.log("[DB] Added sdk_session_id column to sessions table");
  }
} catch (e) {
  // 忽略错误（列可能已存在）
}

// 数据库迁移：添加 user_id 列（如果不存在）
try {
  const tableInfo = db.prepare("PRAGMA table_info(sessions)").all() as Array<{ name: string }>;
  const hasColumn = tableInfo.some(col => col.name === 'user_id');
  if (!hasColumn) {
    db.exec("ALTER TABLE sessions ADD COLUMN user_id TEXT");
    console.log("[DB] Added user_id column to sessions table");
  }
} catch (e) {
  // 忽略错误
}

// ============= 类型定义 =============

export interface DbSession {
  id: string;
  title: string;
  model: string;
  sdk_session_id: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  model: string | null;
  created_at: string;
  tool_calls: string | null;
}

export interface DbUser {
  id: string;
  username: string;
  password_hash: string;
  display_name: string;
  role: 'party_member' | 'branch_admin' | 'system_admin';
  branch_name: string | null;
  created_at: string;
  last_login_at: string | null;
  is_active: number;
}

export interface DbLearningRecord {
  id: string;
  user_id: string;
  session_id: string | null;
  action_type: 'session_start' | 'session_end' | 'query' | 'knowledge_view' | 'file_upload';
  query_keyword: string | null;
  duration_seconds: number | null;
  metadata: string | null;
  created_at: string;
}

// ============= 会话操作 =============

// 获取所有会话
export function getAllSessions(): DbSession[] {
  const stmt = db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC');
  return stmt.all() as DbSession[];
}

// 获取用户会话
export function getSessionsByUser(userId: string): DbSession[] {
  const stmt = db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY updated_at DESC');
  return stmt.all(userId) as DbSession[];
}

// 获取单个会话
export function getSession(id: string): DbSession | undefined {
  const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
  return stmt.get(id) as DbSession | undefined;
}

// 创建会话
export function createSession(session: DbSession): DbSession {
  const stmt = db.prepare(`
    INSERT INTO sessions (id, title, model, sdk_session_id, user_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(session.id, session.title, session.model, session.sdk_session_id, session.user_id, session.created_at, session.updated_at);
  return session;
}

// 更新会话
export function updateSession(id: string, updates: Partial<Pick<DbSession, 'title' | 'model' | 'sdk_session_id' | 'user_id'>>): boolean {
  const fields: string[] = [];
  const values: any[] = [];
  
  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.model !== undefined) {
    fields.push('model = ?');
    values.push(updates.model);
  }
  if (updates.sdk_session_id !== undefined) {
    fields.push('sdk_session_id = ?');
    values.push(updates.sdk_session_id);
  }
  if (updates.user_id !== undefined) {
    fields.push('user_id = ?');
    values.push(updates.user_id);
  }
  
  if (fields.length === 0) return false;
  
  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);
  
  const stmt = db.prepare(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);
  return result.changes > 0;
}

// 删除会话
export function deleteSession(id: string): boolean {
  const stmt = db.prepare('DELETE FROM sessions WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// ============= 消息操作 =============

// 获取会话的所有消息
export function getMessagesBySession(sessionId: string): DbMessage[] {
  const stmt = db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC');
  return stmt.all(sessionId) as DbMessage[];
}

// 创建消息
export function createMessage(message: DbMessage): DbMessage {
  const stmt = db.prepare(`
    INSERT INTO messages (id, session_id, role, content, model, created_at, tool_calls)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    message.id,
    message.session_id,
    message.role,
    message.content,
    message.model,
    message.created_at,
    message.tool_calls
  );
  
  // 更新会话的 updated_at
  const updateStmt = db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?');
  updateStmt.run(new Date().toISOString(), message.session_id);
  
  return message;
}

// 更新消息内容
export function updateMessage(id: string, updates: Partial<Pick<DbMessage, 'content' | 'tool_calls'>>): boolean {
  const fields: string[] = [];
  const values: any[] = [];
  
  if (updates.content !== undefined) {
    fields.push('content = ?');
    values.push(updates.content);
  }
  if (updates.tool_calls !== undefined) {
    fields.push('tool_calls = ?');
    values.push(updates.tool_calls);
  }
  
  if (fields.length === 0) return false;
  
  values.push(id);
  
  const stmt = db.prepare(`UPDATE messages SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);
  return result.changes > 0;
}

// 删除消息
export function deleteMessage(id: string): boolean {
  const stmt = db.prepare('DELETE FROM messages WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// 批量创建消息（用于保存对话）
export function createMessages(messages: DbMessage[]): void {
  const stmt = db.prepare(`
    INSERT INTO messages (id, session_id, role, content, model, created_at, tool_calls)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertMany = db.transaction((msgs: DbMessage[]) => {
    for (const msg of msgs) {
      stmt.run(msg.id, msg.session_id, msg.role, msg.content, msg.model, msg.created_at, msg.tool_calls);
    }
  });
  
  insertMany(messages);
}

// ============= 用户操作 =============

// 获取用户 by username
export function getUserByUsername(username: string): DbUser | undefined {
  const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
  return stmt.get(username) as DbUser | undefined;
}

// 获取用户 by id
export function getUserById(id: string): DbUser | undefined {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  return stmt.get(id) as DbUser | undefined;
}

// 创建用户
export function createUser(user: Omit<DbUser, 'is_active'> & { is_active?: number }): DbUser {
  const stmt = db.prepare(`
    INSERT INTO users (id, username, password_hash, display_name, role, branch_name, created_at, last_login_at, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    user.id,
    user.username,
    user.password_hash,
    user.display_name,
    user.role,
    user.branch_name,
    user.created_at,
    user.last_login_at,
    user.is_active ?? 1
  );
  return user as DbUser;
}

// 更新用户最后登录时间
export function updateUserLastLogin(id: string): void {
  const stmt = db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?');
  stmt.run(new Date().toISOString(), id);
}

// 更新用户
export function updateUser(id: string, updates: Partial<Pick<DbUser, 'display_name' | 'role' | 'branch_name' | 'is_active'>>): boolean {
  const fields: string[] = [];
  const values: any[] = [];
  
  if (updates.display_name !== undefined) { fields.push('display_name = ?'); values.push(updates.display_name); }
  if (updates.role !== undefined) { fields.push('role = ?'); values.push(updates.role); }
  if (updates.branch_name !== undefined) { fields.push('branch_name = ?'); values.push(updates.branch_name); }
  if (updates.is_active !== undefined) { fields.push('is_active = ?'); values.push(updates.is_active); }
  
  if (fields.length === 0) return false;
  values.push(id);
  
  const stmt = db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);
  return result.changes > 0;
}

// 获取所有用户
export function getAllUsers(): DbUser[] {
  const stmt = db.prepare('SELECT * FROM users ORDER BY created_at DESC');
  return stmt.all() as DbUser[];
}

// 获取活跃用户数
export function getActiveUserCount(sinceDate: string): number {
  const stmt = db.prepare('SELECT COUNT(DISTINCT user_id) as count FROM learning_records WHERE created_at >= ?');
  const result = stmt.get(sinceDate) as any;
  return result?.count || 0;
}

// 检查是否有任何用户
export function hasAnyUser(): boolean {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM users');
  const result = stmt.get() as any;
  return (result?.count || 0) > 0;
}

// ============= 学习记录操作 =============

// 创建学习记录
export function createLearningRecord(record: DbLearningRecord): DbLearningRecord {
  const stmt = db.prepare(`
    INSERT INTO learning_records (id, user_id, session_id, action_type, query_keyword, duration_seconds, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(record.id, record.user_id, record.session_id, record.action_type, record.query_keyword, record.duration_seconds, record.metadata, record.created_at);
  return record;
}

// 获取用户学习记录
export function getLearningRecordsByUser(userId: string, limit: number = 100): DbLearningRecord[] {
  const stmt = db.prepare('SELECT * FROM learning_records WHERE user_id = ? ORDER BY created_at DESC LIMIT ?');
  return stmt.all(userId, limit) as DbLearningRecord[];
}

// 获取用户学习统计
export function getUserLearningStats(userId: string): {
  totalSessions: number;
  totalQueries: number;
  totalDuration: number;
  topKeywords: Array<{ keyword: string; count: number }>;
} {
  // 总查询次数
  const queryCount = db.prepare("SELECT COUNT(*) as count FROM learning_records WHERE user_id = ? AND action_type = 'query'").get(userId) as any;
  
  // 总会话数
  const sessionCount = db.prepare("SELECT COUNT(DISTINCT session_id) as count FROM learning_records WHERE user_id = ? AND action_type = 'session_start'").get(userId) as any;
  
  // 总学习时长（秒）
  const durationResult = db.prepare("SELECT COALESCE(SUM(duration_seconds), 0) as total FROM learning_records WHERE user_id = ? AND action_type = 'session_end'").get(userId) as any;
  
  // 高频关键词 TOP10
  const keywords = db.prepare(`
    SELECT query_keyword as keyword, COUNT(*) as count 
    FROM learning_records 
    WHERE user_id = ? AND action_type = 'query' AND query_keyword IS NOT NULL AND query_keyword != ''
    GROUP BY query_keyword 
    ORDER BY count DESC 
    LIMIT 10
  `).all(userId) as Array<{ keyword: string; count: number }>;
  
  return {
    totalSessions: sessionCount?.count || 0,
    totalQueries: queryCount?.count || 0,
    totalDuration: durationResult?.total || 0,
    topKeywords: keywords || []
  };
}

// 获取每日学习活动（最近30天）
export function getDailyLearningActivity(userId: string, days: number = 30): Array<{
  date: string;
  sessions: number;
  queries: number;
  duration: number;
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const results = db.prepare(`
    SELECT 
      DATE(created_at) as date,
      SUM(CASE WHEN action_type = 'session_start' THEN 1 ELSE 0 END) as sessions,
      SUM(CASE WHEN action_type = 'query' THEN 1 ELSE 0 END) as queries,
      COALESCE(SUM(CASE WHEN action_type = 'session_end' THEN duration_seconds ELSE 0 END), 0) as duration
    FROM learning_records
    WHERE user_id = ? AND created_at >= ?
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `).all(userId, startDate.toISOString()) as any[];
  
  return results || [];
}

// 管理后台：获取全部学习记录（带筛选）
export function getLearningRecordsFiltered(options: {
  userId?: string;
  startDate?: string;
  endDate?: string;
  actionType?: string;
  limit?: number;
  offset?: number;
}): { records: DbLearningRecord[]; total: number } {
  const { userId, startDate, endDate, actionType, limit = 50, offset = 0 } = options;
  
  const conditions: string[] = [];
  const values: any[] = [];
  
  if (userId) { conditions.push('lr.user_id = ?'); values.push(userId); }
  if (startDate) { conditions.push('lr.created_at >= ?'); values.push(startDate); }
  if (endDate) { conditions.push('lr.created_at <= ?'); values.push(endDate + 'T23:59:59'); }
  if (actionType) { conditions.push('lr.action_type = ?'); values.push(actionType); }
  
  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  
  const countResult = db.prepare(`SELECT COUNT(*) as total FROM learning_records lr ${whereClause}`).get(...values) as any;
  const records = db.prepare(`SELECT lr.* FROM learning_records lr ${whereClause} ORDER BY lr.created_at DESC LIMIT ? OFFSET ?`).all(...values, limit, offset) as DbLearningRecord[];
  
  return { records, total: countResult?.total || 0 };
}

// 管理后台：获取对话记录（带筛选，联表查用户名）
export function getConversationsFiltered(options: {
  userId?: string;
  startDate?: string;
  endDate?: string;
  keyword?: string;
  limit?: number;
  offset?: number;
}): { conversations: any[]; total: number } {
  const { userId, startDate, endDate, keyword, limit = 50, offset = 0 } = options;
  
  const conditions: string[] = [];
  const values: any[] = [];
  
  if (userId) { conditions.push('s.user_id = ?'); values.push(userId); }
  if (startDate) { conditions.push('s.created_at >= ?'); values.push(startDate); }
  if (endDate) { conditions.push('s.created_at <= ?'); values.push(endDate + 'T23:59:59'); }
  if (keyword) { conditions.push('s.title LIKE ?'); values.push(`%${keyword}%`); }
  
  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  
  const countResult = db.prepare(`SELECT COUNT(*) as total FROM sessions s ${whereClause}`).get(...values) as any;
  const conversations = db.prepare(`
    SELECT s.*, u.display_name as user_display_name, u.username as user_username,
      (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id) as message_count
    FROM sessions s
    LEFT JOIN users u ON s.user_id = u.id
    ${whereClause}
    ORDER BY s.updated_at DESC
    LIMIT ? OFFSET ?
  `).all(...values, limit, offset) as any[];
  
  return { conversations, total: countResult?.total || 0 };
}

// 管理后台：获取总体统计
export function getAdminStats(): {
  totalConversations: number;
  totalMessages: number;
  totalUsers: number;
  activeUsers7d: number;
  totalLearningHours: number;
} {
  const convCount = db.prepare('SELECT COUNT(*) as count FROM sessions').get() as any;
  const msgCount = db.prepare('SELECT COUNT(*) as count FROM messages').get() as any;
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
  
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const activeUsers = db.prepare('SELECT COUNT(DISTINCT user_id) as count FROM learning_records WHERE created_at >= ?').get(sevenDaysAgo.toISOString()) as any;
  
  const totalDuration = db.prepare("SELECT COALESCE(SUM(duration_seconds), 0) as total FROM learning_records WHERE action_type = 'session_end'").get() as any;
  
  return {
    totalConversations: convCount?.count || 0,
    totalMessages: msgCount?.count || 0,
    totalUsers: userCount?.count || 0,
    activeUsers7d: activeUsers?.count || 0,
    totalLearningHours: Math.round((totalDuration?.total || 0) / 3600 * 10) / 10
  };
}

// ============= 知识库文档操作 =============

export interface DbKnowledgeDoc {
  id: string;
  title: string;
  content: string;
  file_type: string;
  uploaded_by: string | null;
  created_at: string;
}

// 创建知识文档
export function createKnowledgeDoc(doc: DbKnowledgeDoc): DbKnowledgeDoc {
  const stmt = db.prepare(`
    INSERT INTO knowledge_docs (id, title, content, file_type, uploaded_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(doc.id, doc.title, doc.content, doc.file_type, doc.uploaded_by, doc.created_at);
  return doc;
}

// 获取所有知识文档
export function getAllKnowledgeDocs(): DbKnowledgeDoc[] {
  const stmt = db.prepare('SELECT id, title, file_type, uploaded_by, created_at, substr(content, 1, 200) as content_preview FROM knowledge_docs ORDER BY created_at DESC');
  return stmt.all() as DbKnowledgeDoc[];
}

// 获取单个知识文档
export function getKnowledgeDoc(id: string): DbKnowledgeDoc | undefined {
  const stmt = db.prepare('SELECT * FROM knowledge_docs WHERE id = ?');
  return stmt.get(id) as DbKnowledgeDoc | undefined;
}

// 删除知识文档
export function deleteKnowledgeDoc(id: string): boolean {
  const stmt = db.prepare('DELETE FROM knowledge_docs WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// FTS5 全文搜索
export function searchKnowledgeDocs(query: string, limit: number = 5): Array<{
  id: string;
  title: string;
  snippet: string;
  rank: number;
}> {
  const stmt = db.prepare(`
    SELECT kd.id, kd.title, snippet(knowledge_docs_fts, 2, '<b>', '</b>', '...', 40) as snippet, 
           rank
    FROM knowledge_docs_fts
    JOIN knowledge_docs kd ON kd.rowid = knowledge_docs_fts.rowid
    WHERE knowledge_docs_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `);
  try {
    // 对用户查询做转义，防止 FTS5 语法错误
    const escapedQuery = query.replace(/[&|!()"':*^~-]/g, ' ').trim().split(/\s+/).join(' ');
    const results = stmt.all(escapedQuery, limit) as any[];
    return results.map((r: any) => ({
      id: r.id,
      title: r.title,
      snippet: r.snippet,
      rank: r.rank
    }));
  } catch {
    return [];
  }
}

// 获取知识库文档总数
export function getKnowledgeDocCount(): number {
  const result = db.prepare('SELECT COUNT(*) as count FROM knowledge_docs').get() as any;
  return result?.count || 0;
}

// ============= 技能模板操作 =============

export interface DbSkill {
  id: string;
  name: string;
  description: string | null;
  system_prompt: string;
  icon: string;
  color: string;
  is_builtin: number;
  created_at: string;
}

// 获取所有技能
export function getAllSkills(): DbSkill[] {
  return db.prepare('SELECT * FROM skills ORDER BY is_builtin DESC, created_at DESC').all() as DbSkill[];
}

// 获取单个技能
export function getSkill(id: string): DbSkill | undefined {
  return db.prepare('SELECT * FROM skills WHERE id = ?').get(id) as DbSkill | undefined;
}

// 创建技能
export function createSkill(skill: DbSkill): DbSkill {
  db.prepare('INSERT INTO skills (id, name, description, system_prompt, icon, color, is_builtin, created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(skill.id, skill.name, skill.description, skill.system_prompt, skill.icon, skill.color, skill.is_builtin, skill.created_at);
  return skill;
}

// 更新技能
export function updateSkill(id: string, updates: Partial<Pick<DbSkill, 'name'|'description'|'system_prompt'|'icon'|'color'>>): boolean {
  const fields: string[] = []; const values: any[] = [];
  if (updates.name !== undefined) { fields.push('name=?'); values.push(updates.name); }
  if (updates.description !== undefined) { fields.push('description=?'); values.push(updates.description); }
  if (updates.system_prompt !== undefined) { fields.push('system_prompt=?'); values.push(updates.system_prompt); }
  if (updates.icon !== undefined) { fields.push('icon=?'); values.push(updates.icon); }
  if (updates.color !== undefined) { fields.push('color=?'); values.push(updates.color); }
  if (fields.length===0) return false;
  values.push(id);
  return db.prepare(`UPDATE skills SET ${fields.join(',')} WHERE id=?`).run(...values).changes>0;
}

// 删除技能（仅非内置）
export function deleteSkill(id: string): boolean {
  const skill = getSkill(id);
  if (skill?.is_builtin) return false;
  return db.prepare('DELETE FROM skills WHERE id=? AND is_builtin=0').run(id).changes>0;
}

// 初始化预设技能（仅在无技能时）
export function initPresetSkills(): void {
  const count = (db.prepare('SELECT COUNT(*) as c FROM skills').get() as any)?.c || 0;
  if (count > 0) return;

  const now = new Date().toISOString();
  const presets: DbSkill[] = [
    { id: 'skill-constitution', name: '党章解读', description: '专注党章党规的解读与分析', system_prompt: '你是党建知识专家，专精于《中国共产党章程》的解读。回答应引用党章原文条款，结合党的最新精神进行分析，语言准确庄重。', icon: 'BookOpen', color: '#E53935', is_builtin: 1, created_at: now },
    { id: 'skill-policy', name: '政策分析', description: '分析党的方针政策与时政要点', system_prompt: '你是党建政策研究专家。请深入分析党的各项方针政策，解读其背景、意义和实施要点。引用权威文件，结合基层实践案例进行说明。', icon: 'FileText', color: '#1565C0', is_builtin: 1, created_at: now },
    { id: 'skill-news', name: '新闻稿撰写', description: '撰写党建相关工作新闻稿', system_prompt: '你是党建新闻稿撰写专家。请按照"标题—导语—主体—结尾"的规范结构撰写党建工作新闻稿。语言生动凝练、正面积极，突出工作亮点和实际成效。', icon: 'Edit', color: '#2E7D32', is_builtin: 1, created_at: now },
    { id: 'skill-history', name: '党史学习', description: '学习党的历史与优良传统', system_prompt: '你是党史教育专家。请以党的重大历史事件为主线，用通俗易懂又不失严肃的语言讲述党史，引导党员从历史中汲取智慧和力量。', icon: 'Clock', color: '#E65100', is_builtin: 1, created_at: now },
    { id: 'skill-organization', name: '组织生活', description: '指导三会一课等组织生活制度', system_prompt: '你是基层党组织建设专家。请详细解答关于"三会一课"、组织生活会、民主评议党员等制度的规范要求，提供可操作的具体方案和模板。', icon: 'Users', color: '#6A1B9A', is_builtin: 1, created_at: now },
    { id: 'skill-report', name: '工作报告', description: '撰写党建工作汇报与总结', system_prompt: '你是党务公文写作专家。请按照规范的公文格式撰写工作总结、思想汇报、述职报告等。结构完整、数据翔实、语言庄重。', icon: 'File', color: '#00838F', is_builtin: 1, created_at: now },
  ];

  const insert = db.prepare('INSERT INTO skills (id,name,description,system_prompt,icon,color,is_builtin,created_at) VALUES (?,?,?,?,?,?,?,?)');
  db.transaction(() => { for (const s of presets) insert.run(s.id, s.name, s.description, s.system_prompt, s.icon, s.color, s.is_builtin, s.created_at); })();
  console.log('[DB] 已初始化 6 个预设技能模板');
}

// 清空所有数据
export function clearAllData(): void {
  db.exec('DELETE FROM messages');
  db.exec('DELETE FROM sessions');
  db.exec('DELETE FROM learning_records');
  db.exec('DELETE FROM knowledge_docs');
  db.exec('DELETE FROM users');
}

export default db;
