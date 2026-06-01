import React, { useEffect, useState } from 'react';
import { AdminSidebar } from '../components/AdminSidebar';
import { useAdmin } from '../hooks/useAdmin';
import { useAuth } from '../context/AuthContext';
import { Card, Table, Input, Button, DatePicker, Select, Loading, MessagePlugin } from 'tdesign-react';
import { SearchIcon } from 'tdesign-icons-react';

export function AdminConversations() {
  const { conversations, conversationsTotal, fetchConversations, isLoading, users, fetchUsers } = useAdmin();
  const [keyword, setKeyword] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [dateRange, setDateRange] = useState<string[]>([]);

  useEffect(() => {
    fetchUsers();
    fetchConversations({ limit: 50 });
  }, [fetchConversations, fetchUsers]);

  const handleSearch = () => {
    fetchConversations({
      keyword: keyword || undefined,
      userId: selectedUserId || undefined,
      startDate: dateRange[0] || undefined,
      endDate: dateRange[1] || undefined,
      limit: 50
    });
  };

  const handleReset = () => {
    setKeyword('');
    setSelectedUserId('');
    setDateRange([]);
    fetchConversations({ limit: 50 });
  };

  const columns = [
    { colKey: 'user_display_name', title: '用户', width: 100, cell: ({ row }: any) => row?.user_display_name || '匿名' },
    { colKey: 'title', title: '对话标题', ellipsis: true },
    { colKey: 'message_count', title: '消息数', width: 80 },
    { colKey: 'model', title: '模型', width: 130 },
    { colKey: 'created_at', title: '创建时间', width: 170, cell: ({ row }: any) => row?.created_at ? new Date(row.created_at).toLocaleString('zh-CN') : '-' },
  ];

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <AdminSidebar />
      <div style={{ flex: 1, padding: 24, overflow: 'auto', backgroundColor: 'var(--td-bg-color-page)' }}>
        <h2 style={{ margin: '0 0 24px', fontSize: 20 }}>对话查询</h2>
        
        {/* 筛选条件 */}
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '0 0 200px' }}>
              <div style={{ fontSize: 12, marginBottom: 4, color: 'var(--td-text-color-secondary)' }}>关键词</div>
              <Input
                value={keyword}
                onChange={setKeyword}
                placeholder="搜索对话标题"
                clearable
              />
            </div>
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
                共 {conversationsTotal} 条记录
              </div>
              <Table
                data={conversations}
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
