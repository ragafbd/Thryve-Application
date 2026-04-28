import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { 
  FileText, CalendarDays, Ticket, CreditCard, Clock, CheckCircle, 
  AlertTriangle, ArrowRight, Building2, Video, Timer
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMemberAuth } from "@/contexts/MemberAuthContext";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api/member`;

export default function MemberDashboard() {
  const { member, refreshProfile } = useMemberAuth();
  const [invoices, setInvoices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [pendingCharges, setPendingCharges] = useState([]);
  const [companyCredits, setCompanyCredits] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [invRes, bookRes, tickRes, annRes, chargesRes, creditsRes] = await Promise.all([
          axios.get(`${API}/invoices`),
          axios.get(`${API}/bookings?upcoming_only=true`),
          axios.get(`${API}/tickets`),
          axios.get(`${API}/announcements`),
          axios.get(`${API}/pending-charges`).catch(() => ({ data: [] })),
          axios.get(`${API}/company-credits`).catch(() => ({ data: null }))
        ]);
        setInvoices(invRes.data);
        setBookings(bookRes.data);
        setTickets(tickRes.data);
        setAnnouncements(annRes.data.slice(0, 3));
        setPendingCharges(chargesRes.data || []);
        setCompanyCredits(creditsRes.data);
        refreshProfile();
      } catch (error) {
        // Data fetch failed silently
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [refreshProfile]);

  const pendingInvoices = invoices.filter(i => i.status === 'pending' || i.status === 'overdue');
  const openTickets = tickets.filter(t => t.status === 'open' || t.status === 'in_progress');
  const creditsRemaining = companyCredits?.remaining_credits || member?.credits_remaining || 0;
  const totalCredits = companyCredits?.total_credits || member?.meeting_room_credits || 0;
  const creditsUsed = companyCredits?.credits_used || member?.credits_used || 0;
  const creditsPercentage = totalCredits > 0 ? Math.round((creditsRemaining / totalCredits) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in" data-testid="member-dashboard">
      {/* Welcome Header - Using brand colors */}
      <div className="bg-gradient-to-br from-[#2E375B] to-[#1a2038] rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold font-[Manrope]">Welcome, {member?.name}!</h1>
        <p className="text-white/70 mt-1">{member?.company_name} • {member?.plan_name}</p>
        <div className="flex items-center gap-6 mt-4">
          <div>
            <p className="text-3xl font-bold text-[#FFA14A]">{creditsRemaining.toLocaleString('en-IN')}</p>
            <p className="text-xs text-white/60">Balance Credits</p>
          </div>
          {member?.seat_number && (
            <div className="border-l border-white/20 pl-6">
              <p className="text-xl font-bold">{member.seat_number}</p>
              <p className="text-xs text-white/60">Your Seat</p>
            </div>
          )}
        </div>
      </div>

      {/* Meeting Room Credits Card - Credit-Based System */}
      {totalCredits > 0 && (
        <Card className="border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50" data-testid="credits-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-[#2E375B]">
              <Timer className="w-5 h-5 text-blue-600" />
              Company Meeting Room Credits
              <span className="text-xs font-normal text-blue-500 ml-2">(1 Credit = Rs. 50)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 bg-white/80 rounded-lg">
                <p className="text-2xl font-bold text-[#2E375B]">{totalCredits}</p>
                <p className="text-xs text-[#2E375B]/60">Total Credits</p>
              </div>
              <div className="text-center p-3 bg-white/80 rounded-lg">
                <p className="text-2xl font-bold text-orange-600">{creditsUsed}</p>
                <p className="text-xs text-[#2E375B]/60">Credits Used</p>
              </div>
              <div className="text-center p-3 bg-white/80 rounded-lg">
                <p className={`text-2xl font-bold ${creditsRemaining > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {creditsRemaining}
                </p>
                <p className="text-xs text-[#2E375B]/60">Credits Remaining</p>
              </div>
            </div>
            {/* Credit costs info */}
            <div className="text-xs font-semibold text-[#2E375B]/70 mb-2 bg-white/50 p-2 rounded text-center">
              <div>Conference Room: Rs. 1000 OR 20 credits for 60 minutes or part of</div>
              <div>Meeting Room: Rs. 250 OR 5 credits for 30 minutes or part of</div>
            </div>
            {/* Progress bar */}
            <div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${
                    creditsPercentage > 50 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                    creditsPercentage > 20 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                    'bg-gradient-to-r from-red-500 to-rose-500'
                  }`}
                  style={{ width: `${creditsPercentage}%` }}
                />
              </div>
              <p className="text-xs text-[#2E375B]/50 mt-1 text-right">{creditsPercentage}% remaining</p>
            </div>
            {companyCredits?.member_credits_used !== undefined && (
              <p className="text-xs text-[#2E375B]/60 mt-2">
                Your usage: {companyCredits.member_credits_used} credits
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border border-[#2E375B]/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#2E375B] flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#2E375B]">{invoices.length}</p>
                <p className="text-xs text-[#2E375B]/60">Total Invoices</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-[#2E375B]/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FFA14A] flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#2E375B]">{pendingInvoices.length}</p>
                <p className="text-xs text-[#2E375B]/60">Pending Payments</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-[#2E375B]/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#2E375B] flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#2E375B]">{bookings.length}</p>
                <p className="text-xs text-[#2E375B]/60">Upcoming Bookings</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-[#2E375B]/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FFA14A] flex items-center justify-center">
                <Ticket className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#2E375B]">{openTickets.length}</p>
                <p className="text-xs text-[#2E375B]/60">Open Tickets</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Meeting Room Charges - Only show if there are pending charges */}
      {pendingCharges.length > 0 && (
        <Card className="border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-amber-800">
              <Video className="w-5 h-5" />
              Pending Meeting Room Charges
              <Badge className="bg-amber-500 text-white ml-2">
                ₹{pendingCharges.reduce((sum, c) => sum + c.amount, 0).toLocaleString('en-IN')}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-700 mb-3">
              These charges will be added to your next invoice.
            </p>
            <div className="space-y-2">
              {pendingCharges.map((charge, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white/80 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-800">{charge.room_name}</p>
                    <p className="text-xs text-slate-500">
                      {charge.date} • {charge.start_time} - {charge.end_time}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-semibold text-amber-700">₹{charge.amount.toLocaleString('en-IN')}</p>
                    <Badge className="text-xs bg-amber-100 text-amber-700">{charge.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <Card className="border border-[#2E375B]/10">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-[#2E375B]">
                <FileText className="w-5 h-5" />
                Recent Invoices
              </CardTitle>
              <Link to="/portal/invoices">
                <Button variant="ghost" size="sm" className="text-[#FFA14A] hover:text-[#e8893a]">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-[#2E375B]/60 text-sm">Loading...</p>
            ) : invoices.length === 0 ? (
              <p className="text-[#2E375B]/60 text-sm">No invoices yet</p>
            ) : (
              <div className="space-y-3">
                {invoices.slice(0, 5).map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between p-3 bg-[#2E375B]/5 rounded-lg">
                    <div>
                      <p className="font-mono text-sm font-medium text-[#2E375B]">{invoice.invoice_number}</p>
                      <p className="text-xs text-[#2E375B]/60">{new Date(invoice.invoice_date).toLocaleDateString('en-IN')}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-semibold text-[#2E375B]">₹{invoice.grand_total?.toLocaleString('en-IN')}</p>
                      <Badge className={
                        invoice.status === 'paid' ? 'bg-green-100 text-green-700' :
                        invoice.status === 'overdue' ? 'bg-red-100 text-red-700' :
                        'bg-[#FFA14A]/20 text-[#FFA14A]'
                      }>
                        {invoice.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Bookings */}
        <Card className="border border-[#2E375B]/10">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-[#2E375B]">
                <CalendarDays className="w-5 h-5" />
                Upcoming Bookings
              </CardTitle>
              <Link to="/portal/bookings">
                <Button variant="ghost" size="sm" className="text-[#FFA14A] hover:text-[#e8893a]">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-[#2E375B]/60 text-sm">Loading...</p>
            ) : bookings.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-[#2E375B]/60 text-sm">No upcoming bookings</p>
                <Link to="/portal/bookings">
                  <Button size="sm" className="mt-2 bg-[#2E375B] hover:bg-[#232B47]">
                    Book a Room
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.slice(0, 5).map((booking) => (
                  <div key={booking.id} className="flex items-center justify-between p-3 bg-[#2E375B]/5 rounded-lg">
                    <div>
                      <p className="font-medium text-sm text-[#2E375B]">{booking.room_name}</p>
                      <p className="text-xs text-[#2E375B]/60">{booking.date} • {booking.start_time} - {booking.end_time}</p>
                    </div>
                    <Badge className="bg-[#FFA14A]/20 text-[#FFA14A]">{booking.duration_minutes} min</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Announcements */}
      {announcements.length > 0 && (
        <Card className="border border-[#2E375B]/10">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-[#2E375B]">
                <Building2 className="w-5 h-5" />
                Community Announcements
              </CardTitle>
              <Link to="/portal/announcements">
                <Button variant="ghost" size="sm" className="text-[#FFA14A] hover:text-[#e8893a]">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {announcements.map((ann) => (
                <div key={ann.id} className={`p-3 rounded-lg ${ann.is_pinned ? 'bg-[#FFA14A]/10 border border-[#FFA14A]/30' : 'bg-[#2E375B]/5'}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm text-[#2E375B]">{ann.title}</p>
                      <p className="text-xs text-[#2E375B]/60 mt-1 line-clamp-2">{ann.content}</p>
                    </div>
                    {ann.is_pinned && <Badge className="bg-[#FFA14A] text-white">Pinned</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
