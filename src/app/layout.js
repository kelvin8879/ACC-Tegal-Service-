import './globals.css';

export const metadata = {
  title: 'ACC Prospect Tracker',
  description: 'Mobile-friendly prospect pipeline tracking system for Officers and Coordinators',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        {children}
      </body>
    </html>
  );
}
