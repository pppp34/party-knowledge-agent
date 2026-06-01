import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { authMiddleware } from './auth.js';

const router = Router();

const IMA_BASE = 'https://ima.qq.com';

// 获取 ima 凭证
function getImaCredentials(): { clientId: string; apiKey: string } | null {
  if (process.env.IMA_OPENAPI_CLIENTID && process.env.IMA_OPENAPI_APIKEY) {
    return {
      clientId: process.env.IMA_OPENAPI_CLIENTID,
      apiKey: process.env.IMA_OPENAPI_APIKEY
    };
  }
  const clientIdPath = path.join(os.homedir(), '.config', 'ima', 'client_id');
  const apiKeyPath = path.join(os.homedir(), '.config', 'ima', 'api_key');
  try {
    if (fs.existsSync(clientIdPath) && fs.existsSync(apiKeyPath)) {
      return {
        clientId: fs.readFileSync(clientIdPath, 'utf-8').trim(),
        apiKey: fs.readFileSync(apiKeyPath, 'utf-8').trim()
      };
    }
  } catch { /* ignore */ }
  return null;
}

// 直接调用 ima API
export async function callImaApi(apiPath: string, body: Record<string, any>): Promise<any> {
  const creds = getImaCredentials();
  if (!creds) {
    throw new Error('IMA 凭证未配置');
  }

  const url = `${IMA_BASE}/${apiPath}`;
  const payload = JSON.stringify(body);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ima-openapi-clientid': creds.clientId,
      'ima-openapi-apikey': creds.apiKey,
      'ima-openapi-ctx': 'skill_version=1.0.0'
    },
    body: payload,
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`IMA API ${response.status}: ${text.substring(0, 200)}`);
  }

  const data = await response.json();
  if (data.code !== 0) {
    throw new Error(data.msg || `IMA API error code ${data.code}`);
  }
  return data;
}

// 中间件
router.use(authMiddleware as any);

// ========== 获取用户的 ima 知识库列表 ==========
router.get('/kb/list', async (_req: Request, res: Response) => {
  try {
    const result = await callImaApi('openapi/wiki/v1/search_knowledge_base', {
      query: '',
      cursor: '',
      limit: 20
    });
    const kbList = result?.data?.info_list || [];
    res.json({
      knowledgeBases: kbList.map((kb: any) => ({
        id: kb.kb_id || kb.id || '',
        name: kb.kb_name || kb.name || '',
        description: kb.description || ''
      }))
    });
  } catch (error: any) {
    if (error.message === 'IMA 凭证未配置') {
      return res.json({ knowledgeBases: [], configured: false });
    }
    res.json({ knowledgeBases: [], configured: true, error: error.message });
  }
});

// ========== 在指定知识库中搜索 ==========
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q, kb_id } = req.query;
    if (!q || !kb_id) {
      return res.json({ results: [] });
    }

    const result = await callImaApi('openapi/wiki/v1/search_knowledge', {
      query: q as string,
      knowledge_base_id: kb_id as string,
      cursor: ''
    });

    const items = result?.data?.info_list || [];
    res.json({
      results: items.slice(0, 5).map((item: any) => ({
        title: item.title || '',
        snippet: item.highlight_content || item.snippet || item.title || '',
        media_id: item.media_id || ''
      }))
    });
  } catch (error: any) {
    res.json({ results: [], error: error.message });
  }
});

export default router;
