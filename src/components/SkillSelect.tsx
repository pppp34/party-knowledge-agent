import { useState, useEffect } from 'react';
import { Select, Tag } from 'tdesign-react';

export interface Skill {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  isBuiltin: boolean;
}

interface SkillSelectProps {
  value: string;
  onChange: (skillId: string) => void;
}

export function SkillSelect({ value, onChange }: SkillSelectProps) {
  const [skills, setSkills] = useState<Skill[]>([]);

  useEffect(() => {
    fetch('/api/skills')
      .then(r => r.json())
      .then(d => setSkills(d.skills || []));
  }, []);

  const options = [
    { label: '默认（综合问答）', value: '' },
    ...skills.map(s => ({ label: s.name, value: s.id }))
  ];

  return (
    <Select
      value={value}
      onChange={(v) => onChange(v as string)}
      options={options}
      size="small"
      placeholder="选择技能"
      style={{ minWidth: 120 }}
      popupProps={{ overlayStyle: { maxWidth: 260 } }}
    />
  );
}
