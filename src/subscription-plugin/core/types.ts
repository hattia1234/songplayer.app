export type ArtistKey = string;

export interface SubscriptionStatus {
  artistKey: ArtistKey;
  isActive: boolean;
  subscriptionId?: string;
}

export interface SubscriptionConfig {
  stripePublishableKey: string;
  createCheckoutUrl: string;
  checkSubscriptionUrl: string;
}