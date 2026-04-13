import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import Navbar from "./components/Navbar";
import { Footer } from "./components/Footer";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import CreateAccount from "./pages/CreateAccount";
import DeviceManager from "./pages/DeviceManager";
import Messages from "./pages/Messages";
import Dashboard from "./pages/Dashboard";
import ApiDocs from "./pages/ApiDocs";

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <Navbar />
        <main className="mx-auto max-w-7xl px-5 pt-28">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<CreateAccount />} />
            <Route path="/api" element={<ApiDocs />} />
            <Route
              path="/devices"
              element={
                <ProtectedRoute>
                  <DeviceManager />
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages"
              element={
                <ProtectedRoute>
                  <Messages />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </AuthProvider>
  );
}
