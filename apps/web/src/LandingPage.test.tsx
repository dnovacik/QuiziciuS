import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider } from './lib/i18n';
import { LandingPage } from './LandingPage';

describe('Gemini landing layout', () => {
  beforeEach(() => localStorage.clear());
  function renderLanding() {
    render(<I18nProvider><MemoryRouter><LandingPage /></MemoryRouter></I18nProvider>);
  }
  it('renders main calls to action connected to supported routes', () => {
    renderLanding();
    expect(screen.getAllByRole('link', { name: /Pripojiť sa ku kvízu/ })[0]).toHaveAttribute('href', '/play');
    expect(screen.getAllByRole('link', { name: 'Pre hostiteľov' })[0]).toHaveAttribute('href', '/host');
    expect(screen.getAllByRole('link', { name: 'Pre tímy' })[0]).toHaveAttribute('href', '/team');
    expect(screen.getByRole('heading', { name: /Jedna platforma/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Vytvoriť tím' })).not.toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Hlavná navigácia' });
    expect(nav.querySelectorAll('a')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Ukážka kvízu' })).toHaveAttribute('aria-current', 'location');
    expect(screen.getByRole('link', { name: 'Pre koho' })).toHaveAttribute('href', '#pre-koho');
  });
  it('changes language with the flags and persists it', () => {
    renderLanding();
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('link', { name: /Join a quiz/ })[0]).toHaveAttribute('href', '/play');
    expect(localStorage.getItem('quizicius:locale')).toBe('en');
    fireEvent.click(screen.getByRole('button', { name: 'Slovenčina' }));
    expect(screen.getAllByRole('link', { name: /Pripojiť sa ku kvízu/ })[0]).toBeInTheDocument();
  });
  it('allows mobile navigation to open and close', () => {
    renderLanding();
    fireEvent.click(screen.getByRole('button', { name: 'Otvoriť menu' }));
    expect(screen.getByRole('button', { name: 'Zavrieť menu' })).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Zavrieť menu' }));
    expect(screen.getByRole('button', { name: 'Otvoriť menu' })).toHaveAttribute('aria-expanded', 'false');
  });
});
