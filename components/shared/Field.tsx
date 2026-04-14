type FieldProps = {
  label: string;
  children: React.ReactNode;
};

export default function Field({ label, children }: FieldProps) {
  return (
    <div className="mb-4">
      <label
        className="mb-1.5 block text-xs font-semibold uppercase"
        style={{ color: '#64748B', letterSpacing: '0.5px' }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
