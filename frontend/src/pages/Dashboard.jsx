import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { 
  FileText, IndianRupee, ArrowRight, Clock, CheckCircle, 
  AlertTriangle, Building2, CreditCard, Cake, Gift, Video
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const StatusBadge = ({ status }) => {
  const config = {
    paid: { label: "Paid", className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" },
    pending: { label: "Pending", className: "bg-amber-100 text-amber-700 hover:bg-amber-100" },
    overdue: { label: "Overdue", className: "bg-red-100 text-red-700 hover:bg-red-100" }
  };
  const { label, className } = config[status] || config.pending;
  return <Badge className={className}>{label}</Badge>;
};

export default function Dashboard() {
  const [invoiceStats, setInvoiceStats] = useState({ 
    total_invoices: 0, 
    total_clients: 0, 
    total_revenue: 0,
    paid_count: 0,
    pending_count: 0,
    overdue_count: 0,
    pending_amount: 0,
    paid_amount: 0
  });
  const [managementStats, setManagementStats] = useState({
    total_companies: 0,
    active_companies: 0,
    total_seats: 0,
    total_members: 0,
    active_members: 0,
    todays_bookings: 0,
    monthly_revenue: 0,
    open_tickets: 0,
    active_announcements: 0
  });
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState([]);
  const [pendingCharges, setPendingCharges] = useState({ company_charges: [], guest_charges: [], total_pending: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      console.log("Dashboard: Fetching data from API:", API);
      try {
        // Check for overdue invoices first
        await axios.post(`${API}/invoices/check-overdue`).catch(() => {});
        
        // Fetch all data independently to prevent one failure from blocking others
        const [statsRes, invoicesRes, mgmtStatsRes, birthdaysRes, chargesRes] = await Promise.all([
          axios.get(`${API}/stats`).catch(e => { console.error("Stats error:", e); return { data: null, error: e }; }),
          axios.get(`${API}/invoices`).catch(e => { console.error("Invoices error:", e); return { data: [], error: e }; }),
          axios.get(`${API}/management/stats`).catch(e => { console.error("Management stats error:", e); return { data: null, error: e }; }),
          axios.get(`${API}/management/birthdays/upcoming?days=30`).catch(e => { console.error("Birthdays error:", e); return { data: [], error: e }; }),
          axios.get(`${API}/management/pending-charges`).catch(e => { console.error("Pending charges error:", e); return { data: null, error: e }; })
        ]);
        
        console.log("Dashboard: Management stats response:", mgmtStatsRes.data);
        
        if (statsRes.data && !statsRes.error) setInvoiceStats(statsRes.data);
        if (invoicesRes.data && !invoicesRes.error) setRecentInvoices(invoicesRes.data.slice(0, 5));
        if (mgmtStatsRes.data && !mgmtStatsRes.error) setManagementStats(mgmtStatsRes.data);
        if (birthdaysRes.data && !birthdaysRes.error) setUpcomingBirthdays(birthdaysRes.data);
        if (chargesRes.data && !chargesRes.error) setPendingCharges(chargesRes.data);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-8 animate-fade-in" data-testid="dashboard">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight font-[Manrope]">
            Thryve Coworking
          </h1>
          <p className="text-slate-600 mt-1">
            Manage your World
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Clock className="w-4 h-4" />
          {new Date().toLocaleDateString('en-IN', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workspace Stats */}
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-700 font-[Manrope] flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#2E375B]" />
              Workspace Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <p className="text-2xl font-bold text-[#2E375B]">{managementStats.active_companies || 0}</p>
                <p className="text-xs text-slate-500">Active Clients</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{managementStats.total_seats || 0}</p>
                <p className="text-xs text-slate-500">Total Seats</p>
              </div>
              <div className="text-center p-3 bg-[#FFA14A]/10 rounded-lg">
                <p className="text-2xl font-bold text-[#FFA14A]">₹{((managementStats.monthly_revenue || 0)/1000).toFixed(0)}k</p>
                <p className="text-xs text-slate-500">Monthly</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoice Stats */}
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-700 font-[Manrope] flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#FFA14A]" />
              Billing Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <p className="text-2xl font-bold text-[#2E375B]">₹{(invoiceStats.total_revenue/1000).toFixed(1)}k</p>
                <p className="text-xs text-slate-500">Total Revenue</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{invoiceStats.paid_count}</p>
                <p className="text-xs text-slate-500">Paid</p>
              </div>
              <div className="text-center p-3 bg-amber-50 rounded-lg">
                <p className="text-2xl font-bold text-amber-600">{invoiceStats.pending_count + invoiceStats.overdue_count}</p>
                <p className="text-xs text-slate-500">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#2E375B] flex items-center justify-center">
                <IndianRupee className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900 font-mono">
                  ₹{invoiceStats.total_revenue.toLocaleString('en-IN')}
                </p>
                <p className="text-xs text-slate-500">Total Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900 font-mono">
                  ₹{invoiceStats.paid_amount.toLocaleString('en-IN')}
                </p>
                <p className="text-xs text-slate-500">Collected</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900 font-mono">
                  ₹{invoiceStats.pending_amount.toLocaleString('en-IN')}
                </p>
                <p className="text-xs text-slate-500">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xl font-bold text-red-600 font-mono">{invoiceStats.overdue_count}</p>
                <p className="text-xs text-slate-500">Overdue Invoices</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Birthdays */}
      <div id="birthday-section">
        {upcomingBirthdays.length > 0 ? (
          <Card className="border border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="pb-2 bg-gradient-to-r from-pink-50 to-purple-50 border-b border-pink-100">
              <CardTitle className="text-base font-semibold text-slate-700 font-[Manrope] flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center">
                  <Cake className="w-4 h-4 text-white" />
                </div>
                <span>Upcoming Birthdays</span>
                <Badge className="ml-2 bg-pink-500 text-white">{upcomingBirthdays.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {upcomingBirthdays.map((member) => (
                  <div 
                    key={member.id} 
                    className={`flex items-center justify-between p-4 hover:bg-slate-50 transition-colors ${
                      member.is_today ? 'bg-gradient-to-r from-pink-50 to-purple-50' : ''
                    }`}
                    data-testid={`birthday-item-${member.id}`}
                  >
                    <div className="flex items-center gap-4">
                      {member.is_today ? (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center animate-pulse">
                          <Gift className="w-6 h-6 text-white" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-pink-100 to-purple-100 flex items-center justify-center">
                          <Cake className="w-6 h-6 text-purple-500" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className={`font-semibold ${member.is_today ? 'text-pink-700' : 'text-slate-800'}`}>
                            {member.name}
                          </p>
                          {member.is_today && (
                            <Badge className="bg-gradient-to-r from-pink-500 to-purple-500 text-white text-xs animate-bounce">
                              🎂 Today!
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-500">{member.company_name}</p>
                        {member.phone && (
                          <p className="text-xs text-slate-400 mt-0.5">📱 {member.phone}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-700">
                        {new Date(member.birthday_date).toLocaleDateString('en-IN', { 
                          weekday: 'short',
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </p>
                      <p className={`text-xs ${member.is_today ? 'text-pink-600 font-semibold' : 'text-slate-500'}`}>
                        {member.is_today ? `Turning ${member.turning_age} 🎉` : `In ${member.days_until} day${member.days_until > 1 ? 's' : ''}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 text-slate-500">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                  <Cake className="w-6 h-6 text-slate-400" />
                </div>
                <div>
                  <p className="font-medium text-slate-600">No Upcoming Birthdays</p>
                  <p className="text-sm">No member birthdays in the next 30 days</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pending Meeting Room Charges */}
      {pendingCharges.total_pending > 0 && (
        <Card className="border border-slate-200 shadow-sm bg-gradient-to-r from-amber-50 to-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-700 font-[Manrope] flex items-center gap-2">
              <Video className="w-5 h-5 text-amber-600" />
              Pending Meeting Room Charges
              <Badge className="bg-amber-500 text-white ml-2">
                ₹{pendingCharges.total_pending.toLocaleString('en-IN')}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Company charges */}
              {pendingCharges.company_charges.map((company) => (
                <div key={company.company_id} className="p-3 bg-white/80 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-slate-800">{company.company_name}</p>
                    <Badge className="bg-amber-100 text-amber-700">
                      ₹{company.total_amount.toLocaleString('en-IN')}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    {company.bookings.slice(0, 3).map((booking, idx) => (
                      <p key={idx} className="text-sm text-slate-500">
                        {booking.member_name} - {booking.room_name} ({booking.date}) - ₹{booking.amount}
                      </p>
                    ))}
                    {company.bookings.length > 3 && (
                      <p className="text-xs text-slate-400">+{company.bookings.length - 3} more bookings</p>
                    )}
                  </div>
                </div>
              ))}
              {/* Guest charges */}
              {pendingCharges.guest_charges.length > 0 && (
                <div className="p-3 bg-white/80 rounded-lg">
                  <p className="font-medium text-slate-800 mb-2">Guest Bookings</p>
                  {pendingCharges.guest_charges.slice(0, 3).map((guest, idx) => (
                    <p key={idx} className="text-sm text-slate-500">
                      {guest.guest_name} ({guest.guest_company || 'Walk-in'}) - ₹{guest.amount}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Invoices */}
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-slate-900 font-[Manrope]">
              Recent Invoices
            </CardTitle>
            <Link to="/invoices">
              <Button variant="ghost" className="text-[#2E375B] hover:text-[#232B47]">
                View All
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading...</div>
          ) : recentInvoices.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No invoices yet</p>
              <Link to="/create-invoice">
                <Button className="mt-4 bg-[#2E375B] hover:bg-[#232B47]">
                  Create Your First Invoice
                </Button>
              </Link>
            </div>
          ) : (
            <table className="w-full invoice-table">
              <thead>
                <tr className="bg-slate-50">
                  <th>Invoice #</th>
                  <th>Client</th>
                  <th>Date</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="font-mono text-sm text-[#2E375B]">
                      <Link 
                        to={`/invoices/${invoice.id}`}
                        className="hover:underline"
                        data-testid={`invoice-link-${invoice.invoice_number}`}
                      >
                        {invoice.invoice_number}
                      </Link>
                    </td>
                    <td className="text-slate-700">{invoice.client?.company_name}</td>
                    <td className="text-slate-500 font-mono text-sm">
                      {new Date(invoice.invoice_date).toLocaleDateString('en-IN')}
                    </td>
                    <td className="text-slate-500 font-mono text-sm">
                      {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-IN') : '-'}
                    </td>
                    <td>
                      <StatusBadge status={invoice.status} />
                    </td>
                    <td className="text-right font-mono font-medium text-slate-900">
                      ₹{invoice.grand_total?.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
