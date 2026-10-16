export function watchDarkClass(onChange: (dark: boolean) => void): () => void {
  const read = (): boolean => document.documentElement.classList.contains("dark");
  onChange(read());
  const observer = new MutationObserver(() => {
    onChange(read());
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}
