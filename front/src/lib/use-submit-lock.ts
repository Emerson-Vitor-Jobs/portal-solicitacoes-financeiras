import { useRef } from 'react';

export function useSubmitLock() {
  const locked = useRef(false);
  return {
    tryAcquire(): boolean {
      if (locked.current) return false;
      locked.current = true;
      return true;
    },
    release(): void {
      locked.current = false;
    },
  };
}
