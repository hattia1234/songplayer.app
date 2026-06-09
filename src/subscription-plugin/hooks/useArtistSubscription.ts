// src/subscription-plugin/hooks/useArtistSubscription.ts
import { useState, useEffect } from 'react';
import { getCachedSubscription, cacheSubscription } from '../core/indexeddb-cache';

export function useArtistSubscription(artistKey: string | null, providedEmail?: string) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!artistKey) {
      setLoading(false);
      return;
    }

    const checkSubscription = async () => {
      const cached = await getCachedSubscription(artistKey);
      setIsSubscribed(cached);

      try {
        const emailToUse = providedEmail || localStorage.getItem('subscriptionEmail');
        const headers: any = {};
        if (emailToUse) headers['x-user-email'] = emailToUse;

        const res = await fetch(`/.netlify/functions/subscription-check-subscription?artist=${encodeURIComponent(artistKey)}`, { headers });

        if (res.ok) {
          const data = await res.json();
          const active = data.isActive === true;
          setIsSubscribed(active);
          await cacheSubscription(artistKey, active);
        }
      } catch (err) {
        console.warn("Backend check failed, using cache", err);
      } finally {
        setLoading(false);
      }
    };

    checkSubscription();
  }, [artistKey, providedEmail]);

  const subscribeToArtist = () => {
    if (!artistKey) return;
    window.location.href = `/.netlify/functions/subscription-create-checkout?artist=${encodeURIComponent(artistKey)}`;
  };

  return { isSubscribed, loading, subscribeToArtist };
}