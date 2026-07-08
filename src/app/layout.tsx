import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'HollowPay — Our fee? Hollow.',
    template: '%s | HollowPay',
  },
  description: 'Payment experiences without the platform fee. Create beautiful payment experiences, integrate with a simple API, and automate what happens around every payment.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  openGraph: {
    title: 'HollowPay — Our fee? Hollow.',
    description: 'Payment experiences without the platform fee.',
    siteName: 'HollowPay',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
