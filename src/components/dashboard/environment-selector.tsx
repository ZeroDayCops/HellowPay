'use client';

import React from 'react';
import { useEnvironment } from '@/lib/contexts/environment-context';
import styles from './environment-selector.module.css';

export function EnvironmentSelector() {
  const { environment, setEnvironment } = useEnvironment();

  return (
    <div className={styles.container}>
      <button
        type="button"
        className={`${styles.button} ${environment === 'test' ? styles.activeTest : ''}`}
        onClick={() => setEnvironment('test')}
      >
        <span className={styles.dotTest}></span>
        Test Mode
      </button>
      <button
        type="button"
        className={`${styles.button} ${environment === 'live' ? styles.activeLive : ''}`}
        onClick={() => setEnvironment('live')}
      >
        <span className={styles.dotLive}></span>
        Live Mode
      </button>
    </div>
  );
}
