export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number,
  immediate: boolean,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function (this: unknown, ...args: Parameters<T>) {
    const callNow = immediate && !timeout;
    if (timeout) clearTimeout(timeout);

    timeout = setTimeout(() => {
      timeout = null;
      if (!immediate) func.apply(this, args);
    }, wait);

    if (callNow) func.apply(this, args);
  };
}
