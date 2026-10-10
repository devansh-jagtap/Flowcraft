import { useEffect, useState } from 'react';
import { aiApi } from '../api/ai';

/** undefined while loading, then true/false. */
export function useAiEnabled() {
  const [enabled, setEnabled] = useState<boolean>();
  useEffect(() => {
    let active = true;
    aiApi.enabled().then((value) => active && setEnabled(value));
    return () => {
      active = false;
    };
  }, []);
  return enabled;
}
