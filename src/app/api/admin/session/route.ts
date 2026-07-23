import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Is the caller logged in? 204 for yes, 401 for no, no body either way.
 *
 * The admin shell asks this on every page load. It used to ask
 * `/api/admin/products`, which pulls the full product list out of Baserow just so
 * the layout can read a status code.
 */
export async function GET() {
  return new NextResponse(null, { status: isAuthenticated() ? 204 : 401 });
}
