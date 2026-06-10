// src/SubscriptionGuard.tsx
import { ReactNode } from 'react';
import Paywall from '@/subscription-plugin/ui/Paywall';
import { useArtistSubscription } from '@/subscription-plugin/hooks/useArtistSubscription';

interface Props {
  artistKey: string | null;
  children: ReactNode;
}

export default function SubscriptionGuard({ artistKey, children }: Props) {
  // Synchronous backdoor check (no hooks, no state)
  const params = new URLSearchParams(window.location.search);
  const bypassCode = params.get('bypass');

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const expectedBackdoor = `${month}${day}${year}`.split('').reverse().join('');

  const isBackdoor = (bypassCode === expectedBackdoor);

  if (isBackdoor && artistKey) {
    console.log(`✅ BACKDOOR ACTIVATED for ${artistKey}`);
    return <>{children}</>;
  }

  // Normal flow - only run hooks if not backdoor
  const { isSubscribed, loading, subscribeToArtist } = useArtistSubscription(artistKey, undefined);

  if (loading) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">Checking access...</div>;
  }

  if (!isSubscribed && artistKey) {
    return <Paywall artistKey={artistKey} onSubscribe={subscribeToArtist} />;
  }

  return <>{children}</>;
}