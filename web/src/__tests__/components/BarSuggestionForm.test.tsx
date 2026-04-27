import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/services/api', () => ({
  createBarSuggestion: vi.fn(),
}));

import * as api from '@/services/api';
import { BarSuggestionForm } from '@/components/bares/BarSuggestionForm';

const createMock = api.createBarSuggestion as unknown as ReturnType<typeof vi.fn>;

function renderForm(props: { idToken?: string | null; onSuccess?: () => void } = {}) {
  return render(
    <MemoryRouter>
      <BarSuggestionForm {...props} />
    </MemoryRouter>,
  );
}

describe('BarSuggestionForm', () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it('renders without idToken (anonymous mode)', () => {
    renderForm({ idToken: null });
    expect(screen.getByLabelText(/nome do bar/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /indicar bar/i })).toBeInTheDocument();
  });

  it('renders with idToken provided', () => {
    renderForm({ idToken: 'tok-123' });
    expect(screen.getByLabelText(/nome do bar/i)).toBeInTheDocument();
  });

  it('"indicar bar" button is present', () => {
    renderForm();
    expect(screen.getByRole('button', { name: /indicar bar/i })).toBeInTheDocument();
  });

  it('does NOT call API when name is empty and shows validation error', async () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: /indicar bar/i }));
    expect(createMock).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText(/nome é obrigatório/i)).toBeInTheDocument();
    });
  });

  it('on submit, createBarSuggestion payload does NOT include knowsOwner', async () => {
    createMock.mockResolvedValue(undefined);
    renderForm({ idToken: 'tok' });
    fireEvent.change(screen.getByLabelText(/nome do bar/i), { target: { value: 'Bar do Zé' } });
    fireEvent.click(screen.getByRole('button', { name: /indicar bar/i }));
    await waitFor(() => expect(createMock).toHaveBeenCalledOnce());
    const [payload] = createMock.mock.calls[0] as [Record<string, unknown>, string];
    expect(payload).not.toHaveProperty('knowsOwner');
    expect(payload.name).toBe('Bar do Zé');
  });

  it('on success: shows "bar indicado com sucesso!"', async () => {
    createMock.mockResolvedValue(undefined);
    renderForm();
    fireEvent.change(screen.getByLabelText(/nome do bar/i), { target: { value: 'Bar Teste' } });
    fireEvent.click(screen.getByRole('button', { name: /indicar bar/i }));
    expect(await screen.findByText(/bar indicado com sucesso!/i)).toBeInTheDocument();
  });

  it('on API error: shows error message', async () => {
    createMock.mockRejectedValue(new Error('servidor indisponível'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderForm();
    fireEvent.change(screen.getByLabelText(/nome do bar/i), { target: { value: 'Bar Erro' } });
    fireEvent.click(screen.getByRole('button', { name: /indicar bar/i }));
    expect(await screen.findByText(/servidor indisponível/i)).toBeInTheDocument();
    errSpy.mockRestore();
  });

  it('submit button disabled during busy state', async () => {
    let resolve!: () => void;
    createMock.mockReturnValue(new Promise<void>((res) => { resolve = res; }));
    renderForm();
    fireEvent.change(screen.getByLabelText(/nome do bar/i), { target: { value: 'Bar Busy' } });
    fireEvent.click(screen.getByRole('button', { name: /indicar bar/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /enviando\.\.\./i })).toBeDisabled(),
    );
    resolve();
  });
});
