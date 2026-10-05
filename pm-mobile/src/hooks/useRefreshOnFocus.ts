import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

/** Refetches when the screen regains focus (skips the initial focus, which already fetches). */
export function useRefreshOnFocus(refetch: () => unknown): void {
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      refetch();
    }, [refetch]),
  );
}
