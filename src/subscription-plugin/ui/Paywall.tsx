// src/subscription-plugin/ui/Paywall.tsx
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface PaywallProps {
  artistKey: string;
  onSubscribe: () => void;
}

// Easy way to add artist images
const artistImages: Record<string, string> = {
  AddictiveCurves: 'https://i.ibb.co/CfbBxmh/Inplainsight.jpg',   // replace with real image
  Alice: 'https://i.ibb.co/zHTG35Tz/ARTIST-ALICE.jpg',
  Blizzard: 'https://i.ibb.co/Hf9TYZZX/Solo-Frenzy1.jpg',
  RebelRoads: 'https://i.ibb.co/n9WqnRB/Rebel-Roads-Artist.jpg',
  // Add more artists easily here
};

export default function Paywall({ 
  artistKey, 
  onSubscribe 
}: PaywallProps) {
  const [email, setEmail] = useState('');
  const [checking, setChecking] = useState(false);

  const artistImage = artistImages[artistKey] || 'https://via.placeholder.com/300x300/27272a/white?text=Artist';

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
        window.location.reload();
      } else {
        alert("No active subscription found for this email.");
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
        
        {/* Artist Image */}
        <div className="mx-auto w-48 h-48 rounded-2xl overflow-hidden border-4 border-zinc-800 shadow-2xl">
          <img 
            src={artistImage} 
            alt={artistKey}
            className="w-full h-full object-cover"
          />
        </div>

        <h1 className="text-4xl font-bold mb-3">{artistKey} - Full Access Locked</h1>
        <p className="text-zinc-400 text-lg">Subscribe for <span className="text-emerald-400 font-semibold">$4.99/month</span></p>

        <Button 
          onClick={onSubscribe}
          size="lg"
          className="w-full py-7 text-xl bg-emerald-500 hover:bg-emerald-600 text-black font-semibold"
        >
          Subscribe for $4.99 / month
        </Button>

        <div className="pt-6 border-t border-zinc-800">
          <p className="text-sm text-zinc-400 mb-3">Already subscribed on another device?</p>
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