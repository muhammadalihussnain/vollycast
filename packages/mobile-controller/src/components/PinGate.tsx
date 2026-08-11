/**
 * PinGate — Task 8.6
 * 4-digit PIN screen. Blocks access until correct PIN entered.
 * PIN stored in localStorage (set to '1234' by default — change in production).
 */

import { useState, useCallback } from 'react';

const CORRECT_PIN = '1234';
const STORAGE_KEY = 'vollycast_pin_unlocked';

function isUnlocked(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'yes';
}

interface Props {
  children: React.ReactNode;
}

export function PinGate({ children }: Props): React.JSX.Element {
  const [unlocked, setUnlocked] = useState(isUnlocked);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleDigit = useCallback((digit: string): void => {
    const next = pin + digit;
    if (next.length < 4) {
      setPin(next);
      setError(false);
      return;
    }
    // 4 digits entered — check
    if (next === CORRECT_PIN) {
      localStorage.setItem(STORAGE_KEY, 'yes');
      setUnlocked(true);
    } else {
      setPin('');
      setError(true);
    }
  }, [pin]);

  const handleClear = useCallback((): void => {
    setPin('');
    setError(false);
  }, []);

  if (unlocked) return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
      {/* Logo */}
      <div className="text-center">
        <div className="text-3xl font-black text-mc-accent">VollyCast</div>
        <div className="text-sm text-slate-400 mt-1">Scorekeeper Access</div>
      </div>

      {/* PIN dots */}
      <div className="flex gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={[
            'h-4 w-4 rounded-full border-2 transition-all',
            i < pin.length
              ? 'bg-mc-accent border-mc-accent'
              : error
                ? 'border-red-500'
                : 'border-slate-600',
          ].join(' ')} />
        ))}
      </div>

      {error && <p className="text-sm text-red-400">Incorrect PIN. Try again.</p>}

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
          <button
            key={i}
            onClick={() => {
              if (d === '⌫') handleClear();
              else if (d !== '') handleDigit(d);
            }}
            disabled={d === ''}
            className={[
              'rounded-xl py-5 text-xl font-bold transition-all active:scale-95',
              d === '' ? 'invisible' : 'bg-mc-card hover:bg-mc-btn',
            ].join(' ')}
          >
            {d}
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-500">Default PIN: 1234</p>
    </div>
  );
}
