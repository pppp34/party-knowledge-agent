import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

export interface KnowledgeDoc {
  id: string;
  title: string;
  file_type: string;
  content_preview?: string;
  created_at: string;
}

export function useKnowledge() {
  const { token } = useAuth();
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchDocs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/knowledge/list', { headers });
      const data = await res.json();
      setDocs(data.docs || []);
    } catch (e) {
      console.error('获取知识文档列表失败:', e);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const uploadDoc = useCallback(async (file: File, title?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);

    const res = await fetch('/api/knowledge/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '上传失败');
    await fetchDocs();
    return data;
  }, [token, fetchDocs]);

  const deleteDoc = useCallback(async (id: string) => {
    const res = await fetch(`/api/knowledge/${id}`, {
      method: 'DELETE',
      headers
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '删除失败');
    await fetchDocs();
    return data;
  }, [token, fetchDocs]);

  return { docs, isLoading, fetchDocs, uploadDoc, deleteDoc };
}
