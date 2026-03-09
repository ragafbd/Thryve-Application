import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { 
  FileText, CalendarDays, Ticket, CreditCard, Clock, CheckCircle, 
  AlertTriangle, ArrowRight, Building2
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [invRes, bookRes, tickRes, annRes] = await Promise.all([
          axios.get(`${API}/invoices`),
          axios.get(`${API}/bookings?upcoming_only=true`),
          axios.get(`${API}/tickets`),
          axios.get(`${API}/announcements`)
        ]);
        setInvoices(invRes.data);
        setBookings(bookRes.data);
        setTickets(tickRes.data);
        setAnnouncements(annRes.data.slice(0, 3));
        refreshProfile(); // Refresh credits info
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const pendingInvoices = invoices.filter(i => i.status === 'pending' || i.status === 'overdue');
  const openTickets = tickets.filter(t => t.status === 'open' || t.status === 'in_progress');
  const creditsRemaining = (member?.meeting_room_credits || 0) - (member?.credits_used || 0);

  return (
    <div className="space-y-6 animate-fade-in" data-testid="member-dashboard">
      {/* Welcome Header - Using brand colors */}
      <div className="bg-gradient-to-br from-[#2E375B] to-[#1a2038] rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold font-[Manrope]">Welcome, {member?.name}!</h1>
        <p className="text-white/70 mt-1">{member?.company_name} • {member?.plan_name}</p>
        <div className="flex items-center gap-6 mt-4">
          <div>
            <p className="text-3xl font-bold text-[#FFA14A]">{creditsRemaining}</p>
            <p className="text-xs text-white/60">Meeting Room Minutes</p>
          </div>
          {member?.seat_number && (
            <div className="border-l border-white/20 pl-6">
              <p className="text-xl font-bold">{member.seat_number}</p>
              <p className="text-xs text-white/60">Your Seat</p>
            </div>
          )}
        </div>
      </div>

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
