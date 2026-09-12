import { NextResponse } from 'next/server';
import coefficients from '../../../../../public/mock/coefficients.json';

export async function GET() {
  return NextResponse.json(coefficients);
}
