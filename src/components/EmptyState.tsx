interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export default function EmptyState({ icon, title, description, ctaLabel, onCta }: EmptyStateProps) {
  return (
    <div
      className="empty-state"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-12) var(--space-6)',
        textAlign: 'center',
      }}
    >
      <span
        aria-hidden="true"
        style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}
      >
        {icon}
      </span>
      <h2
        style={{
          fontSize: 'var(--font-size-xl)',
          fontWeight: 600,
          color: 'var(--color-text)',
          marginBottom: 'var(--space-2)',
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontSize: 'var(--font-size-base)',
          color: 'var(--color-text-muted)',
          maxWidth: '400px',
          marginBottom: 'var(--space-6)',
        }}
      >
        {description}
      </p>
      {ctaLabel && onCta && (
        <button
          type="button"
          onClick={onCta}
          className="empty-state__cta"
          style={{
            padding: 'var(--space-3) var(--space-6)',
            background: 'linear-gradient(135deg, var(--color-primary), #7C3AED)',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            fontSize: 'var(--font-size-base)',
            cursor: 'pointer',
          }}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
