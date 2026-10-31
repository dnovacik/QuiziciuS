import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '../lib/i18n';
import { Modal } from './Modal';

describe('Modal', () => {
  it('renders into <body>, so a blurred or transformed card it is opened from cannot clip it', () => {
    const { container } = render(
      <I18nProvider>
        <div data-testid="card" className="backdrop-blur-xl">
          <Modal labelledBy="t" onClose={() => {}} testId="dialog">
            <h2 id="t">Title</h2>
          </Modal>
        </div>
      </I18nProvider>,
    );

    const dialog = screen.getByTestId('dialog');
    expect(screen.getByTestId('card')).not.toContainElement(dialog);
    expect(container).not.toContainElement(dialog);
    expect(dialog.parentElement?.parentElement).toBe(document.body);
  });
});
