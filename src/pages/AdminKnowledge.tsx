import React, { useEffect, useRef, useState } from 'react';
import { AdminSidebar } from '../components/AdminSidebar';
import { useKnowledge } from '../hooks/useKnowledge';
import { Card, Button, Table, MessagePlugin, Loading, Upload, Dialog, Tag } from 'tdesign-react';
import { DeleteIcon, UploadIcon, SearchIcon } from 'tdesign-icons-react';

export function AdminKnowledge() {
  const { docs, isLoading, fetchDocs, uploadDoc, deleteDoc } = useKnowledge();
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      await uploadDoc(file);
      MessagePlugin.success(`「${file.name}」上传成功`);
    } catch (error: any) {
      MessagePlugin.error(error.message || '上传失败');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string, title: string) => {
    try {
      await deleteDoc(id);
      MessagePlugin.success(`「${title}」已删除`);
    } catch (error: any) {
      MessagePlugin.error(error.message || '删除失败');
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      MessagePlugin.warning('请输入搜索关键词');
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/knowledge/search/all?q=${encodeURIComponent(searchQuery)}&limit=10`);
      const data = await res.json();
      setSearchResults(data.results || []);
      if (data.results?.length === 0) {
        MessagePlugin.info('未找到相关文档');
      }
    } catch (e) {
      MessagePlugin.error('搜索失败');
    } finally {
      setSearching(false);
    }
  };

  const columns = [
    { colKey: 'title', title: '文档名称', ellipsis: true, width: 250 },
    {
      colKey: 'file_type', title: '类型', width: 80,
      cell: ({ row }: any) => (
        <Tag variant="light" size="small" theme={row?.file_type === 'md' ? 'primary' : 'default'}>
          {row?.file_type === 'md' ? 'Markdown' : 'TXT'}
        </Tag>
      )
    },
    {
      colKey: 'content_preview', title: '内容预览', ellipsis: true,
      cell: ({ row }: any) => row?.content_preview || row?.content?.substring(0, 100) || '-'
    },
    {
      colKey: 'created_at', title: '上传时间', width: 170,
      cell: ({ row }: any) => row?.created_at ? new Date(row.created_at).toLocaleString('zh-CN') : '-'
    },
    {
      colKey: 'actions', title: '操作', width: 80,
      cell: ({ row }: any) => (
        <Button
          variant="text"
          theme="danger"
          size="small"
          icon={<DeleteIcon />}
          onClick={() => handleDelete(row?.id, row?.title)}
        >
          删除
        </Button>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <AdminSidebar />
      <div style={{ flex: 1, padding: 24, overflow: 'auto', backgroundColor: 'var(--td-bg-color-page)' }}>
        <h2 style={{ margin: '0 0 24px', fontSize: 20 }}>知识库管理</h2>

        {/* 上传区域 */}
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.markdown"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            <Button
              theme="primary"
              icon={<UploadIcon />}
              loading={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              上传文档
            </Button>
            <span style={{ fontSize: 13, color: 'var(--td-text-color-secondary)' }}>
              支持 TXT、Markdown 格式，最大 10MB
            </span>
          </div>
        </Card>

        {/* 搜索区域 */}
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="搜索知识库..."
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid var(--td-border-level-1-color)',
                borderRadius: 6,
                fontSize: 14,
                backgroundColor: 'var(--td-bg-color-container)',
                color: 'var(--td-text-color-primary)',
                outline: 'none'
              }}
            />
            <Button theme="primary" icon={<SearchIcon />} loading={searching} onClick={handleSearch}>
              搜索
            </Button>
          </div>
          {searchResults.length > 0 && (
            <div style={{ marginTop: 12, padding: 12, backgroundColor: 'var(--td-bg-color-component)', borderRadius: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--td-text-color-primary)' }}>
                搜索结果 ({searchResults.length})
              </div>
              {searchResults.map((r, i) => (
                <div key={i} style={{
                  padding: '8px 0',
                  borderBottom: i < searchResults.length - 1 ? '1px solid var(--td-border-level-1-color)' : 'none'
                }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--td-brand-color)' }}>{r.title}</div>
                  <div
                    style={{ fontSize: 13, color: 'var(--td-text-color-secondary)', marginTop: 4 }}
                    dangerouslySetInnerHTML={{ __html: r.snippet }}
                  />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ima 知识库状态 */}
        <Card style={{ marginBottom: 16, backgroundColor: 'var(--td-brand-color-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 20 }}>📚</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--td-text-color-primary)' }}>
                ima 知识库集成
              </div>
              <div style={{ fontSize: 12, color: 'var(--td-text-color-secondary)', marginTop: 2 }}>
                配置 ima 凭证后，可在对话中自动检索腾讯 ima 知识库内容。
                前往 <a href="https://ima.qq.com/agent-interface" target="_blank" rel="noopener noreferrer">ima.qq.com/agent-interface</a> 获取 Client ID 和 API Key，
                保存到 <code>~/.config/ima/</code> 目录或设置环境变量 <code>IMA_OPENAPI_CLIENTID</code> / <code>IMA_OPENAPI_APIKEY</code>
              </div>
            </div>
          </div>
        </Card>

        {/* 文档列表 */}
        <Card>
          <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--td-text-color-secondary)' }}>
            共 {docs.length} 篇文档
          </div>
          {isLoading ? <Loading /> : (
            <Table
              data={docs}
              columns={columns}
              size="medium"
              bordered
              hover
              maxHeight={500}
              empty="暂无文档，请上传 TXT 或 Markdown 文件"
            />
          )}
        </Card>
      </div>
    </div>
  );
}
