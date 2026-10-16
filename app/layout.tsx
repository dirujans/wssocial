import type { Metadata, Viewport } from 'next';
import { Archivo } from 'next/font/google';
import './globals.css';

// Stand-in for Roc Grotesk (the brand face) until the font files are added to /public/fonts.
// Archivo's width axis gets close to Roc Grotesk Compressed and Condensed.
const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], style: ['normal', 'italic'], variable: '--font-brand', display: 'swap' });

export const metadata: Metadata = { title: 'Wingstop UK&I Social Pulse', robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: '#000000', colorScheme: 'dark' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
