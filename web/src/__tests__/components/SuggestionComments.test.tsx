import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/services/api', () => ({
  fetchSuggestionComments: vi.fn(),
  postSuggestionComment: vi.fn(),
  deleteSuggestionComment: vi.fn(),
}));

import * as api from '@/services/api';
import { SuggestionComments } from '@/components/bares/SuggestionComments';
import type { SuggestionCommentWithUser } from '@/types';

const fetchMock = api.fetchSuggestionComments as unknown as ReturnType<typeof vi.fn>;
const postMock = api.postSuggestionComment as unknown as ReturnType<typeof vi.fn>;

const makeComment = (id: string, content: string, userId = 'u1'): SuggestionCommentWithUser => ({
  id,
  suggestionId: 'bar-abc',
  suggestionType: 'bar',
  userId,
  content,
  createdAt: 1000,
  updatedAt: 1000,
  user: { id: userId, displayName: 'Ana Silva', avatarUrl: null },
});

describe('SuggestionComments', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    postMock.mockReset();
  });

  it('renders list of comments when API returns data', async () => {
    fetchMock.mockResolvedValue([makeComment('c1', 'Ótimo bar!'), makeComment('c2', 'Adorei')]);
    render(<SuggestionComments barId="bar-abc" idToken={null} firebaseUid={null} />);
    expect(await screen.findByText('Ótimo bar!')).toBeInTheDocument();
    expect(screen.getByText('Adorei')).toBeInTheDocument();
  });

  it('shows "nenhum comentário ainda" on empty list', async () => {
    fetchMock.mockResolvedValue([]);
    render(<SuggestionComments barId="bar-abc" idToken={null} firebaseUid={null} />);
    expect(await screen.findByText(/nenhum comentário ainda/i)).toBeInTheDocument();
  });

  it('firebaseUid=null: shows "faca login pra comentar"', async () => {
    fetchMock.mockResolvedValue([]);
    render(<SuggestionComments barId="bar-abc" idToken={null} firebaseUid={null} />);
    expect(await screen.findByText(/faca login pra comentar/i)).toBeInTheDocument();
  });

  it('firebaseUid present: textarea and submit button enabled', async () => {
    fetchMock.mockResolvedValue([]);
    render(<SuggestionComments barId="bar-abc" idToken="tok" firebaseUid="uid-1" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(screen.getByPlaceholderText(/escreva um comentário/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /comentar/i })).toBeInTheDocument();
  });

  it('on submit: postSuggestionComment called with correct args', async () => {
    fetchMock.mockResolvedValue([]);
    postMock.mockResolvedValue(undefined);
    render(<SuggestionComments barId="bar-abc" idToken="my-token" firebaseUid="uid-1" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByPlaceholderText(/escreva um comentário/i), {
      target: { value: 'Bom lugar!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /comentar/i }));
    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith('bar-abc', 'Bom lugar!', 'my-token'),
    );
  });
});
