import { useEffect, useRef, useState } from 'react';
import { lookupIndianPincode, type PincodeLookupResult } from '../services/pincodeService';

export type PincodeAutofillStatus = 'idle' | 'loading' | 'resolved' | 'not_found' | 'error';

/**
 * Resolves a six-digit Indian pincode and ignores aborted/stale responses.
 * The callback is kept in a ref so form components can pass an inline state
 * updater without restarting the lookup on every render.
 */
export function usePincodeAutofill(
  pincode: string,
  onResolved: (result: PincodeLookupResult) => void,
  debounceMs = 250,
): PincodeAutofillStatus {
  const callbackRef = useRef(onResolved);
  const [status, setStatus] = useState<PincodeAutofillStatus>('idle');

  callbackRef.current = onResolved;

  useEffect(() => {
    const normalized = pincode.replace(/\D/g, '').slice(0, 6);
    if (normalized.length !== 6) {
      setStatus('idle');
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setStatus('loading');
      lookupIndianPincode(normalized, controller.signal)
        .then(result => {
          if (controller.signal.aborted) return;
          if (!result) {
            setStatus('not_found');
            return;
          }
          callbackRef.current(result);
          setStatus('resolved');
        })
        .catch(error => {
          if (controller.signal.aborted || error?.name === 'AbortError') return;
          setStatus('error');
        });
    }, debounceMs);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [debounceMs, pincode]);

  return status;
}
