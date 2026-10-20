import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App, { AppRoutes } from './App';

describe('App', () => {
  it('renders the fallback route at an unmatched path', () => {
    render(<App />);
    expect(screen.getByText('Quizicius')).toBeInTheDocument();
  });
});

describe('AppRoutes', () => {
  it('resolves /host/* to the host app', async () => {
    render(
      <MemoryRouter initialEntries={['/host']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('host-app')).toBeInTheDocument());
  });

  it('resolves /projector/:sessionId to the projector app', async () => {
    render(
      <MemoryRouter initialEntries={['/projector/session-123']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('projector-app')).toBeInTheDocument());
  });

  it('resolves /play/:sessionId to the play app', async () => {
    render(
      <MemoryRouter initialEntries={['/play/session-123']}>
        <AppRoutes />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('play-app')).toBeInTheDocument());
  });
});
