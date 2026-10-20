import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LandingPage } from './LandingPage';

describe('LandingPage', () => {
  it('offers a link to host a quiz and a link to join one', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /host/i })).toHaveAttribute('href', '/host');
    expect(screen.getByRole('link', { name: /join/i })).toHaveAttribute('href', '/play');
  });
});
