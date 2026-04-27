import { NextResponse } from 'next/server';
import { generateZkProof } from '@/src/lib/zkp'; // Pastikan path import ini sesuai dengan foldermu

export async function POST(req: Request) {
  try {
    const { secret, destination, amount } = await req.json();
    const WHITELIST = ["2410010454", "2410010001"]; // Sesuai dengan test-payment.ts

    const proof = await generateZkProof(secret, WHITELIST, destination, BigInt(amount));

    return NextResponse.json({ success: true, proof });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}