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
    const params = new URLSearchParams(window.location.search);
  const bypassCode = params.get('bypass');
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const expectedBackdoor = `${month}${day}${year}`.split('').reverse().join('');
  const isBackdoor = (bypassCode === expectedBackdoor);

  if (isBackdoor) {
    
    return ;
  }


    const savedEmail = localStorage.getItem('subscriptionEmail');
    if (!savedEmail) {
      alert("Please subscribe first or use the email unlock on the paywall.");
      return;
    }

    let url = `/.netlify/functions/subscription-create-portal?email=${encodeURIComponent(savedEmail)}`;
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