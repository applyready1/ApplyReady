/**
 * layout.js — Root Layout for ApplyReady Landing Page
 * 
 * Next.js App Router layout. Sets global metadata and font.
 * Deployed on Vercel.
 * 
 * Dependencies: globals.css
 */

import './globals.css';

export const metadata = {
  title: 'ApplyReady — Tailor Your Resume to Any Job in Seconds',
  description: 'Free ATS keyword matching. $2.99/month for unlimited tailored resume PDFs.',
  keywords: 'resume, ATS, keyword matching, tailored resume, job application, web app',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
