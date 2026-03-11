import { useState, useEffect, useRef } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, FileText, CalendarDays, Ticket, Megaphone, 
  Menu, X, LogOut, Key, UserCircle, Bell
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
import { useMemberAuth } from "@/contexts/MemberAuthContext";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api/member`;

const navItems = [
  { path: "/portal", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { path: "/portal/invoices", icon: FileText, label: "My Invoices" },
  { path: "/portal/bookings", icon: CalendarDays, label: "Meeting Room Bookings" },
  { path: "/portal/tickets", icon: Ticket, label: "Support Tickets" },
  { path: "/portal/announcements", icon: Megaphone, label: "Announcements" },
];

export default function MemberLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
  const [changingPassword, setChangingPassword] = useState(false);
  const [newAnnouncementCount, setNewAnnouncementCount] = useState(0);
  const [lastAnnouncementCheck, setLastAnnouncementCheck] = useState(null);
  const [lastTicketStates, setLastTicketStates] = useState({});
  const location = useLocation();
  const navigate = useNavigate();
  const { member, logout, changePassword } = useMemberAuth();

  // Notification sound
  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 600;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;
      
      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        audioContext.close();
      }, 150);
      
      // Second tone
      setTimeout(() => {
        const ctx2 = new (window.AudioContext || window.webkitAudioContext)();
        const osc2 = ctx2.createOscillator();
        const gain2 = ctx2.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx2.destination);
        osc2.frequency.value = 800;
        osc2.type = 'sine';
        gain2.gain.value = 0.3;
        osc2.start();
        setTimeout(() => { osc2.stop(); ctx2.close(); }, 150);
      }, 200);
    } catch (e) {
      console.log('Audio not supported');
    }
  };

  // Poll for notifications every 1 minute
  useEffect(() => {
    const checkNotifications = async () => {
      try {
        // Check for new announcements
        const annRes = await axios.get(`${API}/announcements`);
        const announcements = annRes.data;
        const activeCount = announcements.length;
        
        if (lastAnnouncementCheck !== null && activeCount > lastAnnouncementCheck) {
          playNotificationSound();
          const newAnn = announcements[0];
          toast.info(
            <div>
              <p className="font-bold">📢 New Announcement</p>
              <p className="text-sm">{newAnn?.title || 'Check announcements'}</p>
            </div>,
            {
              duration: 8000,
              action: {
                label: "View",
                onClick: () => navigate("/portal/announcements")
              }
            }
          );
        }
        setNewAnnouncementCount(activeCount);
        setLastAnnouncementCheck(activeCount);

        // Check for resolved tickets
        const ticketRes = await axios.get(`${API}/tickets`);
        const tickets = ticketRes.data;
        
        tickets.forEach(ticket => {
          const prevState = lastTicketStates[ticket.id];
          if (prevState && prevState !== 'resolved' && ticket.status === 'resolved') {
            playNotificationSound();
            toast.success(
              <div>
                <p className="font-bold">✅ Ticket Resolved</p>
                <p className="text-sm">"{ticket.subject}" has been resolved</p>
              </div>,
              {
                duration: 8000,
                action: {
                  label: "View",
                  onClick: () => navigate("/portal/tickets")
                }
              }
            );
          }
        });
        
        // Update ticket states
        const newStates = {};
        tickets.forEach(t => { newStates[t.id] = t.status; });
        setLastTicketStates(newStates);
        
      } catch (error) {
        console.error('Notification check failed:', error);
      }
    };

    // Initial check after 2 seconds (to let page load first)
    const initialTimeout = setTimeout(checkNotifications, 2000);
    
    // Poll every 1 minute
    const interval = setInterval(checkNotifications, 60000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [lastAnnouncementCheck, lastTicketStates, navigate]);

  // Close sidebar on mobile when route changes
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    navigate("/");
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
      await changePassword(passwords.current, passwords.new);
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
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 w-64 bg-[#2E375B] text-white transition-transform duration-300 ease-in-out flex flex-col",
          "lg:translate-x-0 lg:h-screen",
          "h-[calc(100vh-56px)] top-14 lg:top-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        data-testid="member-sidebar"
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

        {/* Member Info - Above Navigation */}
        <div className="px-4 py-3 border-b border-white/10">
          <div className="bg-white/10 rounded-lg p-3">
            <p className="font-semibold text-sm truncate text-white">{member?.name}</p>
            <p className="text-xs text-white/60 truncate">{member?.company_name}</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = item.exact 
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path) && location.pathname !== "/portal";
            const isAnnouncements = item.path === "/portal/announcements";
            return (
              <NavLink
                key={item.path}
                to={item.path}
                data-testid={`member-nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 relative",
                  isActive 
                    ? "bg-[#FFA14A] text-[#2E375B] font-medium" 
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
                onClick={() => {
                  if (isAnnouncements) setNewAnnouncementCount(0);
                }}
              >
                <item.icon className="w-5 h-5" strokeWidth={1.5} />
                <span className="text-sm">{item.label}</span>
                {isAnnouncements && newAnnouncementCount > 0 && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center animate-pulse">
                    {newAnnouncementCount}
                  </span>
                )}
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

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-[#2E375B] z-30 flex items-center px-4 gap-3">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-white p-2 hover:bg-white/10 rounded-lg"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <img 
          src="https://customer-assets.emergentagent.com/job_683f7dfb-7860-4882-8d93-58ac3f0439b2/artifacts/jqltfue2_Gemini_Generated_Image_xy33ixy33ixy33ix.png" 
          alt="Thryve" 
          className="h-8"
        />
        {newAnnouncementCount > 0 && (
          <div className="ml-auto flex items-center gap-2 text-white">
            <Bell className="w-5 h-5 text-amber-400 animate-pulse" />
            <span className="bg-red-500 text-xs font-bold px-2 py-0.5 rounded-full">{newAnnouncementCount}</span>
          </div>
        )}
      </div>

      {/* Main Content */}
      <main 
        className={cn(
          "flex-1 flex flex-col min-h-screen transition-all duration-300",
          "pt-14 lg:pt-0",
          "lg:ml-64"
        )}
      >
        {/* Top Bar - Matching Admin */}
        <header className="sticky top-0 z-30 bg-white border-b border-[#2E375B]/10 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-[#2E375B] hover:bg-[#2E375B]/10"
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
              <div>
                <h2 className="text-lg font-semibold text-[#2E375B] font-[Manrope]">Member Portal</h2>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 hover:bg-[#2E375B]/10">
                    <div className="w-8 h-8 rounded-full bg-[#2E375B] flex items-center justify-center">
                      <UserCircle className="w-5 h-5 text-white" />
                    </div>
                    <span className="hidden md:inline text-sm font-medium text-[#2E375B]">{member?.name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium text-[#2E375B]">{member?.name}</p>
                    <p className="text-xs text-[#2E375B]/60">{member?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setPasswordDialogOpen(true)} className="cursor-pointer">
                    <Key className="w-4 h-4 mr-2" />
                    Change Password
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600">
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6 md:p-8 flex-1">
          <Outlet />
        </div>
      </main>

      {/* Change Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#2E375B]">Change Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[#2E375B]">Current Password</Label>
              <Input
                type="password"
                value={passwords.current}
                onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                className="border-[#2E375B]/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#2E375B]">New Password</Label>
              <Input
                type="password"
                value={passwords.new}
                onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                className="border-[#2E375B]/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#2E375B]">Confirm New Password</Label>
              <Input
                type="password"
                value={passwords.confirm}
                onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                className="border-[#2E375B]/20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)} className="border-[#2E375B]/20 text-[#2E375B]">
              Cancel
            </Button>
            <Button 
              className="bg-[#2E375B] hover:bg-[#232B47]"
              onClick={handleChangePassword}
              disabled={changingPassword}
            >
              {changingPassword ? "Changing..." : "Change Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
