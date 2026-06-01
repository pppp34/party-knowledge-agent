import { useState, useEffect, useCallback } from 'react';
import { Model } from '../types';

const STORAGE_KEY = 'defaultModel';

export function useModels() {
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch('/api/models');
      const data = await res.json();
      const modelList: Model[] = data.models || [];
      setModels(modelList);

      if (modelList.length > 0) {
        const savedModel = localStorage.getItem(STORAGE_KEY);
        // 只有缓存的模型在当前列表中才使用，否则用服务端默认值
        const modelExists = savedModel && modelList.some(m => m.modelId === savedModel);
        const modelToUse = modelExists
          ? savedModel!
          : (data.defaultModel || modelList[0].modelId);
        setSelectedModel(modelToUse);
        localStorage.setItem(STORAGE_KEY, modelToUse);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  return {
    models,
    selectedModel,
    setSelectedModel,
    fetchModels,
  };
}
