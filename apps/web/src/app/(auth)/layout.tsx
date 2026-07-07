import { GuestGuard } from "@/components/auth/guest-guard";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <GuestGuard>{children}</GuestGuard>;
}
