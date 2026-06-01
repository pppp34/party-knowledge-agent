# 党建知识库 Agent Web 应用 - 交付报告

## 项目概述
基于 CodeBuddy Agent SDK 构建的党建知识库 Web 应用，支持党建知识智能问答、党员学习行为记录、上下文对话与后台管理。

## 技术栈
- 前端: React 18 + Vite 5 + TypeScript + TDesign React + Tailwind CSS
- 后端: Express 4 + SSE 流式通信 + CodeBuddy Agent SDK
- 数据库: SQLite (better-sqlite3)
- 认证: JWT (bcryptjs + jsonwebtoken)

## 核心功能

### 1. 党建知识库对话
- 预置党建领域 System Prompt
- 支持多会话管理、上下文对话
- 对话记录 SQLite 持久化

### 2. 党员学习行为记录
- 自动记录：对话次数、查询关键词、学习时长
- 30秒粒度定时上报
- 个人学习档案页（统计、关键词、每日活动）

### 3. 管理后台
- 数据总览看板
- 对话记录查询（按用户/时间/关键词筛选）
- 学习行为统计
- 用户管理（角色/启停）

### 4. 用户认证
- 登录/注册
- JWT Token 24小时过期
- 角色权限：党员 / 支部管理员 / 系统管理员
- 默认管理员: admin / admin123

## 启动方式

```bash
cd party-knowledge-agent
cp .env.example .env
# 编辑 .env 填入 CODEBUDDY_API_KEY
npm run dev
```

- 前端: http://localhost:5173
- 后端: http://localhost:3000

## 文件结构

```
party-knowledge-agent/
├── server/
│   ├── index.ts       # 主服务端（认证/学习/管理路由+党建Prompt）
│   ├── auth.ts        # JWT认证模块
│   ├── admin.ts       # 管理后台API路由
│   └── db.ts          # SQLite数据库（4张表+CRUD）
├── src/
│   ├── App.tsx        # 路由整合+AuthContext
│   ├── context/AuthContext.tsx  # 认证上下文
│   ├── hooks/
│   │   ├── useAuth.ts        # 认证Hook
│   │   ├── useLearning.ts    # 学习行为Hook
│   │   ├── useAdmin.ts       # 管理后台Hook
│   │   ├── useChat.ts        # 对话Hook(已加入userId)
│   │   ├── useSessions.ts    # 会话管理
│   │   ├── useAgents.ts      # Agent配置
│   │   ├── useModels.ts      # 模型选择
│   │   └── useTheme.ts       # 主题切换
│   ├── pages/
│   │   ├── LoginPage.tsx           # 登录页
│   │   ├── ProfilePage.tsx         # 个人学习档案
│   │   ├── AdminDashboard.tsx      # 管理后台-总览
│   │   ├── AdminConversations.tsx  # 管理后台-对话查询
│   │   ├── AdminLearning.tsx       # 管理后台-学习统计
│   │   ├── AdminUsers.tsx          # 管理后台-用户管理
│   │   └── ChatPage.tsx            # 对话页面
│   ├── components/
│   │   ├── LearningTracker.tsx     # 学习追踪条
│   │   ├── UserMenu.tsx           # 用户菜单
│   │   ├── AdminSidebar.tsx       # 管理后台侧边栏
│   │   └── ...（原有组件）
│   ├── types.ts        # 类型定义
│   └── config.ts       # 应用配置
├── docs/
│   ├── PRD.md          # 产品需求文档
│   └── ARCHITECTURE.md # 架构设计文档
└── .env.example        # 环境变量示例
```

## 数据库表结构

| 表名 | 用途 |
|------|------|
| sessions | 对话会话（含 user_id） |
| messages | 对话消息 |
| users | 用户信息（含角色/支部） |
| learning_records | 学习行为记录 |

## API 接口

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | /api/auth/register | 用户注册 | 无 |
| POST | /api/auth/login | 用户登录 | 无 |
| GET | /api/auth/me | 当前用户 | JWT |
| POST | /api/learning/record | 记录学习行为 | JWT |
| GET | /api/learning/my-stats | 个人学习统计 | JWT |
| GET | /api/admin/stats | 总体统计 | Admin JWT |
| GET | /api/admin/conversations | 对话查询 | Admin JWT |
| GET | /api/admin/learning | 学习记录查询 | Admin JWT |
| GET | /api/admin/users | 用户列表 | Admin JWT |
| PATCH | /api/admin/users/:id | 更新用户 | Admin JWT |

## 构建验证
- ✅ Vite 前端构建通过
- ✅ Express 后端启动成功
- ✅ 默认管理员自动创建

## 后续扩展（P1/P2）
- WPS 金山文档API互通
- 知识库文档管理界面
- 学习数据可视化图表
- 知识测验功能
- RAG 向量检索增强
