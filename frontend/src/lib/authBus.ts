type Listener = () => void;

const listeners = new Set<Listener>();

export function onAuthChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyAuthChange(): void {
  listeners.forEach((listener) => listener());
}
