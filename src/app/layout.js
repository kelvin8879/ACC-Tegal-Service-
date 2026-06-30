import './globals.css';

export const metadata = {
  title: 'S.W.A.T - Tegal',
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
    <html lang="id" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
