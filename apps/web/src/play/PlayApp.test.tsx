import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import PlayApp from './PlayApp';

vi.mock('../lib/api-client', () => ({ apiGet: vi.fn(), apiPost: vi.fn() }));
vi.mock('../lib/supabase-client', () => ({ subscribeToSession: vi.fn(() => vi.fn()) }));

describe('PlayApp', () => {
  it('shows the join screen when no team is stored for this session', () => {
    render(
      <MemoryRouter initialEntries={['/play/s1']}>
        <Routes>
          <Route path="/play/:sessionId" element={<PlayApp />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Join the quiz' })).toBeInTheDocument();
  });
});
