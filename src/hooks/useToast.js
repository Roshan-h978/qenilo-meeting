import { useEffect, useState } from 'react';

export default function useToast() {
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return [toast, setToast];
}
