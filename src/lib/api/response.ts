/**
 * HollowPay — Standard API Response Builders
 *
 * Produces structured, consistent JSON payloads matching the platform API design.
 */

import { NextResponse } from 'next/server';
import { getRequestId } from './request-context';

/**
 * Builds a standard successful API response.
 *
 * @param data - The data object to return
 * @param status - HTTP status code (default: 200)
 * @returns NextResponse
 */
export function apiSuccessResponse<T>(
  data: T,
  status: number = 200
): NextResponse {
  const requestId = getRequestId();
  return NextResponse.json(data, {
    status,
    headers: {
      'HollowPay-Request-Id': requestId,
    },
  });
}

export interface ListResponsePagination {
  hasMore: boolean;
  count: number;
  limit: number;
  startingAfter?: string;
  endingBefore?: string;
}

/**
 * Builds a standard list/paginated API response.
 *
 * @param data - Array of entities
 * @param pagination - Pagination details
 * @returns NextResponse
 */
export function apiListResponse<T>(
  data: T[],
  pagination: ListResponsePagination
): NextResponse {
  const payload = {
    object: 'list',
    data,
    has_more: pagination.hasMore,
    pagination: {
      count: pagination.count,
      limit: pagination.limit,
      starting_after: pagination.startingAfter,
      ending_before: pagination.endingBefore,
    },
  };

  const requestId = getRequestId();
  return NextResponse.json(payload, {
    status: 200,
    headers: {
      'HollowPay-Request-Id': requestId,
    },
  });
}
