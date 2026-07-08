/**
 * HollowPay — API Request Context
 *
 * Stores and manages request-scoped state (like requestId, environment,
 * tenant credentials, etc.) using AsyncLocalStorage.
 */

import { AsyncLocalStorage } from 'async_hooks';
import { generateRequestId } from '@/lib/crypto/id-generator';

export interface RequestStore {
  requestId: string;
  environment?: 'test' | 'live';
  workspaceId?: number;
  projectId?: number;
  userId?: number;
  actorType?: 'user' | 'system' | 'api';
  actorId?: string; // clerkUserId or apiPrefix
  ipAddress?: string;
  path?: string;
  method?: string;
}

const contextStorage = new AsyncLocalStorage<RequestStore>();

/**
 * Runs a function within a new request context.
 */
export function runInRequestContext<T>(
  initialContext: Partial<RequestStore>,
  fn: () => T
): T {
  const store: RequestStore = {
    requestId: initialContext.requestId ?? generateRequestId(),
    ...initialContext,
  };
  return contextStorage.run(store, fn);
}

/**
 * Retrieves the current request store.
 */
export function getRequestStore(): RequestStore | undefined {
  return contextStorage.getStore();
}

/**
 * Convenience getter for request ID.
 */
export function getRequestId(): string {
  return getRequestStore()?.requestId ?? 'system';
}

/**
 * Convenience getter for current environment.
 */
export function getRequestEnvironment(): 'test' | 'live' {
  return getRequestStore()?.environment ?? 'test';
}
