/**
 * layout.js â€” Root Layout for ApplyReady Landing Page
 * 
 * Next.js App Router layout. Sets global metadata and font.
 * Deployed on Vercel.
 * 
 * Dependencies: globals.css
 */

import './globals.css';

export const metadata = {
  title: 'ApplyReady â€“ Tailor Your Resume to Any Job in Seconds',
  description: 'Free ATS keyword matching. One-click tailored resume PDF. Your data never leaves your browser. One-time purchase.',
  keywords: 'resume, ATS, keyword matching, tailored resume, job application, Chrome extension',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
