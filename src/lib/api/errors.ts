/**
 * HollowPay — Centralized API Errors
 *
 * Defines standard error classes that serialize to consistent JSON formats.
 * Error response format:
 * {
 *   "error": {
 *     "type": "invalid_request_error",
 *     "message": "The amount must be an integer.",
 *     "code": "parameter_invalid",
 *     "param": "amount_minor"
 *   }
 * }
 */

import { NextResponse } from 'next/server';
import { getRequestId } from './request-context';

export type ErrorType =
  | 'api_error'
  | 'card_error'
  | 'invalid_request_error'
  | 'idempotency_error'
  | 'authentication_error';

export type ErrorCode =
  | 'parameter_missing'
  | 'parameter_invalid'
  | 'resource_missing'
  | 'resource_already_exists'
  | 'authentication_failed'
  | 'permission_denied'
  | 'rate_limit_exceeded'
  | 'idempotency_key_reused'
  | 'state_transition_invalid'
  | 'internal_error';

export class HollowPayError extends Error {
  public readonly type: ErrorType;
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly param?: string;

  constructor(
    message: string,
    options: {
      type?: ErrorType;
      statusCode?: number;
      code: ErrorCode;
      param?: string;
    }
  ) {
    super(message);
    this.name = 'HollowPayError';
    this.type = options.type ?? 'api_error';
    this.statusCode = options.statusCode ?? 500;
    this.code = options.code;
    this.param = options.param;
  }

  public toJSON() {
    return {
      error: {
        type: this.type,
        message: this.message,
        code: this.code,
        param: this.param,
      },
    };
  }
}

// ============================================================
// Concrete Error Classes
// ============================================================

export class BadRequestError extends HollowPayError {
  constructor(message: string, code: ErrorCode = 'parameter_invalid', param?: string) {
    super(message, {
      type: 'invalid_request_error',
      statusCode: 400,
      code,
      param,
    });
  }
}

export class UnauthorizedError extends HollowPayError {
  constructor(message: string = 'Authentication failed.') {
    super(message, {
      type: 'authentication_error',
      statusCode: 401,
      code: 'authentication_failed',
    });
  }
}

export class ForbiddenError extends HollowPayError {
  constructor(message: string = 'You do not have permission to access this resource.') {
    super(message, {
      type: 'invalid_request_error',
      statusCode: 403,
      code: 'permission_denied',
    });
  }
}

export class NotFoundError extends HollowPayError {
  constructor(message: string, param?: string) {
    super(message, {
      type: 'invalid_request_error',
      statusCode: 404,
      code: 'resource_missing',
      param,
    });
  }
}

export class ConflictError extends HollowPayError {
  constructor(message: string, param?: string) {
    super(message, {
      type: 'invalid_request_error',
      statusCode: 409,
      code: 'resource_already_exists',
      param,
    });
  }
}

export class RateLimitError extends HollowPayError {
  constructor(message: string = 'Rate limit exceeded.') {
    super(message, {
      type: 'invalid_request_error',
      statusCode: 429,
      code: 'rate_limit_exceeded',
    });
  }
}

export class IdempotencyError extends HollowPayError {
  constructor(message: string) {
    super(message, {
      type: 'idempotency_error',
      statusCode: 400,
      code: 'idempotency_key_reused',
    });
  }
}

// ============================================================
// Error Formatter / Handler
// ============================================================

export function handleApiError(error: unknown): NextResponse {
  const requestId = getRequestId();
  const headers = {
    'HollowPay-Request-Id': requestId,
  };

  if (error instanceof HollowPayError) {
    return NextResponse.json(error.toJSON(), {
      status: error.statusCode,
      headers,
    });
  }

  // Handle generic / unexpected errors safely without leaking internal server details
  console.error('[API Internal Error] Request:', requestId, 'Error:', error);
  
  return NextResponse.json(
    {
      error: {
        type: 'api_error',
        message: 'An unexpected internal error occurred.',
        code: 'internal_error',
      },
    },
    {
      status: 500,
      headers,
    }
  );
}
