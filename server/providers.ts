/**
 * 多模型提供商支持
 * 支持 DeepSeek、阿里通义千问(Qwen)、腾讯混元、字节豆包等国产模型
 * 通过 OpenAI 兼容格式 API 调用
 */

export interface ChineseModel {
  modelId: string;
  name: string;
  provider: string;
  apiUrl: string;
  apiKeyEnv: string;
  description?: string;
}

// 国产模型配置列表
export const CHINESE_MODELS: ChineseModel[] = [
  // DeepSeek
  {
    modelId: "deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    provider: "deepseek",
    apiUrl: "https://api.deepseek.com/v1/chat/completions",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    description: "深度求索 V4 专业版模型"
  },
  {
    modelId: "deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    provider: "deepseek",
    apiUrl: "https://api.deepseek.com/v1/chat/completions",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    description: "深度求索 V4 轻量版模型"
  },
  // 阿里通义千问 (DashScope)
  {
    modelId: "qwen-max",
    name: "通义千问 Max",
    provider: "dashscope",
    apiUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    apiKeyEnv: "DASHSCOPE_API_KEY",
    description: "阿里通义千问最强模型"
  },
  {
    modelId: "qwen-plus",
    name: "通义千问 Plus",
    provider: "dashscope",
    apiUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    apiKeyEnv: "DASHSCOPE_API_KEY",
    description: "阿里通义千问平衡模型"
  },
  {
    modelId: "qwen-turbo",
    name: "通义千问 Turbo",
    provider: "dashscope",
    apiUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    apiKeyEnv: "DASHSCOPE_API_KEY",
    description: "阿里通义千问快速模型"
  },
  // 腾讯混元
  {
    modelId: "hunyuan-large",
    name: "腾讯混元 Large",
    provider: "hunyuan",
    apiUrl: "https://hunyuan.tencentcloudapi.com/v1/chat/completions",
    apiKeyEnv: "HUNYUAN_API_KEY",
    description: "腾讯混元大模型"
  },
  // 字节豆包 (Volcengine)
  {
    modelId: "doubao-pro-256k",
    name: "豆包 Pro",
    provider: "volcengine",
    apiUrl: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
    apiKeyEnv: "VOLCENGINE_API_KEY",
    description: "字节豆包专业版"
  },
  // 智谱 GLM
  {
    modelId: "glm-4",
    name: "智谱 GLM-4",
    provider: "zhipu",
    apiUrl: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    apiKeyEnv: "ZHIPU_API_KEY",
    description: "智谱 AI 大模型"
  }
];

// 获取已配置（有 API Key）的国产模型
export function getAvailableChineseModels(): ChineseModel[] {
  return CHINESE_MODELS.filter(m => {
    const key = process.env[m.apiKeyEnv];
    return key && key.trim().length > 0;
  });
}

// 判断是否为国产模型
export function isChineseModel(modelId: string): boolean {
  return CHINESE_MODELS.some(m => m.modelId === modelId);
}

// 获取模型配置
export function getChineseModelConfig(modelId: string): ChineseModel | undefined {
  return CHINESE_MODELS.find(m => m.modelId === modelId);
}

// 调用国产模型（OpenAI 兼容格式）
export async function* streamChineseModel(
  modelConfig: ChineseModel,
  messages: Array<{ role: string; content: string }>,
  systemPrompt?: string
) {
  const apiKey = process.env[modelConfig.apiKeyEnv];
  if (!apiKey) {
    throw new Error(`未配置 ${modelConfig.apiKeyEnv} 环境变量`);
  }

  const bodyMessages = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...messages]
    : messages;

  const response = await fetch(modelConfig.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelConfig.modelId,
      messages: bodyMessages,
      stream: true,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API 错误 (${response.status}): ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("无法读取响应流");
  }

  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") return;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.content) {
            yield { type: "text" as const, content: delta.content };
          }
          if (parsed.choices?.[0]?.finish_reason) {
            return;
          }
        } catch {
          // 忽略解析失败的行
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
