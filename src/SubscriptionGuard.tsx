// src/SubscriptionGuard.tsx
import { useArtistSubscription } from '@/subscription-plugin/hooks/useArtistSubscription';
import Paywall from '@/subscription-plugin/ui/Paywall';
import { ReactNode, useEffect, useState } from 'react';

interface Props {
  artistKey: string | null;
  children: ReactNode;
}

export default function SubscriptionGuard({ artistKey, children }: Props) {
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const successEmail = params.get('email');

    if (successEmail) {
      localStorage.setItem('subscriptionEmail', successEmail);
      setUserEmail(successEmail);
    } else {
      const saved = localStorage.getItem('subscriptionEmail');
      if (saved) setUserEmail(saved);
    }
  }, []);

  const { isSubscribed, loading, subscribeToArtist } = useArtistSubscription(artistKey, userEmail || undefined);

  if (loading) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">Checking access...</div>;
  }

  if (!isSubscribed && artistKey) {
    return (
      <Paywall 
        artistKey={artistKey} 
        onSubscribe={subscribeToArtist} 
        onManageSubscription={() => window.location.href = '/.netlify/functions/subscription-create-portal'}
      />
    );
  }

  return <>{children}</>;
}