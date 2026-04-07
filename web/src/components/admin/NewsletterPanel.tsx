import React, { useEffect, useState } from 'react';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import { useIdToken } from '@/hooks/useIdToken';
import {
  fetchContactGroups,
  createContactGroup,
  deleteContactGroup,
  sendNewsletter,
  sendSingleEmail,
  fetchCampaigns,
  fetchEmailLimits,
  type ContactGroup,
  type EmailCampaign,
  type EmailLimits,
} from '@/services/api';

const inputClass =
  'font-body px-3 py-2 border-4 border-zine-burntYellow bg-zine-cream text-zine-burntOrange focus:outline-none focus:border-zine-burntOrange w-full';

type Mode = 'newsletter' | 'single' | 'groups' | 'history';

export const NewsletterPanel: React.FC = () => {
  const idToken = useIdToken();
  const [mode, setMode] = useState<Mode>('newsletter');
  const [limits, setLimits] = useState<EmailLimits | null>(null);

  useEffect(() => {
    if (!idToken) return;
    void fetchEmailLimits(idToken).then(setLimits);
  }, [idToken]);

  return (
    <div className="flex flex-col gap-4">
      {limits && (
        <div className="font-body text-sm text-zine-burntOrange/70 bg-zine-cream border-2 border-dashed border-zine-burntYellow rounded px-3 py-2">
          Limite diário (plano grátis): <strong>{limits.remaining}/{limits.dailyLimit}</strong> emails restantes hoje
          &nbsp;·&nbsp;Máx. por grupo: <strong>{limits.maxGroupSize}</strong>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {([
          ['newsletter', 'Newsletter'],
          ['single', 'Email avulso'],
          ['groups', 'Grupos'],
          ['history', 'Histórico'],
        ] as [Mode, string][]).map(([m, label]) => (
          <Button
            key={m}
            onClick={() => setMode(m)}
            className={mode === m ? 'ring-4 ring-zine-burntOrange' : ''}
          >
            {label}
          </Button>
        ))}
      </div>

      {mode === 'newsletter' && <NewsletterForm idToken={idToken} />}
      {mode === 'single' && <SingleEmailForm idToken={idToken} />}
      {mode === 'groups' && <GroupsManager idToken={idToken} />}
      {mode === 'history' && <CampaignHistory idToken={idToken} />}
    </div>
  );
};

// ── Newsletter Form ──────────────────────────────────────────────────

const NewsletterForm: React.FC<{ idToken: string | null }> = ({ idToken }) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [includeGroups, setIncludeGroups] = useState<string[]>([]);
  const [excludeGroups, setExcludeGroups] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!idToken) return;
    void fetchContactGroups(idToken).then(setGroups);
  }, [idToken]);

  function toggleGroup(id: string, list: string[], setList: (v: string[]) => void) {
    setList(list.includes(id) ? list.filter((g) => g !== id) : [...list, id]);
  }

  async function handleSend() {
    if (!idToken || !subject || !body) return;
    setSending(true);
    try {
      const result = await sendNewsletter(
        { subject, html: body, includeGroups, excludeGroups },
        idToken,
      );
      alert(`Enviado para ${result.sentCount} pessoa(s)!`);
      setSubject('');
      setBody('');
    } catch (err) {
      alert(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <ZineFrame bg="cream">
      <h3 className="font-display text-xl text-zine-burntOrange mb-3">Enviar Newsletter</h3>
      <div className="flex flex-col gap-3">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Assunto"
          className={inputClass}
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Conteúdo do email (aceita HTML)"
          rows={8}
          className={inputClass}
        />

        {groups.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="font-body text-sm text-zine-burntOrange font-bold">Incluir grupos:</span>
            <div className="flex flex-wrap gap-2">
              {groups.map((g) => (
                <label key={g.id} className="flex items-center gap-1 font-body text-sm text-zine-burntOrange">
                  <input
                    type="checkbox"
                    checked={includeGroups.includes(g.id)}
                    onChange={() => toggleGroup(g.id, includeGroups, setIncludeGroups)}
                  />
                  {g.name}
                </label>
              ))}
            </div>
            <span className="font-body text-sm text-zine-burntOrange font-bold">Excluir grupos:</span>
            <div className="flex flex-wrap gap-2">
              {groups.map((g) => (
                <label key={g.id} className="flex items-center gap-1 font-body text-sm text-zine-burntOrange">
                  <input
                    type="checkbox"
                    checked={excludeGroups.includes(g.id)}
                    onChange={() => toggleGroup(g.id, excludeGroups, setExcludeGroups)}
                  />
                  {g.name}
                </label>
              ))}
            </div>
          </div>
        )}

        <Button onClick={() => void handleSend()} disabled={sending || !subject || !body}>
          {sending ? 'Enviando...' : 'Enviar Newsletter'}
        </Button>
      </div>
    </ZineFrame>
  );
};

