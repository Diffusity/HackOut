import { NextResponse } from 'next/server';
import auditLog from '../../../../../public/mock/auditLog.json';

export async function GET() {
  return NextResponse.json(auditLog);
}
