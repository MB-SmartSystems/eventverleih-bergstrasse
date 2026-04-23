import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { readdir } from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

const ALLOWED = ['.jpg', '.jpeg', '.png', '.webp'];

export async function GET() {
  if (!isAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const dir = path.join(process.cwd(), 'public', 'images', 'products');
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const images = entries
      .filter((e) => e.isFile() && ALLOWED.includes(path.extname(e.name).toLowerCase()))
      .map((e) => ({
        filename: e.name,
        url: `/images/products/${e.name}`,
      }))
      .sort((a, b) => a.filename.localeCompare(b.filename));
    return NextResponse.json({ images });
  } catch (err) {
    return NextResponse.json({ images: [], error: String(err) });
  }
}
