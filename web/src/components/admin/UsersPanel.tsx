import React, { useEffect, useState } from 'react';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import { useIdToken } from '@/hooks/useIdToken';
import { fetchUsers, updateUserRole } from '@/services/api';
import type { User, UserRole } from '@/types';

const ROLE_LABELS: Record<UserRole, string> = {
  guest: 'Guest',
  user: 'Usuário',
  moderator: 'Moderador',
  admin: 'Admin',
};

const ASSIGNABLE_ROLES: UserRole[] = ['user', 'moderator', 'admin'];

export const UsersPanel: React.FC = () => {
  const idToken = useIdToken();
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState<'all' | 'admin' | 'moderator'>('all');
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    if (!idToken) return;
    const list = await fetchUsers(idToken);
    setUsers(list);
  }

  useEffect(() => {
    void refresh();
  }, [idToken]);

  async function handleRoleChange(userId: string, role: UserRole): Promise<void> {
    if (!idToken) return;
    setBusy(userId);
    try {
      await updateUserRole(userId, role, idToken);
      await refresh();
    } catch (err) {
      alert(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(null);
    }
  }

  const filtered = filter === 'all' ? users : users.filter((u) => u.role === filter);

  return (
    <ZineFrame bg="cream">
      <h2 className="font-display text-2xl text-zine-burntOrange mb-3">Usuários</h2>

      <div className="flex gap-2 mb-4">
        {(['all', 'admin', 'moderator'] as const).map((f) => (
          <Button
            key={f}
            onClick={() => setFilter(f)}
            className={filter === f ? 'ring-4 ring-zine-burntOrange' : ''}
          >
            {f === 'all' ? 'Todos' : f === 'admin' ? 'Admins' : 'Moderadores'}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="font-body italic text-zine-burntOrange/70">Nenhum usuário encontrado.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between gap-3 border-b border-zine-burntOrange/30 pb-2"
            >
              <div className="flex flex-col">
                <span className="font-display text-zine-burntOrange">{u.displayName}</span>
                <span className="font-body text-xs text-zine-burntOrange/70">
                  {u.email ?? 'sem email'} · {ROLE_LABELS[u.role]}
                </span>
              </div>
              <select
                value={u.role}
                disabled={busy === u.id}
                onChange={(e) => void handleRoleChange(u.id, e.target.value as UserRole)}
                className="border-4 border-zine-burntYellow bg-zine-cream text-zine-burntOrange font-body p-1 text-sm"
              >
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}
    </ZineFrame>
  );
};

export default UsersPanel;
