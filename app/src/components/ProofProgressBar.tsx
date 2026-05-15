'use client';

import { useEffect, useState } from 'react';

interface Props {
  stage: string;
  pct:   number;
}

export function ProofProgressBar({ stage, pct }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start    = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full rounded-lg border border-white/10 bg-black/20 p-4">
      {/* Stage label + timer */}
      <div className="flex justify-between text-sm mb-2">
        <span className="text-white/80">{stage}</span>
        <span className="text-white/40">{elapsed}s</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-pink-500 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Percentage */}
      <div className="text-right text-xs text-white/30 mt-1">{pct}%</div>
    </div>
  );
}