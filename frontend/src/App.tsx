import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import DashboardNavbar from "./components/DashboardNavbar";
import type { NavKey } from "./components/DashboardNavbar";
import LoginPage from "./components/LoginPage";
import { authClient } from "./auth-client";
import HistoryPage from "./pages/HistoryPage";
import ReportsPage from "./pages/ReportsPage";
import TemplatesPage from "./pages/TemplatesPage";
import VerifyPage from "./pages/VerifyPage";

const PATH_TO_KEY: Record<string, NavKey> = {
  "/": "dashboard",
  "/history": "history",
  "/templates": "templates",
  "/reports": "reports",
};

export default function App() {
  const session = authClient.useSession();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (session.isPending) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="mx-auto w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (!session.data) {
    return <LoginPage />;
  }

  const user = session.data.user;
  const userName = user.name?.trim() || (user.email?.split("@")[0] ?? "User");

  const signOut = async () => {
    await authClient.signOut();
    navigate("/");
  };

  const onNavigate = (to: NavKey) => navigate(to === "dashboard" ? "/" : `/${to}`);

  return (
    <div className="min-h-screen bg-slate-50">
      <DashboardNavbar
        active={PATH_TO_KEY[pathname] ?? null}
        userName={userName}
        userEmail={user.email ?? ""}
        onNavigate={onNavigate}
        onSignOut={signOut}
      />

      <Routes>
        <Route path="/" element={<Dashboard onVerify={() => navigate("/verify")} onOpenHistory={() => navigate("/history")} />} />
        <Route path="/verify" element={<VerifyPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}