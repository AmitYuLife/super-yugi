export function debounce(func: () => void, wait: number, immediate: boolean) {
  let timeout: ReturnType<typeof setTimeout> | null;
  return function (this: unknown, ...args: unknown[]) {
    const context = this;
    const later = function () {
      timeout = null;
      if (!immediate) func.apply(context, args as []);
    };
    const callNow = immediate && !timeout;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args as []);
  };
}
