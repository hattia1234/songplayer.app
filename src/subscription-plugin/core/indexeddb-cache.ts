// src/subscription-plugin/core/indexeddb-cache.ts
const SUBSCRIPTION_DB_NAME = 'AppSubscriptions';
const STORE_NAME = 'subscriptions';

export const openSubscriptionDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SUBSCRIPTION_DB_NAME, 1);
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

export const getCachedSubscription = async (artistKey: string): Promise<boolean> => {
  try {
    const db = await openSubscriptionDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(artistKey);
      req.onsuccess = () => resolve(!!req.result?.isActive);
      req.onerror = () => resolve(false);
      db.close();
    });
  } catch {
    return false;
  }
};

export const cacheSubscription = async (artistKey: string, isActive: boolean): Promise<void> => {
  try {
    const db = await openSubscriptionDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ artistKey, isActive, timestamp: Date.now() });
      tx.oncomplete = () => { resolve(); db.close(); };
    });
  } catch (e) {
    console.warn('[Subscription Cache] Write failed', e);
  }
};