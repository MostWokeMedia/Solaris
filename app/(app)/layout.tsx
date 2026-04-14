import Sidebar from '@/components/layout/Sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: '#0A0E17' }}>
      <Sidebar />
      <main className="md:ml-60">
        <div className="px-6 py-8 md:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
