import type { Metadata } from 'next';
import './tokens.css';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Instituto Santa Escolástica', template: '%s · Instituto Santa Escolástica' },
  description: 'Sistema de gestão escolar do Instituto Santa Escolástica',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="light">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Playfair+Display:wght@600;700&family=Montserrat:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
