'use client';

import React from 'react';
import { useEnvironment } from '@/lib/contexts/environment-context';

export function DynamicEnvironmentBadge() {
  const { environment } = useEnvironment();

  if (environment === 'live') {
    return <span className="badge badge-live">LIVE MODE</span>;
  }

  return <span className="badge badge-test">TEST MODE</span>;
}
