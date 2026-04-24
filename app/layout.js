import "./globals.css";

export const metadata = {
  title: "ApplyReady - Resume ATS Match Workspace",
  description: "Paste a job description, analyze your resume match, edit resume sections, and download an ATS-friendly PDF.",
  keywords: "resume, ATS, job description, keyword matching, tailored resume, job application",
  icons: { icon: "/favicon.ico" }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
