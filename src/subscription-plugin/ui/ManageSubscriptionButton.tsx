// src/subscription-plugin/ui/ManageSubscriptionButton.tsx
import { Button } from '@/components/ui/button';

interface Props {
  artistKey?: string;
  label?: string;
  variant?: "default" | "outline" | "ghost";
  className?: string;
}

export default function ManageSubscriptionButton({ 
  artistKey, 
  label = "Manage Subscription",
  variant = "outline",
  className = ""
}: Props) {
  const handleManage = () => {
    const email = localStorage.getItem('subscriptionEmail');
    if (!email) {
      alert("Please subscribe first or use the email unlock on the paywall.");
      return;
    }

    let url = `/.netlify/functions/subscription-create-portal?email=${encodeURIComponent(email)}`;
    if (artistKey) {
      url += `&artist=${encodeURIComponent(artistKey)}`;
    }
    window.location.href = url;
  };

  return (
    <Button 
      onClick={handleManage}
      variant={variant}
      className={`w-full ${className}`}
    >
      {label}
    </Button>
  );
}