import React, { useEffect, useState } from 'react';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import EventForm from '@/components/admin/EventForm';
import PhotoUpload from '@/components/admin/PhotoUpload';
import ModerationPanel from '@/components/admin/ModerationPanel';
import ShopPanel from '@/components/admin/ShopPanel';
import UsersPanel from '@/components/admin/UsersPanel';
import NewsletterPanel from '@/components/admin/NewsletterPanel';
import LinkTreePanel from '@/components/admin/LinkTreePanel';
import BannerPanel from '@/components/admin/BannerPanel';
import HelperBox from '@/components/admin/HelperBox';
import { HelperProvider, useHelper } from '@/components/admin/HelperContext';
import { useIdToken } from '@/hooks/useIdToken';
import { auth } from '@/services/firebase';
import {
  deleteEvent as apiDeleteEvent,
  deletePhoto as apiDeletePhoto,
  fetchEvents,
  fetchPhotos,
} from '@/services/api';

/** Get token with fallback to auth.currentUser for race-condition safety. */
async function resolveToken(hookToken: string | null): Promise<string | null> {
  if (hookToken) return hookToken;
  return auth.currentUser ? auth.currentUser.getIdToken() : null;
}
import type { Event, Photo } from '@/types';

export interface AdminPanelProps {
  idToken?: string | null;
}

type Tab = 'guia' | 'events' | 'photos' | 'moderation' | 'lojinha' | 'pix' | 'users' | 'email' | 'linktree' | 'banners';

/**
 * AdminPanel — three-tab admin dashboard:
 *   1. Events: list/create/edit/delete events.
 *   2. Photos: per-event PhotoUpload + photo list with delete.
 *   3. Moderation: embeds the existing ModerationPanel.
 * Tabs implemented inline via common/Button with active styling.
 */
function getHashTab(): Tab {
  const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
  const valid: Tab[] = ['guia', 'events', 'photos', 'moderation', 'lojinha', 'pix', 'users', 'email', 'linktree', 'banners'];
  return valid.includes(hash as Tab) ? (hash as Tab) : 'events';
}

export const AdminPanel: React.FC<AdminPanelProps> = () => {
  return (
    <HelperProvider>
      <AdminPanelInner />
    </HelperProvider>
  );
};

