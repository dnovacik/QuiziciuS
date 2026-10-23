import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { MediaRefDto } from '@quizicius/shared-types';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../lib/i18n';
import { MediaSlot } from './MediaSlot';

function Harness({ initial = null, onChange }: { initial?: MediaRefDto | null; onChange: (ref: MediaRefDto | null) => void }) {
  const [value, setValue] = useState<MediaRefDto | null>(initial);
  return (
    <I18nProvider>
      <MediaSlot
        slot="question"
        value={value}
        previewUrl={null}
        busy={false}
        onUpload={vi.fn()}
        onChange={(ref) => {
          setValue(ref);
          onChange(ref);
        }}
      />
    </I18nProvider>
  );
}

function pasteLink(url: string) {
  fireEvent.click(screen.getByTestId('media-slot-question-link'));
  fireEvent.change(screen.getByTestId('media-slot-question-link-input'), { target: { value: url } });
  fireEvent.click(screen.getByTestId('media-slot-question-link-add'));
}

describe('MediaSlot', () => {
  it('recognises a pasted YouTube link', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    pasteLink('https://youtu.be/dQw4w9WgXcQ?t=42');

    expect(onChange).toHaveBeenLastCalledWith({ kind: 'youtube', source: 'link', url: 'https://youtu.be/dQw4w9WgXcQ?t=42' });
    expect(screen.getByTestId('media-slot-question-kind')).toHaveTextContent('YouTube');
  });

  it('takes a direct link to an mp3 as audio', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    pasteLink('https://cdn.example/song.mp3');

    expect(onChange).toHaveBeenLastCalledWith({ kind: 'audio', source: 'link', url: 'https://cdn.example/song.mp3' });
  });

  it('asks what a link of unknown type is', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    pasteLink('https://cdn.example/stream');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('media-slot-question-kind-audio'));

    expect(onChange).toHaveBeenLastCalledWith({ kind: 'audio', source: 'link', url: 'https://cdn.example/stream' });
  });

  it('refuses a link that is not https', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    pasteLink('http://cdn.example/song.mp3');

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('media-slot-question-error')).toBeInTheDocument();
  });

  it('saves the selected part from a start (m:ss) and a length (s)', () => {
    const onChange = vi.fn();
    render(<Harness initial={{ kind: 'audio', source: 'link', url: 'https://cdn.example/song.mp3' }} onChange={onChange} />);

    fireEvent.change(screen.getByTestId('media-slot-question-start'), { target: { value: '1:20' } });
    fireEvent.change(screen.getByTestId('media-slot-question-length'), { target: { value: '15' } });

    expect(onChange).toHaveBeenLastCalledWith({
      kind: 'audio',
      source: 'link',
      url: 'https://cdn.example/song.mp3',
      startSeconds: 80,
      durationSeconds: 15,
    });
    expect(screen.getByTestId('media-slot-question-part')).toHaveTextContent('1:20 – 1:35');
  });

  it('clears the start when its field is emptied, and ignores a time it cannot read', () => {
    const onChange = vi.fn();
    render(<Harness initial={{ kind: 'audio', source: 'link', url: 'https://x.example/a.mp3', startSeconds: 80 }} onChange={onChange} />);

    fireEvent.change(screen.getByTestId('media-slot-question-start'), { target: { value: '1:7x' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId('media-slot-question-start'), { target: { value: '' } });

    expect(onChange).toHaveBeenLastCalledWith({ kind: 'audio', source: 'link', url: 'https://x.example/a.mp3' });
  });

  it('offers no part for an image', () => {
    render(<Harness initial={{ kind: 'image', source: 'link', url: 'https://cdn.example/a.png' }} onChange={vi.fn()} />);

    expect(screen.queryByTestId('media-slot-question-start')).not.toBeInTheDocument();
  });

  it('empties the slot on remove', () => {
    const onChange = vi.fn();
    render(<Harness initial={{ kind: 'audio', source: 'link', url: 'https://cdn.example/song.mp3' }} onChange={onChange} />);

    fireEvent.click(screen.getByTestId('media-slot-question-remove'));

    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByTestId('media-slot-question-upload')).toBeInTheDocument();
  });
});
