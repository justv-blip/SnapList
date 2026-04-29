// Minimal layout for the onboarding flow — no sidebar, full screen.
// Auth is still enforced by middleware.

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
