'use client';

type StatusBadgeProps = {
  status: 'good' | 'paused' | 'cancelled';
  onClick?: () => void;
};

export default function StatusBadge({ status, onClick }: StatusBadgeProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={'badge ' + status}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <span className="dot" />
      {status}
    </button>
  );
}
