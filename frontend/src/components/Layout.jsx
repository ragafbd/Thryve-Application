import { useState } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  PlusCircle, 
  Menu, 
  X,
  FileSpreadsheet,
  LogOut,
  Key,
  UserCircle,
  Shield,
  UserPlus,
  CalendarDays,
  CalendarOff,
  Ticket,
  Megaphone,
  Zap,
  Building2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Invoice section (without Dashboard)
const invoiceNavItems = [
  { path: "create-invoice", icon: PlusCircle, label: "Create Invoice" },
  { path: "bulk-invoice", icon: FileSpreadsheet, label: "Bulk Invoice" },
  { path: "auto-invoice", icon: Zap, label: "Auto Generate" },
  { path: "invoices", icon: FileText, label: "Invoices" },
];

// Management section
const managementNavItems = [
  { path: "companies", icon: Building2, label: "Company Subscriptions" },
  { path: "bookings", icon: CalendarDays, label: "Meeting Room Bookings" },
  { path: "tickets", icon: Ticket, label: "Support Tickets" },
  { path: "announcements", icon: Megaphone, label: "Announcements" },
];

// Settings section (at bottom)
const settingsNavItems = [
  { path: "holidays", icon: CalendarOff, label: "Public Holidays" },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
  const [changingPassword, setChangingPassword] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    navigate("/admin/login");
  };

  const handleChangePassword = async () => {
    if (!passwords.current || !passwords.new || !passwords.confirm) {
      toast.error("Please fill in all fields");
      return;
    }
    if (passwords.new !== passwords.confirm) {
      toast.error("New passwords don't match");
      return;
    }
    if (passwords.new.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setChangingPassword(true);
    try {
      await axios.post(`${API}/auth/change-password`, {
        current_password: passwords.current,
        new_password: passwords.new
      });
      toast.success("Password changed successfully");
      setPasswordDialogOpen(false);
      setPasswords({ current: "", new: "", confirm: "" });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside 
        className={cn(
          "sidebar fixed left-0 top-0 z-40 flex flex-col",
          !sidebarOpen && "sidebar-collapsed"
        )}
        data-testid="sidebar"
      >
        {/* Logo - Centered */}
        <div className="p-6 border-b border-white/10">
          <div className="flex justify-center">
            <img 
              src="https://customer-assets.emergentagent.com/job_683f7dfb-7860-4882-8d93-58ac3f0439b2/artifacts/jqltfue2_Gemini_Generated_Image_xy33ixy33ixy33ix.png" 
              alt="Thryve Coworking" 
              className="h-12 w-auto"
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {/* Dashboard - Top Level */}
          <NavLink
            to="/admin"
            data-testid="nav-dashboard"
            className={cn(
              "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 mb-2",
              location.pathname === "/admin" || location.pathname === "/admin/"
                ? "bg-[#FFA14A] text-[#2E375B] font-medium" 
                : "text-white/70 hover:bg-white/10 hover:text-white"
            )}
          >
            <LayoutDashboard className="w-5 h-5" strokeWidth={1.5} />
            <span className="text-sm">Dashboard</span>
          </NavLink>

          {/* Management Section */}
          <p className="text-xs text-white/60 uppercase tracking-wider px-4 py-2 mt-2 font-bold">Management</p>
          {managementNavItems.map((item) => {
            const isActive = location.pathname === `/admin/${item.path}`;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200",
                  isActive 
                    ? "bg-[#FFA14A] text-[#2E375B] font-medium" 
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                <item.icon className="w-5 h-5" strokeWidth={1.5} />
                <span className="text-sm">{item.label}</span>
              </NavLink>
            );
          })}

          {/* Invoice Section */}
          <p className="text-xs text-white/60 uppercase tracking-wider px-4 py-2 mt-4 font-bold">Invoicing</p>
          {invoiceNavItems.map((item) => {
            const isActive = location.pathname === `/admin/${item.path}`;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200",
                  isActive 
                    ? "bg-[#FFA14A] text-[#2E375B] font-medium" 
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                <item.icon className="w-5 h-5" strokeWidth={1.5} />
                <span className="text-sm">{item.label}</span>
              </NavLink>
            );
          })}
          
          {/* Admin Section */}
          {isAdmin() && (
            <>
              <p className="text-xs text-white/60 uppercase tracking-wider px-4 py-2 mt-4 font-bold">Admin</p>
              <NavLink
                to="clients"
                data-testid="nav-clients"
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200",
                  location.pathname === "/admin/clients"
                    ? "bg-[#FFA14A] text-[#2E375B] font-medium" 
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                <Users className="w-5 h-5" strokeWidth={1.5} />
                <span className="text-sm">Clients (Legacy)</span>
              </NavLink>
              <NavLink
                to="users"
                data-testid="nav-users"
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200",
                  location.pathname === "/admin/users"
                    ? "bg-[#FFA14A] text-[#2E375B] font-medium" 
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                <Shield className="w-5 h-5" strokeWidth={1.5} />
                <span className="text-sm">User Management</span>
              </NavLink>
            </>
          )}

          {/* Settings Section - At Bottom */}
          <p className="text-xs text-white/60 uppercase tracking-wider px-4 py-2 mt-4 font-bold">Settings</p>
          {settingsNavItems.map((item) => {
            const isActive = location.pathname === `/admin/${item.path}`;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200",
                  isActive 
                    ? "bg-[#FFA14A] text-[#2E375B] font-medium" 
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                <item.icon className="w-5 h-5" strokeWidth={1.5} />
                <span className="text-sm">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <p className="text-xs text-white/40 text-center">
            © 2026 Thryve Coworking
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main 
        className={cn(
          "main-content min-h-screen bg-[#F8FAFC]",
          !sidebarOpen && "main-content-expanded"
        )}
      >
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 no-print">
          <div className="flex items-center justify-between px-6 py-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              data-testid="sidebar-toggle"
              className="hover:bg-slate-100"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500 font-mono hidden sm:block">
                {new Date().toLocaleDateString('en-IN', { 
                  weekday: 'short', 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </span>
              
              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="flex items-center gap-2 hover:bg-slate-100"
                    data-testid="user-menu-btn"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#2E375B] flex items-center justify-center">
                      <UserCircle className="w-5 h-5 text-white" />
                    </div>
                    <div className="hidden md:block text-left">
                      <p className="text-sm font-medium text-slate-900">{user?.name}</p>
                      <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5 md:hidden">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-slate-500">{user?.email}</p>
                  </div>
                  <DropdownMenuSeparator className="md:hidden" />
                  <DropdownMenuItem 
                    onClick={() => setPasswordDialogOpen(true)}
                    className="cursor-pointer"
                    data-testid="change-password-btn"
                  >
                    <Key className="w-4 h-4 mr-2" />
                    Change Password
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={handleLogout}
                    className="cursor-pointer text-red-600 focus:text-red-600"
                    data-testid="logout-btn"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6 md:p-8 lg:p-12">
          <Outlet />
        </div>
      </main>

      {/* Change Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-[Manrope]">Change Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={passwords.current}
                onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                placeholder="Enter current password"
                data-testid="current-password-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={passwords.new}
                onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                placeholder="Enter new password"
                data-testid="new-password-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={passwords.confirm}
                onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                placeholder="Confirm new password"
                data-testid="confirm-password-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              className="bg-[#2E375B] hover:bg-[#232B47]"
              onClick={handleChangePassword}
              disabled={changingPassword}
              data-testid="change-password-submit"
            >
              {changingPassword ? "Changing..." : "Change Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
