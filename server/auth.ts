import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import * as db from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'party-knowledge-agent-secret-key-2026';
const JWT_EXPIRES_IN = '24h';

// ============= 类型 =============

export interface JwtPayload {
  userId: string;
  username: string;
  role: string;
}

export interface AuthenticatedRequest extends Express.Request {
  user?: JwtPayload;
}

// ============= 工具函数 =============

// 密码哈希
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// 验证密码
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// 签发 JWT
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// 验证 JWT
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

// ============= Express 中间件 =============

// JWT 认证中间件
export function authMiddleware(req: AuthenticatedRequest, res: any, next: any) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }
  
  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  
  if (!payload) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
  
  // 检查用户是否仍然活跃
  const user = db.getUserById(payload.userId);
  if (!user || !user.is_active) {
    return res.status(401).json({ error: '用户已被禁用' });
  }
  
  req.user = payload;
  next();
}

// 管理员权限中间件
export function adminMiddleware(req: AuthenticatedRequest, res: any, next: any) {
  if (!req.user || (req.user.role !== 'branch_admin' && req.user.role !== 'system_admin')) {
    return res.status(403).json({ error: '无权限访问管理后台' });
  }
  next();
}

// ============= 初始化默认管理员 =============

export async function initDefaultAdmin(): Promise<void> {
  if (!db.hasAnyUser()) {
    const passwordHash = await hashPassword('admin123');
    db.createUser({
      id: uuidv4(),
      username: 'admin',
      password_hash: passwordHash,
      display_name: '系统管理员',
      role: 'system_admin',
      branch_name: '默认支部',
      created_at: new Date().toISOString(),
      last_login_at: null
    });
    console.log('[Auth] 默认管理员已创建 - 用户名: admin, 密码: admin123');
    console.log('[Auth] ⚠️ 请尽快修改默认密码！');
  }
}
