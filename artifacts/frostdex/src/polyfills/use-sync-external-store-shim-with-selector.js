// ESM polyfill for use-sync-external-store/shim/with-selector.js
// Provides useSyncExternalStoreWithSelector using React 19's built-in hook.
import { useSyncExternalStore } from 'react';

function useSyncExternalStoreWithSelector(
  subscribe,
  getSnapshot,
  getServerSnapshot,
  selector,
  isEqual
) {
  let selected;
  const getSelected = () => {
    const s = selector(getSnapshot());
    if (selected !== undefined && isEqual && isEqual(selected, s)) return selected;
    selected = s;
    return s;
  };
  const getServerSelected = getServerSnapshot
    ? () => selector(getServerSnapshot())
    : undefined;
  return useSyncExternalStore(subscribe, getSelected, getServerSelected);
}

export { useSyncExternalStoreWithSelector };
export default { useSyncExternalStoreWithSelector };
