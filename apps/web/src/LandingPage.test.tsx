import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider } from './lib/i18n';
import { LandingPage } from './LandingPage';

describe('LandingPage', () => {
  beforeEach(() => localStorage.clear());
  it('offers Slovak host and join links by default', () => {
    render(<I18nProvider><MemoryRouter><LandingPage /></MemoryRouter></I18nProvider>);
    expect(screen.getByRole('link', { name: 'Organizovať kvíz' })).toHaveAttribute('href', '/host');
    expect(screen.getByRole('link', { name: /Pripojiť sa ku kvízu/ })).toHaveAttribute('href', '/play');
    expect(screen.getByRole('heading', { name: 'Jedna platforma. Tri spôsoby, ako zažiť kvíz.' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Ilustrácia pub kvízu/ })).toHaveAttribute('src', '/quiz-hero.svg');
  });
  it('switches to English and saves the preference', () => {
    render(<I18nProvider><MemoryRouter><LandingPage /></MemoryRouter></I18nProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: 'Host a quiz' })).toHaveAttribute('href', '/host');
    expect(screen.getByRole('link', { name: /Join a quiz/ })).toHaveAttribute('href', '/play');
    expect(localStorage.getItem('quizicius:locale')).toBe('en');
    fireEvent.click(screen.getByRole('button', { name: 'Slovenčina' }));
    expect(screen.getByRole('link', { name: 'Organizovať kvíz' })).toBeInTheDocument();
  });
});
