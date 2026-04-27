import React from 'react';
import { Link } from 'react-router-dom';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import BarFeedbackButtons from '@/components/bares/BarFeedbackButtons';
import type { PublicBarSuggestion, SuggestionStatus } from '@/types';

export interface BarCardProps {
  bar: PublicBarSuggestion;
  idToken: string | null;
  firebaseUid: string | null;
  asDetail?: boolean;
  onMoveStatus?: (id: string, status: SuggestionStatus) => void;
  onDelete?: (id: string) => void;
}

const STATUS_LABELS: SuggestionStatus[] = ['suggested', 'liked', 'disliked'];
const STATUS_DISPLAY: Record<SuggestionStatus, string> = {
  suggested: 'sugerido',
  liked: 'curti',
  disliked: 'nao gostei',
};

export const BarCard: React.FC<BarCardProps> = ({
  bar,
  idToken,
  firebaseUid,
  asDetail = false,
  onMoveStatus,
  onDelete,
}) => {
  const cardContent = (
    <>
      <h3 className="font-display text-lg text-zine-burntOrange dark:text-zine-cream">
        {bar.name}
      </h3>

      {bar.address && (
        <p className="font-body text-sm text-zine-burntOrange/80 dark:text-zine-cream/80 mt-1">
          {bar.address}
        </p>
      )}

      {bar.instagram && (
        <a
          href={
            bar.instagram.startsWith('http')
              ? bar.instagram
              : `https://instagram.com/${bar.instagram.replace(/^@/, '')}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="font-body text-sm text-zine-burntOrange underline hover:text-zine-burntOrange/70 mt-1 inline-block"
          onClick={(e) => e.stopPropagation()}
        >
          @{bar.instagram.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '')}
        </a>
      )}

      <div className="flex gap-2 flex-wrap mt-2">
        {bar.isClosed && (
          <span className="font-body text-xs px-2 py-0.5 border-2 border-zine-burntOrange text-zine-burntOrange rounded-full">
            fechado
          </span>
        )}
        {bar.hasSoundSystem && (
          <span className="font-body text-xs px-2 py-0.5 border-2 border-zine-burntYellow text-zine-burntOrange rounded-full">
            som
          </span>
        )}
      </div>
    </>
  );

  return (
    <ZineFrame bg="cream">
      <div className="flex flex-col gap-3">
        {asDetail ? (
          <div>{cardContent}</div>
        ) : (
          <Link to={`/bar/${bar.id}`} className="block hover:opacity-80 transition-opacity">
            {cardContent}
          </Link>
        )}

        <BarFeedbackButtons barId={bar.id} idToken={idToken} firebaseUid={firebaseUid} />

        {onMoveStatus && (
          <div className="flex gap-2 flex-wrap">
            {STATUS_LABELS.map((status) => (
              <Button
                key={status}
                type="button"
                onClick={() => onMoveStatus(bar.id, status)}
                className="text-xs"
              >
                {STATUS_DISPLAY[status]}
              </Button>
            ))}
          </div>
        )}

        {onDelete && (
          <Button
            type="button"
            onClick={() => onDelete(bar.id)}
            className="text-xs"
          >
            apagar
          </Button>
        )}
      </div>
    </ZineFrame>
  );
};

export default BarCard;