// ── Single Email Form ────────────────────────────────────────────────

const SingleEmailForm: React.FC<{ idToken: string | null }> = ({ idToken }) => {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!idToken || !to || !subject || !body) return;
    setSending(true);
    try {
      await sendSingleEmail({ to, subject, html: body }, idToken);
      alert('Email enviado!');
      setTo('');
      setSubject('');
      setBody('');
    } catch (err) {
      alert(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <ZineFrame bg="cream">
      <h3 className="font-display text-xl text-zine-burntOrange mb-3">Email avulso</h3>
      <div className="flex flex-col gap-3">
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="Destinatário"
          className={inputClass}
        />
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Assunto"
          className={inputClass}
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Conteúdo (aceita HTML)"
          rows={6}
          className={inputClass}
        />
        <Button onClick={() => void handleSend()} disabled={sending || !to || !subject || !body}>
          {sending ? 'Enviando...' : 'Enviar'}
        </Button>
      </div>
    </ZineFrame>
  );
};

// ── Groups Manager ───────────────────────────────────────────────────

const GroupsManager: React.FC<{ idToken: string | null }> = ({ idToken }) => {
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  async function refresh() {
    if (!idToken) return;
    setGroups(await fetchContactGroups(idToken));
  }

  useEffect(() => {
    void refresh();
  }, [idToken]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!idToken || !name) return;
    await createContactGroup(name, desc, idToken);
    setName('');
    setDesc('');
    await refresh();
  }

  async function handleDelete(id: string) {
    if (!idToken) return;
    await deleteContactGroup(id, idToken);
    await refresh();
  }

  return (
    <ZineFrame bg="cream">
      <h3 className="font-display text-xl text-zine-burntOrange mb-3">Grupos de contato</h3>
      <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do grupo"
          required
          className={inputClass}
        />
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Descrição (opcional)"
          className={inputClass}
        />
        <Button type="submit">Criar</Button>
      </form>
      {groups.length === 0 ? (
        <p className="font-body italic text-zine-burntOrange/70">Nenhum grupo.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {groups.map((g) => (
            <li key={g.id} className="flex items-center justify-between border-b border-zine-burntOrange/30 pb-2">
              <div>
                <span className="font-display text-zine-burntOrange">{g.name}</span>
                {g.description && (
                  <span className="font-body text-xs text-zine-burntOrange/70 ml-2">{g.description}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => void handleDelete(g.id)}
                className="text-zine-burntOrange/60 underline text-xs font-body"
              >
                remover
              </button>
            </li>
          ))}
        </ul>
      )}
    </ZineFrame>
  );
};

// ── Campaign History ─────────────────────────────────────────────────

const CampaignHistory: React.FC<{ idToken: string | null }> = ({ idToken }) => {
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);

  useEffect(() => {
    if (!idToken) return;
    void fetchCampaigns(idToken).then(setCampaigns);
  }, [idToken]);

  return (
    <ZineFrame bg="cream">
      <h3 className="font-display text-xl text-zine-burntOrange mb-3">Histórico de envios</h3>
      {campaigns.length === 0 ? (
        <p className="font-body italic text-zine-burntOrange/70">Nenhum envio ainda.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {campaigns.map((c) => (
            <li key={c.id} className="flex items-center justify-between border-b border-zine-burntOrange/30 pb-2">
              <div className="flex flex-col">
                <span className="font-display text-zine-burntOrange">{c.subject}</span>
                <span className="font-body text-xs text-zine-burntOrange/70">
                  {new Date(c.sentAt).toLocaleDateString('pt-BR')} · {c.sentCount} enviado(s)
                </span>
              </div>
              <span className="font-body text-xs text-zine-burntOrange/50">{c.status}</span>
            </li>
          ))}
        </ul>
      )}
    </ZineFrame>
  );
};

export default NewsletterPanel;
