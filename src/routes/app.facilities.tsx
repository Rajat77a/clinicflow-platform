import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/access-control";

export const Route = createFileRoute("/app/facilities")({
  component: FacilitiesLayout,
});

function FacilitiesLayout() {
  const { user } = useAuth();
  if (!user || !hasPermission(user.role, "facilities.manage")) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="mt-2 text-muted-foreground">
            You don't have permission to manage facilities.
          </p>
        </div>
      </div>
    );
  }
  return <Outlet />;
}