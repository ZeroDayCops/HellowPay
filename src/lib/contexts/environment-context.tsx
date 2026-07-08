'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Environment = 'test' | 'live';

interface EnvironmentContextType {
  environment: Environment;
  setEnvironment: (env: Environment) => void;
  toggleEnvironment: () => void;
}

const EnvironmentContext = createContext<EnvironmentContextType | undefined>(undefined);

export function EnvironmentProvider({ children }: { children: React.ReactNode }) {
  const [environment, setEnvironmentState] = useState<Environment>('test');

  useEffect(() => {
    // Load persisted preference if available
    const saved = localStorage.getItem('hollowpay_env');
    if (saved === 'test' || saved === 'live') {
      setTimeout(() => {
        setEnvironmentState(saved);
      }, 0);
    }
  }, []);

  const setEnvironment = (env: Environment) => {
    setEnvironmentState(env);
    localStorage.setItem('hollowpay_env', env);
  };

  const toggleEnvironment = () => {
    const next = environment === 'test' ? 'live' : 'test';
    setEnvironment(next);
  };

  return (
    <EnvironmentContext.Provider value={{ environment, setEnvironment, toggleEnvironment }}>
      {children}
    </EnvironmentContext.Provider>
  );
}

export function useEnvironment() {
  const context = useContext(EnvironmentContext);
  if (!context) {
    throw new Error('useEnvironment must be used within an EnvironmentProvider');
  }
  return context;
}
