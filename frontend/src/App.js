import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import CreateInvoice from "@/pages/CreateInvoice";
import InvoiceList from "@/pages/InvoiceList";
import InvoiceView from "@/pages/InvoiceView";
import Clients from "@/pages/Clients";
import BulkInvoice from "@/pages/BulkInvoice";
import Users from "@/pages/Users";

// Protected Route Component
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-center">
          <img 
            src="https://customer-assets.emergentagent.com/job_683f7dfb-7860-4882-8d93-58ac3f0439b2/artifacts/jqltfue2_Gemini_Generated_Image_xy33ixy33ixy33ix.png" 
            alt="Thryve Coworking" 
            className="h-16 mx-auto mb-4 animate-pulse"
          />
          <p className="text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="create-invoice" element={<CreateInvoice />} />
        <Route path="bulk-invoice" element={<BulkInvoice />} />
        <Route path="invoices" element={<InvoiceList />} />
        <Route path="invoices/:id" element={<InvoiceView />} />
        <Route path="clients" element={<Clients />} />
        <Route path="users" element={<Users />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
