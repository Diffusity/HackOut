import { NextResponse } from 'next/server';
import savings from '../../../../../public/mock/savings.json';

export async function GET() {
  return NextResponse.json(savings);
}
