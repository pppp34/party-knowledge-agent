import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import * as db from './db.js';
import { authMiddleware } from './auth.js';

const router = Router();

// multer 配置：内存存储，最大 10MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['text/plain', 'text/markdown', 'text/x-markdown', 'application/octet-stream'];
    const ext = file.originalname.toLowerCase();
    if (ext.endsWith('.txt') || ext.endsWith('.md') || ext.endsWith('.markdown') || allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 TXT 和 Markdown 文件'));
    }
  }
});

// 中间件：需要认证
router.use(authMiddleware as any);

// ========== 上传知识文档 ==========
router.post('/upload', upload.single('file'), (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: '请选择文件' });
    }

    const content = file.buffer.toString('utf-8');
    if (!content.trim()) {
      return res.status(400).json({ error: '文件内容为空' });
    }

    const title = req.body.title || file.originalname;
    const fileType = file.originalname.endsWith('.md') ? 'md' : 'txt';
    const userId = (req as any).user?.userId || null;

    const doc: db.DbKnowledgeDoc = {
      id: uuidv4(),
      title,
      content,
      file_type: fileType,
      uploaded_by: userId,
      created_at: new Date().toISOString()
    };

    db.createKnowledgeDoc(doc);

    res.json({ success: true, doc: { id: doc.id, title: doc.title, file_type: doc.file_type, created_at: doc.created_at } });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '上传失败' });
  }
});

// ========== 获取知识文档列表 ==========
router.get('/list', (_req: Request, res: Response) => {
  try {
    const docs = db.getAllKnowledgeDocs();
    res.json({ docs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== 获取单个文档内容 ==========
router.get('/:id', (req: Request, res: Response) => {
  try {
    const doc = db.getKnowledgeDoc(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: '文档不存在' });
    }
    res.json({ doc });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== 删除知识文档 ==========
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const ok = db.deleteKnowledgeDoc(req.params.id);
    if (!ok) {
      return res.status(404).json({ error: '文档不存在' });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== 全文搜索知识库 ==========
router.get('/search/all', (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query || !query.trim()) {
      return res.json({ results: [] });
    }

    const limit = parseInt(req.query.limit as string) || 5;
    const results = db.searchKnowledgeDocs(query.trim(), limit);
    res.json({ results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== 对话中检索知识 ==========
// 供聊天流程使用，接受 query，返回拼接好的上下文字符串
router.post('/retrieve', (req: Request, res: Response) => {
  try {
    const { query, limit = 3 } = req.body;
    if (!query) {
      return res.json({ context: '' });
    }
    const results = db.searchKnowledgeDocs(query, limit);
    if (results.length === 0) {
      return res.json({ context: '', results: [] });
    }

    // 获取完整内容
    const contexts: string[] = [];
    for (const r of results) {
      const doc = db.getKnowledgeDoc(r.id);
      if (doc) {
        contexts.push(doc.content.substring(0, 2000));
      }
    }

    const context = contexts.length > 0
      ? `\n\n【知识库参考资料】\n${contexts.map((c, i) => `[${i + 1}] ${c}`).join('\n\n')}`
      : '';

    res.json({ context, results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
