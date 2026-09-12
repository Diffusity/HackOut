import { NextResponse } from 'next/server';
import { trainModel } from '@/lib/ml/trainModel';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { csvData } = data;

    if (!csvData) {
      return NextResponse.json({ error: 'Missing CSV data' }, { status: 400 });
    }

    const result = await trainModel(csvData);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      message: result.message,
      datasetSize: result.datasetSize,
      coefficients: result.newCoefficients,
      intercept: result.intercept,
    });
  } catch (error: any) {
    console.error("API error during training:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
