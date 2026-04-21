import Sidebar from '@/components/layout/Sidebar';
import AskAI from '@/components/shared/AskAI';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen" style={{ background: 'var(--bg)', zIndex: 1 }}>
      <Sidebar />
      <main className="md:ml-[60px]">
        <div className="px-6 py-8 md:px-8">
          {children}
        </div>
      </main>
      <AskAI />
    </div>
  );
}
