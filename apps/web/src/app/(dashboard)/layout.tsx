import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { AuthGuard } from "@/components/auth/auth-guard";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-dvh bg-background overflow-hidden">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header />
          {/* "relative" makes this the containing block for absolutely positioned descendants (sr-only file inputs, popovers):
              without it they escape the scroll area and make the whole document scrollable, so the app slides under the wheel */}
          <main className="relative flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
