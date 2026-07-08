/**
 * HollowPay — Customer Management Service
 *
 * Resolves existing customers by public ID or email,
 * and handles new customer creation with environment-appropriate IDs.
 */

import { db } from '@/lib/db';
import { customers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateEnvironmentId } from '@/lib/crypto/id-generator';

export interface CustomerPayload {
  name: string;
  email: string;
  phone: string;
  merchantCustomerId?: string;
}

/**
 * Resolves a customer ID (internal serial id) by publicId or email payload.
 * If details are passed and customer does not exist, a new customer record is created.
 *
 * @param projectId - Project context ID
 * @param environment - active environment (test or live)
 * @param input - Customer public ID or details object
 * @returns The database internal serial ID of the customer
 */
export async function getOrCreateCustomer(
  projectId: number,
  environment: 'test' | 'live',
  input: CustomerPayload | string
): Promise<number> {
  if (typeof input === 'string') {
    const results = await db
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(
          eq(customers.projectId, projectId),
          eq(customers.publicId, input)
        )
      )
      .limit(1);

    if (results.length === 0) {
      throw new Error(`Customer with ID "${input}" not found in this project.`);
    }
    return results[0].id;
  }

  // Validate required payload properties
  if (!input.email || !input.name || !input.phone) {
    throw new Error('Customer name, email, and phone are required to create a customer.');
  }

  // Look up by email (unique per project)
  const existing = await db
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.projectId, projectId),
        eq(customers.email, input.email)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    const customer = existing[0];
    
    // Update customer details if they have changed
    const needsUpdate =
      customer.name !== input.name ||
      customer.phone !== input.phone ||
      (input.merchantCustomerId && customer.merchantCustomerId !== input.merchantCustomerId);

    if (needsUpdate) {
      await db
        .update(customers)
        .set({
          name: input.name,
          phone: input.phone,
          merchantCustomerId: input.merchantCustomerId ?? customer.merchantCustomerId,
          updatedAt: new Date(),
        })
        .where(eq(customers.id, customer.id));
    }
    return customer.id;
  }

  // Create new customer
  const publicId = generateEnvironmentId('customer', environment);
  const [newCustomer] = await db
    .insert(customers)
    .values({
      publicId,
      projectId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      merchantCustomerId: input.merchantCustomerId ?? null,
    })
    .returning();

  return newCustomer.id;
}
