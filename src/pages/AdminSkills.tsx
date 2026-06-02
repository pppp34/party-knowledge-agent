import { useState, useEffect } from 'react';
import { AdminSidebar } from '../components/AdminSidebar';
import { Card, Button, Table, Dialog, Input, Textarea, MessagePlugin, Tag, Popconfirm } from 'tdesign-react';
import { AddIcon, EditIcon, DeleteIcon } from 'tdesign-icons-react';

interface Skill {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  icon: string;
  color: string;
  isBuiltin: boolean;
}

const COLORS = ['#E53935','#1565C0','#2E7D32','#E65100','#6A1B9A','#00838F','#0052d9','#F4511E'];
const ICONS = ['Bot','BookOpen','FileText','Edit','Clock','Users','File','Search','Chat'];

export function AdminSkills() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Skill | null>(null);
  const [form, setForm] = useState({ name: '', description: '', systemPrompt: '', icon: 'Bot', color: '#0052d9' });

  const fetchSkills = () => {
    const token = localStorage.getItem('party_agent_token');
    fetch('/api/skills', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setSkills(d.skills || []));
  };

  useEffect(fetchSkills, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', systemPrompt: '', icon: 'Bot', color: '#0052d9' });
    setOpen(true);
  };

  const openEdit = (s: Skill) => {
    setEditing(s);
    setForm({ name: s.name, description: s.description || '', systemPrompt: s.system_prompt, icon: s.icon, color: s.color });
    setOpen(true);
  };

  const save = () => {
    if (!form.name.trim() || !form.systemPrompt.trim()) { MessagePlugin.warning('名称和 System Prompt 必填'); return; }
    const token = localStorage.getItem('party_agent_token');
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    const body = JSON.stringify(form);
    (editing
      ? fetch(`/api/admin/skills/${editing.id}`, { method: 'PUT', headers, body })
      : fetch('/api/admin/skills', { method: 'POST', headers, body })
    ).then(r => r.json()).then(d => {
      if (d.success) { MessagePlugin.success(editing ? '已更新' : '已创建'); setOpen(false); fetchSkills(); }
      else MessagePlugin.error(d.error || '失败');
    });
  };

  const del = (id: string) => {
    const token = localStorage.getItem('party_agent_token');
    fetch(`/api/admin/skills/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => {
        if (d.success) { MessagePlugin.success('已删除'); fetchSkills(); }
        else MessagePlugin.error(d.error || '失败');
      });
  };

  const columns = [
    { colKey: 'name', title: '名称', width: 140, cell: ({ row }: any) => <span style={{ fontWeight: 600 }}>{row.name}</span> },
    { colKey: 'description', title: '描述', ellipsis: true },
    { colKey: 'isBuiltin', title: '类型', width: 80, cell: ({ row }: any) => row.isBuiltin ? <Tag size="small" theme="primary">内置</Tag> : <Tag size="small" theme="default">自定义</Tag> },
    { colKey: 'actions', title: '操作', width: 100, cell: ({ row }: any) => (
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="text" size="small" icon={<EditIcon />} onClick={() => openEdit(row)}>编辑</Button>
        {!row.isBuiltin && (
          <Popconfirm content="确定删除?" onConfirm={() => del(row.id)}>
            <Button variant="text" size="small" theme="danger" icon={<DeleteIcon />}>删除</Button>
          </Popconfirm>
        )}
      </div>
    )}
  ];

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <AdminSidebar />
      <div style={{ flex: 1, padding: 24, overflow: 'auto', backgroundColor: 'var(--td-bg-color-page)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>技能管理</h2>
          <Button theme="primary" icon={<AddIcon />} onClick={openCreate}>新建技能</Button>
        </div>

        <Card>
          <Table data={skills} columns={columns} size="medium" bordered hover maxHeight={500} empty="暂无技能" />
        </Card>

        <Dialog visible={open} header={editing ? '编辑技能' : '新建技能'} width={600} onClose={() => setOpen(false)}
          footer={<><Button theme="default" onClick={() => setOpen(false)}>取消</Button><Button theme="primary" onClick={save}>保存</Button></>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, marginBottom: 4, display: 'block' }}>名称 *</label>
              <Input value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} placeholder="如：党章解读" />
            </div>
            <div>
              <label style={{ fontSize: 13, marginBottom: 4, display: 'block' }}>描述</label>
              <Input value={form.description} onChange={v => setForm(p => ({ ...p, description: v }))} placeholder="简要描述技能用途" />
            </div>
            <div>
              <label style={{ fontSize: 13, marginBottom: 4, display: 'block' }}>System Prompt *</label>
              <Textarea value={form.systemPrompt} onChange={v => setForm(p => ({ ...p, systemPrompt: v }))} placeholder="定义 AI 的行为和专长..." rows={6} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 13, marginBottom: 4, display: 'block' }}>图标</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {ICONS.map(icon => (
                    <span key={icon} onClick={() => setForm(p => ({ ...p, icon }))} style={{
                      padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12,
                      border: form.icon === icon ? '2px solid var(--td-brand-color)' : '1px solid var(--td-border-level-1-color)',
                      backgroundColor: form.icon === icon ? 'var(--td-brand-color-light)' : 'transparent'
                    }}>{icon}</span>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, marginBottom: 4, display: 'block' }}>颜色</label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {COLORS.map(c => (
                    <span key={c} onClick={() => setForm(p => ({ ...p, color: c }))} style={{
                      width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', backgroundColor: c,
                      border: form.color === c ? '3px solid #fff' : 'none', outline: form.color === c ? '2px solid ' + c : 'none'
                    }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Dialog>
      </div>
    </div>
  );
}
