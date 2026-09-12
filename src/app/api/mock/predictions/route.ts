import { NextResponse } from 'next/server';
import predictions from '../../../../../public/mock/predictions.json';

export async function GET() {
  return NextResponse.json(predictions);
}
