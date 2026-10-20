import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider } from './lib/i18n';
import { LandingPage } from './LandingPage';

describe('LandingPage navigation', () => {
  beforeEach(() => localStorage.clear());

  function renderLanding() {
    render(<I18nProvider><MemoryRouter><LandingPage /></MemoryRouter></I18nProvider>);
  }

  it('routes host, team and join actions correctly irrespective of translation', () => {
    renderLanding();
    expect(screen.getByTestId('landing-logo')).toHaveAttribute('href', '/');
    expect(screen.getByTestId('landing-host-entry')).toHaveAttribute('href', '/host');
    expect(screen.getByTestId('landing-team-entry')).toHaveAttribute('href', '/team');
    expect(screen.getByTestId('landing-join-quiz')).toHaveAttribute('href', '/play');
    expect(screen.queryByRole('navigation', { name: /main navigation/i })).not.toBeInTheDocument();
  });

  it('persists language selection without relying on translated UI copy', () => {
    renderLanding();
    fireEvent.click(screen.getByTestId('locale-en'));
    expect(screen.getByTestId('locale-en')).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('quizicius:locale')).toBe('en');
    fireEvent.click(screen.getByTestId('locale-sk'));
    expect(screen.getByTestId('locale-sk')).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('quizicius:locale')).toBe('sk');
  });

  it('opens and closes mobile actions without depending on labels', () => {
    renderLanding();
    fireEvent.click(screen.getByTestId('landing-mobile-menu-toggle'));
    expect(screen.getByTestId('landing-mobile-menu')).toBeInTheDocument();
    expect(screen.getByTestId('landing-mobile-menu-toggle')).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByTestId('landing-mobile-menu-toggle'));
    expect(screen.queryByTestId('landing-mobile-menu')).not.toBeInTheDocument();
  });
});
