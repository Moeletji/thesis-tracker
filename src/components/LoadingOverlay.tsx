interface LoadingOverlayProps {
  message?: string;
  visible: boolean;
}

export function LoadingOverlay({ message, visible }: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <div className="loading-overlay">
      <div className="spinner" aria-hidden="true" />
      <p>{message ?? "Connecting to your board..."}</p>
    </div>
  );
}
