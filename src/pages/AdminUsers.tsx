import React, { useEffect } from 'react';
import { AdminSidebar } from '../components/AdminSidebar';
import { useAdmin } from '../hooks/useAdmin';
import { Card, Table, Tag, Switch, Select, MessagePlugin, Loading } from 'tdesign-react';

const roleLabels: Record<string, string> = {
  party_member: '党员',
  branch_admin: '支部管理员',
  system_admin: '系统管理员'
};

const roleColors: Record<string, string> = {
  party_member: 'default',
  branch_admin: 'warning',
  system_admin: 'danger'
};

export function AdminUsers() {
  const { users, fetchUsers, updateUser, isLoading } = useAdmin();

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    try {
      await updateUser(userId, { isActive: !isActive } as any);
      MessagePlugin.success(isActive ? '已禁用用户' : '已启用用户');
      fetchUsers();
    } catch (error: any) {
      MessagePlugin.error(error.message || '操作失败');
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateUser(userId, { role: newRole as any } as any);
      MessagePlugin.success('角色已更新');
      fetchUsers();
    } catch (error: any) {
      MessagePlugin.error(error.message || '操作失败');
    }
  };

  const columns = [
    { colKey: 'displayName', title: '显示名称', width: 120 },
    { colKey: 'username', title: '用户名', width: 120 },
    {
      colKey: 'role', title: '角色', width: 140,
      cell: ({ row }: any) => (
        <Select
          value={row?.role}
          onChange={(val) => handleRoleChange(row?.id, val as string)}
          size="small"
          style={{ width: 120 }}
          options={[
            { label: '党员', value: 'party_member' },
            { label: '支部管理员', value: 'branch_admin' },
            { label: '系统管理员', value: 'system_admin' }
          ]}
        />
      )
    },
    { colKey: 'branchName', title: '所属支部', width: 120, cell: ({ row }: any) => row?.branchName || '-' },
    {
      colKey: 'isActive', title: '状态', width: 80,
      cell: ({ row }: any) => (
        <Switch
          size="small"
          value={row?.isActive}
          onChange={() => handleToggleActive(row?.id, row?.isActive)}
        />
      )
    },
    {
      colKey: 'lastLoginAt', title: '最后登录', width: 170,
      cell: ({ row }: any) => row?.lastLoginAt ? new Date(row.lastLoginAt).toLocaleString('zh-CN') : '从未登录'
    },
    {
      colKey: 'createdAt', title: '注册时间', width: 170,
      cell: ({ row }: any) => row?.createdAt ? new Date(row.createdAt).toLocaleString('zh-CN') : '-'
    }
  ];

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <AdminSidebar />
      <div style={{ flex: 1, padding: 24, overflow: 'auto', backgroundColor: 'var(--td-bg-color-page)' }}>
        <h2 style={{ margin: '0 0 24px', fontSize: 20 }}>用户管理</h2>
        
        <Card>
          {isLoading ? <Loading /> : (
            <>
              <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--td-text-color-secondary)' }}>
                共 {users.length} 个用户
              </div>
              <Table
                data={users}
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
