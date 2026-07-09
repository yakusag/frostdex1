// Browser-safe ESM shim for useSyncExternalStoreWithSelector
import { useSyncExternalStore } from 'react';
export function useSyncExternalStoreWithSelector(
  subscribe, getSnapshot, getServerSnapshot, selector, isEqual
) {
  let selected;
  const getSelected = () => {
    const next = selector(getSnapshot());
    if (selected !== undefined && isEqual && isEqual(selected, next)) return selected;
    return (selected = next);
  };
  const getServerSelected = getServerSnapshot
    ? () => selector(getServerSnapshot())
    : undefined;
  return useSyncExternalStore(subscribe, getSelected, getServerSelected);
}
export default { useSyncExternalStoreWithSelector };
