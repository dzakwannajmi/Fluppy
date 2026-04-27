import { NextResponse } from 'next/server';
import { payWithZk } from '@/src/lib/stellar'; // Pastikan path import ini sesuai

export async function POST(req: Request) {
  try {
    const { proof, destination, amount } = await req.json();

    const result = await payWithZk(destination, BigInt(amount), proof);
    
    // Ambil hash transaksi agar bisa di-klik di frontend
    const hash = result?.hash || result?.id || result?.txHash || "unknown";

    return NextResponse.json({ success: true, hash });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}