import AppSidebar from "./AppSidebar";
import InstallPrompt from "./InstallPrompt";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <AppSidebar />
      {/* Main content — offset by sidebar on desktop, top/bottom bars on mobile */}
      <div className="lg:pl-60 pt-14 pb-20 lg:pt-0 lg:pb-0">
        <main className="max-w-6xl mx-auto px-5 py-8">
          {children}
        </main>
      </div>
      <InstallPrompt />
    </div>
  );
}
