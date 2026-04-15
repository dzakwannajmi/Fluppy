#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, token};

#[contract]
pub struct FluppyEscrow;

#[contractimpl]
impl FluppyEscrow {
    /// Fungsi untuk membayar booking dan membagi dana secara otomatis
    pub fn pay_and_split(
        env: Env,
        token_address: Address, // Alamat smart contract aset (misal: USDC atau XLM)
        guest: Address,         // Alamat wallet tamu yang membayar
        owner: Address,         // Alamat wallet pemilik hotel (95%)
        ops: Address,           // Alamat wallet operasional Fluppy (5%)
        amount: i128,           // Total harga booking
    ) {
        // 1. Verifikasi Keamanan: Pastikan tamu benar-benar menyetujui transaksi ini
        guest.require_auth();

        // 2. Logika Matematika Split Payment
        // Soroban tidak mendukung angka desimal (float), jadi kita pakai perkalian integer
        let ops_fee = (amount * 5) / 100;      // 5% untuk operasional
        let owner_share = amount - ops_fee;    // Sisanya (95%) untuk owner hotel

        // 3. Inisialisasi Klien Token
        // Ini ibarat kita memanggil "Bank" (USDC/XLM) untuk memproses transfer
        let token_client = token::Client::new(&env, &token_address);

        // 4. Eksekusi Transfer
        // Transfer 95% dari tamu ke pemilik hotel
        token_client.transfer(&guest, &owner, &owner_share);

        // Transfer 5% dari tamu ke operasional Fluppy
        token_client.transfer(&guest, &ops, &ops_fee);
    }
}