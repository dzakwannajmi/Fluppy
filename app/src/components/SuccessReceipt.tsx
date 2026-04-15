export const SuccessReceipt = ({ hash, amount }: { hash: string, amount: string }) => (
  <main className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
    <div className="w-full max-w-md bg-card border-2 border-primary rounded-[2.5rem] p-8 text-center">
      <h2 className="text-3xl font-black mb-2 uppercase">Success!</h2>
      <p className="mb-4">{amount} USDC Sent</p>
      <a 
        href={`https://stellar.expert/explorer/testnet/tx/${hash}`} 
        target="_blank" 
        className="text-primary underline text-sm"
      >
        Verify on Explorer ↗
      </a>
      <button 
        onClick={() => window.location.reload()} 
        className="w-full mt-6 py-4 bg-primary text-white rounded-2xl font-black"
      >
        Done
      </button>
    </div>
  </main>
);