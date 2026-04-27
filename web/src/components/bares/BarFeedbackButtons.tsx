import React from 'react';
import Button from '@/components/common/Button';
import { useBarFeedback } from '@/hooks/useBarFeedback';

export interface BarFeedbackButtonsProps {
  barId: string;
  idToken: string | null;
  firebaseUid: string | null;
}

export const BarFeedbackButtons: React.FC<BarFeedbackButtonsProps> = ({
  barId,
  idToken,
  firebaseUid,
}) => {
  const {
    likedCount,
    dislikedCount,
    userVote,
    handleVote,
    handleRemoveVote,
    error,
  } = useBarFeedback(barId, idToken, firebaseUid);

  const isAnonymous = !firebaseUid;

  const handleLikeClick = async () => {
    if (isAnonymous) return;
    if (userVote === 'liked') {
      await handleRemoveVote();
    } else {
      await handleVote('liked');
    }
  };

  const handleDislikeClick = async () => {
    if (isAnonymous) return;
    if (userVote === 'disliked') {
      await handleRemoveVote();
    } else {
      await handleVote('disliked');
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3 items-center">
        <Button
          type="button"
          disabled={isAnonymous}
          onClick={() => void handleLikeClick()}
          className={
            userVote === 'liked'
              ? 'ring-4 ring-zine-burntOrange'
              : ''
          }
          title={isAnonymous ? 'faca login pra votar' : undefined}
        >
          ❤️ curti ({likedCount})
        </Button>

        <Button
          type="button"
          disabled={isAnonymous}
          onClick={() => void handleDislikeClick()}
          className={
            userVote === 'disliked'
              ? 'ring-4 ring-zine-burntOrange'
              : ''
          }
          title={isAnonymous ? 'faca login pra votar' : undefined}
        >
          💀 nao gostei ({dislikedCount})
        </Button>

        {isAnonymous && (
          <span className="font-body text-xs text-zine-burntOrange/70">
            faca login pra votar
          </span>
        )}
      </div>

      {error && (
        <p className="font-body text-xs text-red-500">{error}</p>
      )}
    </div>
  );
};

export default BarFeedbackButtons;
