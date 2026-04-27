import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { MbSearchResult } from '@/services/api';

vi.mock('@/hooks/useIdToken', () => ({
  useIdToken: vi.fn().mockReturnValue(null),
}));

vi.mock('@/services/api', () => ({
  createAlbumSuggestion: vi.fn(),
}));

const mockMbResults: MbSearchResult[] = [
  {
    id: 'mb-id-001',
    title: 'Rumours',
    artistCredit: 'Fleetwood Mac',
    date: '1977',
    coverUrl: null,
  },
];

vi.mock('@/hooks/useMusicBrainzSearch', () => ({
  useMusicBrainzSearch: vi.fn().mockReturnValue({
    query: '',
    setQuery: vi.fn(),
    results: [],
    searching: false,
    reset: vi.fn(),
  }),
}));

import { useIdToken } from '@/hooks/useIdToken';
import * as api from '@/services/api';
import { useMusicBrainzSearch } from '@/hooks/useMusicBrainzSearch';
import SugerirDisco from '@/pages/SugerirDisco';

const useIdTokenMock = useIdToken as unknown as ReturnType<typeof vi.fn>;
const createAlbumMock = api.createAlbumSuggestion as unknown as ReturnType<typeof vi.fn>;
const useMbSearchMock = useMusicBrainzSearch as unknown as ReturnType<typeof vi.fn>;

describe('SugerirDisco page', () => {
  beforeEach(() => {
    createAlbumMock.mockReset();
    useIdTokenMock.mockReturnValue(null);
    useMbSearchMock.mockReturnValue({
      query: '',
      setQuery: vi.fn(),
      results: [],
      searching: false,
      reset: vi.fn(),
    });
  });

  it('renders MusicBrainz search input', () => {
    render(<SugerirDisco />);
    expect(screen.getByLabelText(/buscar no musicbrainz/i)).toBeInTheDocument();
  });

  it('renders fallback inputs when no MB album selected', () => {
    render(<SugerirDisco />);
    expect(screen.getByLabelText(/link do spotify/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/link do youtube/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/titulo do album/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/artista/i)).toBeInTheDocument();
  });

  it('shows MB results and selecting an album shows preview and hides fallback', async () => {
    const resetMock = vi.fn();
    useMbSearchMock.mockReturnValue({
      query: 'Rumours',
      setQuery: vi.fn(),
      results: mockMbResults,
      searching: false,
      reset: resetMock,
    });

    render(<SugerirDisco />);

    // Results are shown
    expect(screen.getByText('Rumours')).toBeInTheDocument();

    // Click to select
    fireEvent.click(screen.getByText('Rumours'));

    await waitFor(() => {
      expect(screen.queryByLabelText(/link do spotify/i)).not.toBeInTheDocument();
    });

    // Preview visible
    expect(screen.getByText('Fleetwood Mac')).toBeInTheDocument();
    expect(resetMock).toHaveBeenCalled();
  });

  it('"trocar" button clears MB selection and shows search again', async () => {
    const resetMock = vi.fn();
    useMbSearchMock.mockReturnValue({
      query: 'Rumours',
      setQuery: vi.fn(),
      results: mockMbResults,
      searching: false,
      reset: resetMock,
    });

    render(<SugerirDisco />);
    fireEvent.click(screen.getByText('Rumours'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /trocar/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /trocar/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/link do spotify/i)).toBeInTheDocument();
    });
  });

  it('anonymous can submit with spotify link', async () => {
    createAlbumMock.mockResolvedValue({ id: '1', status: 'suggested' });
    render(<SugerirDisco />);

    fireEvent.change(screen.getByLabelText(/link do spotify/i), {
      target: { value: 'https://open.spotify.com/album/abc123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /indicar disco/i }));

    await waitFor(() =>
      expect(createAlbumMock).toHaveBeenCalledWith(
        expect.objectContaining({ spotifyUrl: 'https://open.spotify.com/album/abc123' }),
        null,
      ),
    );
  });

  it('logged-in user submits with idToken', async () => {
    useIdTokenMock.mockReturnValue('user-token');
    createAlbumMock.mockResolvedValue({ id: '1', status: 'suggested' });
    render(<SugerirDisco />);

    fireEvent.change(screen.getByLabelText(/titulo do album/i), {
      target: { value: 'Dark Side of the Moon' },
    });
    fireEvent.click(screen.getByRole('button', { name: /indicar disco/i }));

    await waitFor(() =>
      expect(createAlbumMock).toHaveBeenCalledWith(
        expect.objectContaining({ albumTitle: 'Dark Side of the Moon' }),
        'user-token',
      ),
    );
  });

  it('submit with MB selection sends mbid, albumTitle, artistName', async () => {
    const resetMock = vi.fn();
    useMbSearchMock.mockReturnValue({
      query: 'Rumours',
      setQuery: vi.fn(),
      results: mockMbResults,
      searching: false,
      reset: resetMock,
    });
    createAlbumMock.mockResolvedValue({ id: '1', status: 'suggested' });

    render(<SugerirDisco />);
    fireEvent.click(screen.getByText('Rumours'));

    await waitFor(() => expect(screen.getByRole('button', { name: /trocar/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /indicar disco/i }));

    await waitFor(() =>
      expect(createAlbumMock).toHaveBeenCalledWith(
        expect.objectContaining({
          mbid: 'mb-id-001',
          albumTitle: 'Rumours',
          artistName: 'Fleetwood Mac',
        }),
        null,
      ),
    );
  });

  it('shows validation error and does not call api if nothing is filled', async () => {
    render(<SugerirDisco />);
    fireEvent.click(screen.getByRole('button', { name: /indicar disco/i }));

    await waitFor(() =>
      expect(screen.getByText(/preencha pelo menos uma forma de identificar/i)).toBeInTheDocument(),
    );

    expect(createAlbumMock).not.toHaveBeenCalled();
  });

  it('shows success message after submit', async () => {
    createAlbumMock.mockResolvedValue({ id: '1', status: 'suggested' });
    render(<SugerirDisco />);

    fireEvent.change(screen.getByLabelText(/titulo do album/i), {
      target: { value: 'Some Album' },
    });
    fireEvent.click(screen.getByRole('button', { name: /indicar disco/i }));

    await waitFor(() =>
      expect(screen.getByText(/disco indicado com sucesso/i)).toBeInTheDocument(),
    );
  });
});
