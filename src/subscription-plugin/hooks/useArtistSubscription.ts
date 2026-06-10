// src/subscription-plugin/hooks/useArtistSubscription.ts
import { useState, useEffect } from 'react';
import { getCachedSubscription, cacheSubscription } from '../core/indexeddb-cache';

export function useArtistSubscription(artistKey: string | null, userEmail?: string) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<'active' | 'cancelled' | 'none'>('none');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    if (!artistKey) {
      setLoading(false);
      return;
    }

    const checkSubscription = async () => {
      const cached = await getCachedSubscription(artistKey);

      if (cached && cached.isActive && !userEmail) {
        setIsSubscribed(true);
        setSubscriptionStatus('active');
        setExpiresAt(cached.expiresAt || null);
        setLoading(false);
        return;
      }

      try {
        const headers: any = {};
        if (userEmail) headers['x-user-email'] = userEmail;

        const res = await fetch(`/.netlify/functions/subscription-check-subscription?artist=${encodeURIComponent(artistKey)}`, { 
          headers 
        });

        if (res.ok) {
          const data = await res.json();
          const active = data.isActive === true;

          const expiresAtDate = new Date();
          expiresAtDate.setDate(expiresAtDate.getDate() + 30);

          await cacheSubscription(artistKey, active, expiresAtDate.toISOString(), active ? 'active' : 'cancelled');

          setIsSubscribed(active);
          setSubscriptionStatus(active ? 'active' : 'cancelled');
          setExpiresAt(expiresAtDate.toISOString());
        }
      } catch (err) {
        console.warn("[Subscription Plugin] Stripe check failed", err);
      } finally {
        setLoading(false);
      }
    };

    checkSubscription();
  }, [artistKey, userEmail]);

  const subscribeToArtist = () => {
    if (!artistKey) return;
    window.location.href = `/.netlify/functions/subscription-create-checkout?artist=${encodeURIComponent(artistKey)}`;
  };

  return { 
    isSubscribed, 
    loading, 
    subscribeToArtist,
    subscriptionStatus,
    expiresAt 
  };
}