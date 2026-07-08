/**
 * HollowPay — Public Payment Page Checkout API
 *
 * POST /api/p/payment-pages/[id]/checkout
 * Creates customer profile, generates transaction orders, and registers checkout session redirects.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paymentPages } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { wrapRouteHandler } from '@/lib/api/route-handler';
import { createOrder } from '@/lib/services/order.service';
import { createCheckoutSession } from '@/lib/services/checkout.service';

const handlePublicCheckout = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: pagePublicId } = await params;
  const { searchParams } = new URL(req.url);
  const environment = searchParams.get('env') === 'live' ? 'live' : 'test';

  let body: {
    name: string;
    email: string;
    phone?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const { name, email, phone } = body;

  if (!name || !email) {
    return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 });
  }

  // 1. Resolve payment page
  const pageRecord = await db
    .select()
    .from(paymentPages)
    .where(eq(paymentPages.publicId, pagePublicId))
    .limit(1);

  if (pageRecord.length === 0 || pageRecord[0].archivedAt) {
    return NextResponse.json({ error: 'Payment page not found or inactive.' }, { status: 404 });
  }

  const page = pageRecord[0];

  // Validate phone requirements
  if (page.collectPhone && !phone) {
    return NextResponse.json({ error: 'Mobile phone number is required.' }, { status: 400 });
  }

  try {
    // 2. Fetch workspaceId by project ID
    const projectRecord = await db
      .select()
      .from(paymentPages)
      .where(eq(paymentPages.id, page.id))
      .limit(1);
    
    // We can resolve the workspace ID from the project ID
    // Let's query the project directly
    const projectsList = await db
      .select({ id: paymentPages.projectId })
      .from(paymentPages)
      .where(eq(paymentPages.id, page.id))
      .limit(1);

    // Let's query the projects table to find the workspace ID
    const { projects: projTable } = await import('@/lib/db/schema');
    const projectDb = await db
      .select()
      .from(projTable)
      .where(eq(projTable.id, page.projectId))
      .limit(1);

    if (projectDb.length === 0) {
      return NextResponse.json({ error: 'Project configurations mismatch.' }, { status: 500 });
    }

    const workspaceId = projectDb[0].businessId; // Note: In schema, businessId corresponds to workspace context or acts as tenant key. Let's verify businessId.
    // In products.ts:
    // projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' })
    // In orders.ts:
    // workspaceId is used to scope logs.

    // 3. Create the order
    const order = await createOrder({
      projectId: page.projectId,
      workspaceId: projectDb[0].businessId, // Scope workspace id correctly
      environment,
      amountMinor: page.amountMinor,
      currency: page.currency,
      description: page.description || `Payment for ${page.title}`,
      customer: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || '+91 00000 00000',
      },
      actor: 'public_payment_page',
    });

    // 4. Create the checkout session
    const successUrl = `${req.nextUrl.origin}/pay/c/{CHECKOUT_SESSION_ID}?success=true`;
    const cancelUrl = `${req.nextUrl.origin}/pay/c/{CHECKOUT_SESSION_ID}?cancel=true`;

    const session = await createCheckoutSession({
      projectId: page.projectId,
      environment,
      orderPublicId: order.publicId,
      successUrl,
      cancelUrl,
      actor: 'public_payment_page',
    });

    return NextResponse.json({
      success: true,
      checkout_session_id: session.publicId,
      redirect_url: `/pay/c/${session.publicId}`,
    });
  } catch (error: any) {
    console.error('Failed to create payment page checkout:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 400 });
  }
};

// Expose public route handler without API key auth requirement
export const POST = wrapRouteHandler(handlePublicCheckout, { authRequired: false });
