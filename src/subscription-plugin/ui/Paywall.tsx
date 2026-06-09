// src/subscription-plugin/ui/Paywall.tsx
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface PaywallProps {
  artistKey: string;
  onSubscribe: () => void;
}

export default function Paywall({ artistKey, onSubscribe }: PaywallProps) {
  const [email, setEmail] = useState('');
  const [checking, setChecking] = useState(false);

  const handleUnlockWithEmail = async () => {
    if (!email) return;
    setChecking(true);

    try {
      const res = await fetch(`/.netlify/functions/subscription-check-subscription?artist=${encodeURIComponent(artistKey)}`, {
        headers: { 'x-user-email': email.trim() }
      });

      const data = await res.json();

      if (data.isActive === true) {
        localStorage.setItem('subscriptionEmail', email.trim());
        window.location.reload(); // Unlock
      } else {
        alert("No active subscription found for this email and this artist.");
      }
    } catch (err) {
      alert("Failed to check subscription.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="mx-auto w-28 h-28 bg-zinc-800 rounded-3xl flex items-center justify-center text-6xl mb-4">
          🔒
        </div>

        <h1 className="text-4xl font-bold mb-3">Full Access Locked</h1>
        <p className="text-zinc-400 text-lg">
          Subscribe for <span className="text-emerald-400 font-semibold">$4.99/month</span>
        </p>

        <Button onClick={onSubscribe} className="w-full py-7 text-xl bg-emerald-500 hover:bg-emerald-600 text-black">
          Subscribe for $4.99 / month
        </Button>

        <div className="pt-6 border-t border-zinc-800">
          <p className="text-sm text-zinc-400 mb-3">Already subscribed? Enter email to unlock</p>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
            />
            <Button 
              onClick={handleUnlockWithEmail}
              disabled={checking || !email}
              className="bg-zinc-700 hover:bg-zinc-600 px-6"
            >
              {checking ? "Checking..." : "Unlock"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}