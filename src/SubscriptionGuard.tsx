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

  // Load saved email + handle success redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const successEmail = params.get('email');

    if (successEmail) {
      localStorage.setItem('subscriptionEmail', successEmail);
      setUserEmail(successEmail);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname + `?artist=${artistKey}`);
    } else {
      const savedEmail = localStorage.getItem('subscriptionEmail');
      if (savedEmail) setUserEmail(savedEmail);
    }
  }, [artistKey]);

  const { isSubscribed, loading, subscribeToArtist } = useArtistSubscription(artistKey, userEmail || undefined);

  if (loading) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">Checking access...</div>;
  }

  if (!isSubscribed && artistKey) {
    return <Paywall artistKey={artistKey} onSubscribe={subscribeToArtist} />;
  }

  return <>{children}</>;
}