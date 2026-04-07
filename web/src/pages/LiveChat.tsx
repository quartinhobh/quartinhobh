import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useChat } from '@/hooks/useChat';
import { useModeration } from '@/hooks/useModeration';
import { useSessionStore } from '@/store/sessionStore';
import { auth } from '@/services/firebase';
import { ChatRoom } from '@/components/chat/ChatRoom';
import { ChatInput } from '@/components/chat/ChatInput';

export interface LiveChatProps {
  eventId?: string;
}

export const LiveChat: React.FC<LiveChatProps> = ({ eventId: eventIdProp }) => {
  const params = useParams<{ eventId?: string }>();
  const eventId = eventIdProp ?? params.eventId ?? 'debug-chat';
  const { messages, sendMessage, removeMessage } = useChat(eventId);
  const role = useSessionStore((s) => s.role);
  const canModerate = role === 'admin' || role === 'moderator';

  const [idToken, setIdToken] = useState<string | null>(null);
  useEffect(() => {
    const unsub = auth.onIdTokenChanged(async (user) => {
      if (user) {
        setIdToken(await user.getIdToken());
      } else {
        setIdToken(null);
      }
    });
    return unsub;
  }, []);

  const { deleteMessage, banUser } = useModeration(idToken);

  if (!eventId) {
    return (
      <main className="font-body text-zine-burntOrange p-4">
        no event selected
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-4 p-4">
      <ChatRoom
        messages={messages}
        canModerate={canModerate}
        onDeleteMessage={
          canModerate
            ? (messageId, reason, targetUserId) => {
                removeMessage(messageId);
                void deleteMessage(eventId, messageId, reason, targetUserId);
              }
            : undefined
        }
        onBanUser={
          canModerate
            ? (userId, reason) => banUser(userId, eventId, reason)
            : undefined
        }
      />
      {role === 'guest' ? (
        <p className="font-body text-sm text-zine-burntOrange/60 text-center py-2">
          Faça login para participar do chat.
        </p>
      ) : (
        <ChatInput onSend={sendMessage} />
      )}
    </main>
  );
};

export default LiveChat;
