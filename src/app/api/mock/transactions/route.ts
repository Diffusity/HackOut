import { NextResponse } from 'next/server';
import transactions from '../../../../../public/mock/transactions.json';

export async function GET() {
  return NextResponse.json(transactions);
}
