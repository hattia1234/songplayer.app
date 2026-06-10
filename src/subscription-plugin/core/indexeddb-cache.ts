// src/subscription-plugin/core/indexeddb-cache.ts
const SUBSCRIPTION_DB_NAME = 'AppSubscriptions';
const STORE_NAME = 'subscriptions';

export const openSubscriptionDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SUBSCRIPTION_DB_NAME, 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'artistKey' });
      }
    };
  });
};

export const getCachedSubscription = async (artistKey: string) => {
  try {
    const db = await openSubscriptionDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(artistKey);
      req.onsuccess = () => {
        const data = req.result;
        if (data && data.expiresAt) {
          const isStillValid = new Date(data.expiresAt) > new Date();
          resolve({ 
            isActive: data.isActive && isStillValid, 
            expiresAt: data.expiresAt,
            status: data.status || (data.isActive ? 'active' : 'cancelled')
          });
        } else {
          resolve(null);
        }
        db.close();
      };
      req.onerror = () => { resolve(null); db.close(); };
    });
  } catch {
    return null;
  }
};

export const cacheSubscription = async (artistKey: string, isActive: boolean, expiresAt: string, status: 'active' | 'cancelled' = 'active') => {
  try {
    const db = await openSubscriptionDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ 
        artistKey, 
        isActive, 
        expiresAt,
        status,
        timestamp: Date.now() 
      });
      tx.oncomplete = () => { resolve(); db.close(); };
    });
  } catch (e) {
    console.warn('[Subscription Cache] Write failed', e);
  }
};