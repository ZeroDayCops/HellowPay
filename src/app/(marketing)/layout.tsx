import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'HollowPay — Our fee? Hollow.',
  description: 'Payment experiences without the platform fee. Create beautiful payment experiences, integrate with a simple API, and automate what happens around every payment.',
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
