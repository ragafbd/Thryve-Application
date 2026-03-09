import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { MemberAuthProvider, useMemberAuth } from "@/contexts/MemberAuthContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import CreateInvoice from "@/pages/CreateInvoice";
import InvoiceList from "@/pages/InvoiceList";
import InvoiceView from "@/pages/InvoiceView";
import Clients from "@/pages/Clients";
import BulkInvoice from "@/pages/BulkInvoice";
import Users from "@/pages/Users";
import Members from "@/pages/Members";
import Bookings from "@/pages/Bookings";
import Tickets from "@/pages/Tickets";
import Announcements from "@/pages/Announcements";

// Member Portal imports
import MemberLogin from "@/pages/portal/MemberLogin";
import MemberLayout from "@/pages/portal/MemberLayout";
import MemberDashboard from "@/pages/portal/MemberDashboard";
import MemberInvoices from "@/pages/portal/MemberInvoices";
import MemberBookings from "@/pages/portal/MemberBookings";
import MemberTickets from "@/pages/portal/MemberTickets";
import MemberAnnouncements from "@/pages/portal/MemberAnnouncements";

// Protected Route Component for Admin
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

// Protected Route for Member Portal
function MemberProtectedRoute({ children }) {
  const { member, loading } = useMemberAuth();
  
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
  
  if (!member) {
    return <Navigate to="/portal/login" replace />;
  }
  
  return children;
}

// Admin App Routes
function AdminRoutes() {
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
        <Route path="members" element={<Members />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="tickets" element={<Tickets />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="users" element={<Users />} />
      </Route>
    </Routes>
  );
}

// Member Portal Routes
function MemberRoutes() {
  const { member } = useMemberAuth();
  
  return (
    <Routes>
      <Route path="login" element={member ? <Navigate to="/portal" replace /> : <MemberLogin />} />
      <Route path="/" element={
        <MemberProtectedRoute>
          <MemberLayout />
        </MemberProtectedRoute>
      }>
        <Route index element={<MemberDashboard />} />
        <Route path="invoices" element={<MemberInvoices />} />
        <Route path="bookings" element={<MemberBookings />} />
        <Route path="tickets" element={<MemberTickets />} />
        <Route path="announcements" element={<MemberAnnouncements />} />
      </Route>
      <Route path="*" element={<Navigate to="/portal" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          {/* Main landing page - Member Portal Login */}
          <Route path="/" element={
            <MemberAuthProvider>
              <MemberLogin />
            </MemberAuthProvider>
          } />
          
          {/* Member Portal Routes */}
          <Route path="/portal/*" element={
            <MemberAuthProvider>
              <MemberRoutes />
            </MemberAuthProvider>
          } />
          
          {/* Admin Routes - now under /admin */}
          <Route path="/admin/*" element={
            <AuthProvider>
              <AdminRoutes />
            </AuthProvider>
          } />
          
          {/* Legacy /login redirect to /admin/login */}
          <Route path="/login" element={<Navigate to="/admin/login" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
