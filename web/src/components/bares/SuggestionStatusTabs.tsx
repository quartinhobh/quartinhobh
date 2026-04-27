import React from 'react';
import Button from '@/components/common/Button';
import type { SuggestionStatus } from '@/types';

export interface SuggestionStatusTabsProps {
  activeStatus: SuggestionStatus;
  onChange: (s: SuggestionStatus) => void;
  counts?: {
    suggested?: number;
    liked?: number;
    disliked?: number;
  };
}

const TABS: { status: SuggestionStatus; label: string }[] = [
  { status: 'suggested', label: 'Sugeridos' },
  { status: 'liked', label: '❤️ Curti' },
  { status: 'disliked', label: '💀 Nao gostei' },
];

const COUNT_KEY: Record<SuggestionStatus, keyof NonNullable<SuggestionStatusTabsProps['counts']>> = {
  suggested: 'suggested',
  liked: 'liked',
  disliked: 'disliked',
};

export const SuggestionStatusTabs: React.FC<SuggestionStatusTabsProps> = ({
  activeStatus,
  onChange,
  counts,
}) => {
  return (
    <div className="flex gap-2 flex-wrap">
      {TABS.map(({ status, label }) => {
        const count = counts?.[COUNT_KEY[status]];
        const displayLabel = count !== undefined ? `${label} (${count})` : label;
        const isActive = activeStatus === status;

        return (
          <Button
            key={status}
            type="button"
            onClick={() => onChange(status)}
            className={isActive ? 'ring-4 ring-zine-burntOrange' : ''}
          >
            {displayLabel}
          </Button>
        );
      })}
    </div>
  );
};

export default SuggestionStatusTabs;
