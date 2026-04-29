import { NextResponse } from 'next/server';
import { generateZkProof } from '@/src/lib/zkp';
import path from 'path';

export async function POST(req: Request) {
  try {
    const { secret, destination, amount } = await req.json();
    const WHITELIST = ["2410010454", "2410010001"];

    const proof = await generateZkProof(secret, WHITELIST, destination, BigInt(amount));

    const zkeyPath = path.join(process.cwd(), 'public', 'circuit', 'circuit_final.zkey');
    const wasmPath = path.join(process.cwd(), 'public', 'circuit', 'circuit.wasm');

    return NextResponse.json({ success: true, proof });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}