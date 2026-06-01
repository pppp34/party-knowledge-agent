import React, { useEffect, useState } from 'react';
import { AdminSidebar } from '../components/AdminSidebar';
import { useAdmin } from '../hooks/useAdmin';
import { Card, Table, Select, DatePicker, Button, Tag, Loading } from 'tdesign-react';
import { SearchIcon } from 'tdesign-icons-react';

const actionTypeLabels: Record<string, string> = {
  session_start: '开始对话',
  session_end: '结束对话',
  query: '查询',
  knowledge_view: '查看知识',
  file_upload: '上传文件'
};

const actionTypeColors: Record<string, string> = {
  session_start: 'success',
  session_end: 'default',
  query: 'primary',
  knowledge_view: 'warning',
  file_upload: 'info'
};

export function AdminLearning() {
  const { learningRecords, learningTotal, fetchLearningRecords, isLoading, users, fetchUsers } = useAdmin();
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [dateRange, setDateRange] = useState<string[]>([]);

  useEffect(() => {
    fetchUsers();
    fetchLearningRecords({ limit: 50 });
  }, [fetchLearningRecords, fetchUsers]);

  const handleSearch = () => {
    fetchLearningRecords({
      userId: selectedUserId || undefined,
      actionType: selectedAction || undefined,
      startDate: dateRange[0] || undefined,
      endDate: dateRange[1] || undefined,
      limit: 50
    });
  };

  const handleReset = () => {
    setSelectedUserId('');
    setSelectedAction('');
    setDateRange([]);
    fetchLearningRecords({ limit: 50 });
  };

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return '-';
    if (seconds < 60) return `${seconds}秒`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}分${seconds % 60}秒`;
    const hours = Math.floor(mins / 60);
    return `${hours}小时${mins % 60}分`;
  };

  const columns = [
    { colKey: 'user_display_name', title: '用户', width: 100, cell: ({ row }: any) => row?.user_display_name || '未知' },
    {
      colKey: 'action_type', title: '行为类型', width: 110,
      cell: ({ row }: any) => (
        <Tag theme={actionTypeColors[row?.action_type] as any} variant="light" size="small">
          {actionTypeLabels[row?.action_type] || row?.action_type}
        </Tag>
      )
    },
    { colKey: 'query_keyword', title: '查询关键词', width: 150, cell: ({ row }: any) => row?.query_keyword || '-' },
    { colKey: 'duration_seconds', title: '时长', width: 100, cell: ({ row }: any) => formatDuration(row?.duration_seconds) },
    { colKey: 'session_id', title: '关联会话', width: 100, cell: ({ row }: any) => row?.session_id ? row.session_id.slice(0, 8) + '...' : '-' },
    { colKey: 'created_at', title: '时间', width: 170, cell: ({ row }: any) => row?.created_at ? new Date(row.created_at).toLocaleString('zh-CN') : '-' },
  ];

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <AdminSidebar />
      <div style={{ flex: 1, padding: 24, overflow: 'auto', backgroundColor: 'var(--td-bg-color-page)' }}>
        <h2 style={{ margin: '0 0 24px', fontSize: 20 }}>学习统计</h2>
        
        {/* 筛选条件 */}
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '0 0 150px' }}>
              <div style={{ fontSize: 12, marginBottom: 4, color: 'var(--td-text-color-secondary)' }}>用户</div>
              <Select
                value={selectedUserId}
                onChange={setSelectedUserId}
                placeholder="全部用户"
                clearable
                options={[
                  { label: '全部用户', value: '' },
                  ...users.map(u => ({ label: u.displayName, value: u.id }))
                ]}
              />
            </div>
            <div style={{ flex: '0 0 150px' }}>
              <div style={{ fontSize: 12, marginBottom: 4, color: 'var(--td-text-color-secondary)' }}>行为类型</div>
              <Select
                value={selectedAction}
                onChange={setSelectedAction}
                placeholder="全部类型"
                clearable
                options={[
                  { label: '全部类型', value: '' },
                  { label: '开始对话', value: 'session_start' },
                  { label: '结束对话', value: 'session_end' },
                  { label: '查询', value: 'query' },
                  { label: '查看知识', value: 'knowledge_view' },
                  { label: '上传文件', value: 'file_upload' }
                ]}
              />
            </div>
            <div style={{ flex: '0 0 280px' }}>
              <div style={{ fontSize: 12, marginBottom: 4, color: 'var(--td-text-color-secondary)' }}>时间范围</div>
              <DatePicker
                mode="date"
                range
                value={dateRange}
                onChange={(val) => setDateRange(val as string[])}
                clearable
                placeholder="选择日期范围"
              />
            </div>
            <Button theme="primary" onClick={handleSearch}>
              <SearchIcon /> 搜索
            </Button>
            <Button variant="outline" onClick={handleReset}>
              重置
            </Button>
          </div>
        </Card>

        {/* 结果表格 */}
        <Card>
          {isLoading ? <Loading /> : (
            <>
              <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--td-text-color-secondary)' }}>
                共 {learningTotal} 条记录
              </div>
              <Table
                data={learningRecords}
                columns={columns}
                size="medium"
                bordered
                hover
                maxHeight={500}
              />
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