const GuiaTab: React.FC = () => {
  const { helperOn, toggleHelper } = useHelper();
  const [showEmoji, setShowEmoji] = useState(false);

  function handleToggle() {
    toggleHelper();
    setShowEmoji(true);
  }

  return (
    <ZineFrame bg="cream">
      <h2 className="font-display text-2xl text-zine-burntOrange mb-3">Guia do Admin</h2>
      <p className="font-body text-zine-burntOrange/80 mb-4 leading-relaxed">
        Ative o modo guia para ver dicas em todas as abas do painel. Cada seção vai mostrar uma explicação simples do que faz e como usar.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleToggle}
          className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${helperOn ? 'bg-zine-burntOrange' : 'bg-zine-burntOrange/30'}`}
          aria-label={helperOn ? 'Desativar guia' : 'Ativar guia'}
        >
          <span
            className={`inline-block h-6 w-6 rounded-full bg-zine-cream transition-transform ${helperOn ? 'translate-x-7' : 'translate-x-1'}`}
          />
        </button>
        <span className="font-body text-zine-burntOrange font-bold">{helperOn ? 'ON' : 'OFF'}</span>
        {showEmoji && (
          <span
            className="inline-block text-2xl animate-[emoji-pop_0.8s_ease-out_forwards]"
            onAnimationEnd={() => setShowEmoji(false)}
          >
            😊
          </span>
        )}
      </div>
    </ZineFrame>
  );
};

const AdminPanelInner: React.FC = () => {
  const idToken = useIdToken();
  const { helperOn } = useHelper();
  const [tab, setTabState] = useState<Tab>(getHashTab);

  function setTab(t: Tab) {
    setTabState(t);
    window.location.hash = t;
  }

  const otherTabs: { key: Tab; label: string }[] = [
    { key: 'events', label: 'Eventos' },
    { key: 'photos', label: 'Fotos' },
    { key: 'moderation', label: 'Moderação' },
    { key: 'lojinha', label: 'Lojinha' },
    { key: 'pix', label: 'PIX' },
    { key: 'users', label: 'Usuários' },
    { key: 'email', label: 'Email' },
    { key: 'linktree', label: 'Links' },
    { key: 'banners', label: 'Banners' },
  ];

  const guiaButton = (
    <Button
      key="guia"
      role="tab"
      aria-selected={tab === 'guia'}
      onClick={() => setTab('guia')}
      className={tab === 'guia' ? 'ring-4 ring-zine-burntOrange' : ''}
    >
      ❓ Guia
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      <style>{`
        @keyframes emoji-pop {
          0% { transform: scale(0); opacity: 1; }
          50% { transform: scale(1.3); opacity: 1; }
          100% { transform: scale(1); opacity: 0; }
        }
      `}</style>
      <div
        role="tablist"
        aria-label="admin-tabs"
        className="flex flex-wrap gap-1.5 sm:gap-2 [&>button]:px-2.5 [&>button]:py-1.5 [&>button]:text-xs sm:[&>button]:px-5 sm:[&>button]:py-2 sm:[&>button]:text-base"
      >
        {helperOn && guiaButton}
        {otherTabs.map(({ key, label }) => (
          <Button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={tab === key ? 'ring-4 ring-zine-burntOrange' : ''}
          >
            {label}
          </Button>
        ))}
        {!helperOn && guiaButton}
      </div>

      {tab === 'guia' && <GuiaTab />}
      {tab === 'events' && <EventsTab idToken={idToken} />}
      {tab === 'photos' && <PhotosTab idToken={idToken} />}
      {tab === 'moderation' && <ModerationPanel idToken={idToken} />}
      {tab === 'lojinha' && <ShopPanel idToken={idToken} mode="products" />}
      {tab === 'pix' && <ShopPanel idToken={idToken} mode="pix" />}
      {tab === 'users' && <UsersPanel />}
      {tab === 'email' && <NewsletterPanel />}
      {tab === 'linktree' && <LinkTreePanel />}
      {tab === 'banners' && <BannerPanel />}
      {(() => {
        const needles = ['fefe', 'fernanda', 'almeida', 'almi'];
        const name = (auth.currentUser?.displayName ?? '').toLowerCase();
        const username = (auth.currentUser?.providerData?.[0]?.displayName ?? '').toLowerCase();
        const email = (auth.currentUser?.email ?? '').toLowerCase();

        const canShow = needles.some(
          (needle) =>
        name.includes(needle) ||
        username.includes(needle) ||
        email.includes(needle)
        );

        return canShow ? <p>beijos me liga</p> : null;
      })()}
    </div>
  );
};

const EventsTab: React.FC<{ idToken: string | null }> = ({ idToken }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [editing, setEditing] = useState<Event | null>(null);
  const [creating, setCreating] = useState(false);

  async function refresh(): Promise<void> {
    const list = await fetchEvents();
    setEvents(list ?? []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleDelete(id: string): Promise<void> {
    const token = await resolveToken(idToken);
    if (!token) {
      alert('Sessão expirada. Faça login novamente.');
      return;
    }
    try {
      await apiDeleteEvent(id, token);
      await refresh();
    } catch (err) {
      alert(`Erro ao apagar evento: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (creating) {
    return (
      <EventForm
        mode="create"
        idToken={idToken}
        onSaved={async () => {
          setCreating(false);
          await refresh();
        }}
      />
    );
  }

  if (editing) {
    return (
      <EventForm
        mode="edit"
        initial={editing}
        idToken={idToken}
        onSaved={async () => {
          setEditing(null);
          await refresh();
        }}
      />
    );
  }

  return (
    <ZineFrame bg="cream">
      <HelperBox>Aqui você cria e gerencia os eventos do site. Use "Novo evento" para adicionar, ou clique em "editar" e "apagar" nos existentes.</HelperBox>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-2xl text-zine-burntOrange">Eventos</h2>
        <Button onClick={() => setCreating(true)}>Novo evento</Button>
      </div>
      {events.length === 0 ? (
        <p className="font-body italic text-zine-burntOrange/70">
          Sem eventos.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {events.map((e) => (
            <li
              key={e.id}
              data-testid={`event-row-${e.id}`}
              className="flex items-center justify-between gap-3 border-b border-zine-burntOrange/30 pb-2"
            >
              <div className="flex flex-col">
                <span className="font-display text-zine-burntOrange">
                  {e.title}
                </span>
                <span className="font-body text-xs text-zine-burntOrange/70">
                  {e.date} · {e.status}
                </span>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setEditing(e)}>editar</Button>
                <Button onClick={() => void handleDelete(e.id)}>apagar</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </ZineFrame>
  );
};

const PhotosTab: React.FC<{ idToken: string | null }> = ({ idToken }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState<string>('');
  const [photos, setPhotos] = useState<Photo[]>([]);

  useEffect(() => {
    void fetchEvents().then((list) => {
      const arr = list ?? [];
      setEvents(arr);
      if (arr.length > 0 && !eventId) setEventId(arr[0]!.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!eventId) return;
    void fetchPhotos(eventId).then((list) => setPhotos(list ?? []));
  }, [eventId]);

  async function handleDelete(p: Photo): Promise<void> {
    const token = await resolveToken(idToken);
    if (!token) return;
    await apiDeletePhoto(eventId, p.category, p.id, token);
    const fresh = await fetchPhotos(eventId);
    setPhotos(fresh);
  }

  return (
    <div className="flex flex-col gap-4">
      <HelperBox>Selecione um evento e faça upload de fotos para a galeria. Você também pode apagar fotos existentes.</HelperBox>
      <ZineFrame bg="cream">
        <label className="font-body text-zine-burntOrange flex flex-col gap-1">
          <span>Evento</span>
          <select
            aria-label="photos-event-select"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="border-4 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream font-body p-2"
          >
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </label>
      </ZineFrame>

      {eventId && (
        <PhotoUpload
          eventId={eventId}
          idToken={idToken}
          onUploaded={async () => {
            const fresh = await fetchPhotos(eventId);
            setPhotos(fresh);
          }}
        />
      )}

      <ZineFrame bg="cream">
        <h3 className="font-display text-xl text-zine-burntOrange mb-2">
          Fotos atuais
        </h3>
        {photos.length === 0 ? (
          <p className="font-body italic text-zine-burntOrange/70">
            Sem fotos.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {photos.map((p) => (
              <li
                key={p.id}
                data-testid={`photo-row-${p.id}`}
                className="flex items-center justify-between gap-3"
              >
                <span className="font-body text-zine-burntOrange text-sm">
                  {p.category} — {p.id}
                </span>
                <Button onClick={() => void handleDelete(p)}>apagar</Button>
              </li>
            ))}
          </ul>
        )}
      </ZineFrame>
    </div>
  );
};

export default AdminPanel;
