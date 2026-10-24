/** What a result certificate says, already in the viewer's language. */
export interface CertificateText {
  heading: string;
  teamName: string;
  /** e.g. "2nd place of 14 teams". */
  placeLine: string;
  /** e.g. "62 points". */
  scoreLine: string;
  /** Quiz title, pub and date, each on its own line when present. */
  details: string[];
  fileName: string;
}

// A4 landscape at 150 dpi.
const WIDTH = 1754;
const HEIGHT = 1240;

/** Shrinks the font until `text` fits `maxWidth`. */
function fitText(context: CanvasRenderingContext2D, text: string, weight: string, size: number, family: string, maxWidth: number) {
  let current = size;
  context.font = `${weight} ${current}px ${family}`;
  while (context.measureText(text).width > maxWidth && current > 24) {
    current -= 4;
    context.font = `${weight} ${current}px ${family}`;
  }
}

/**
 * Draws the certificate on a canvas with the page's own font, so any language's letters show,
 * and returns it as a PNG data URL.
 */
export async function drawCertificate(text: CertificateText): Promise<string> {
  await document.fonts?.ready;
  const family = getComputedStyle(document.body).fontFamily || 'sans-serif';
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available');

  const background = context.createLinearGradient(0, 0, WIDTH, HEIGHT);
  background.addColorStop(0, '#1d1238');
  background.addColorStop(1, '#0d0a18');
  context.fillStyle = background;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.strokeStyle = '#ffb95f';
  context.lineWidth = 10;
  context.strokeRect(50, 50, WIDTH - 100, HEIGHT - 100);
  context.strokeStyle = 'rgba(255, 185, 95, 0.35)';
  context.lineWidth = 3;
  context.strokeRect(80, 80, WIDTH - 160, HEIGHT - 160);

  context.textAlign = 'center';
  context.textBaseline = 'alphabetic';
  const center = WIDTH / 2;
  const maxWidth = WIDTH - 300;

  context.fillStyle = '#cdb8ff';
  context.font = `800 64px ${family}`;
  context.fillText('QuiziciuS', center, 230);

  context.fillStyle = '#ffb95f';
  context.font = `700 44px ${family}`;
  context.fillText(text.heading.toUpperCase(), center, 320);

  context.fillStyle = '#ffffff';
  fitText(context, text.teamName, '800', 128, family, maxWidth);
  context.fillText(text.teamName, center, 520);

  context.fillStyle = '#4edea3';
  context.font = `700 72px ${family}`;
  context.fillText(text.placeLine, center, 660);

  context.fillStyle = '#ffb95f';
  context.font = `700 56px ${family}`;
  context.fillText(text.scoreLine, center, 760);

  context.fillStyle = '#c9c4d6';
  text.details.forEach((line, index) => {
    fitText(context, line, '500', 40, family, maxWidth);
    context.fillText(line, center, 900 + index * 58);
  });

  return canvas.toDataURL('image/png');
}

/** Draws the certificate and downloads it as an A4 landscape PDF. */
export async function downloadCertificate(text: CertificateText): Promise<void> {
  const [image, { jsPDF }] = await Promise.all([drawCertificate(text), import('jspdf')]);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  pdf.addImage(image, 'PNG', 0, 0, 297, 210);
  pdf.save(text.fileName);
}
