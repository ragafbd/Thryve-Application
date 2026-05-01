import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IndianRupee, Building2, Users, CalendarCheck, TrendingUp, AlertTriangle } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const [invoices, companies, bookings, rooms] = await Promise.all([
          axios.get(`${API}/invoices`).then(r => r.data).catch(() => []),
          axios.get(`${API}/companies`).then(r => r.data).catch(() => []),
          axios.get(`${API}/bookings`).then(r => r.data).catch(() => []),
          axios.get(`${API}/management/rooms`).then(r => r.data).catch(() => []),
        ]);

        const totalRevenue = invoices.filter(i => i.status === "paid").reduce((s, i) => s + (i.grand_total || 0), 0);
        const totalOverdue = invoices.filter(i => i.status === "overdue").reduce((s, i) => s + (i.grand_total || 0), 0);
        const totalPending = invoices.filter(i => i.status === "pending").reduce((s, i) => s + (i.grand_total || 0), 0);
        const activeCompanies = companies.filter(c => c.status === "active");
        const totalSeats = activeCompanies.reduce((s, c) => s + (c.total_seats || 0), 0);

        // Monthly revenue breakdown
        const monthlyRevenue = {};
        invoices.filter(i => i.status === "paid").forEach(inv => {
          const month = inv.billing_month || inv.invoice_date?.slice(0, 7) || "unknown";
          monthlyRevenue[month] = (monthlyRevenue[month] || 0) + (inv.grand_total || 0);
        });

        // Room usage
        const roomUsage = {};
        bookings.filter(b => b.status !== "cancelled").forEach(b => {
          const room = b.room_name || b.room_display_name || "Unknown";
          roomUsage[room] = (roomUsage[room] || 0) + 1;
        });

        // Plan distribution
        const planDist = {};
        activeCompanies.forEach(c => {
          const plan = c.plan_name || "Unknown";
          planDist[plan] = (planDist[plan] || 0) + 1;
        });

        setData({
          totalRevenue, totalOverdue, totalPending,
          totalInvoices: invoices.length,
          paidInvoices: invoices.filter(i => i.status === "paid").length,
          overdueInvoices: invoices.filter(i => i.status === "overdue").length,
          activeCompanies: activeCompanies.length,
          totalSeats,
          totalBookings: bookings.filter(b => b.status !== "cancelled").length,
          monthlyRevenue: Object.entries(monthlyRevenue).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6),
          roomUsage: Object.entries(roomUsage).sort((a, b) => b[1] - a[1]),
          planDist: Object.entries(planDist).sort((a, b) => b[1] - a[1]),
        });
      } catch (e) {
        // Failed silently
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-slate-500">Loading analytics...</p></div>;
  if (!data) return <div className="p-4 text-red-500">Failed to load analytics</div>;

  return (
    <div className="space-y-6" data-testid="analytics-dashboard">
      <h1 className="text-2xl font-bold text-slate-900 font-[Manrope]">Analytics Dashboard</h1>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-emerald-600 mb-1">
              <IndianRupee className="w-4 h-4" />
              <span className="text-xs font-medium">Revenue Collected</span>
            </div>
            <p className="text-xl font-bold text-slate-900">₹{data.totalRevenue.toLocaleString('en-IN')}</p>
            <p className="text-xs text-slate-500">{data.paidInvoices} invoices paid</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs font-medium">Overdue</span>
            </div>
            <p className="text-xl font-bold text-slate-900">₹{data.totalOverdue.toLocaleString('en-IN')}</p>
            <p className="text-xs text-slate-500">{data.overdueInvoices} invoices overdue</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <Building2 className="w-4 h-4" />
              <span className="text-xs font-medium">Active Clients</span>
            </div>
            <p className="text-xl font-bold text-slate-900">{data.activeCompanies}</p>
            <p className="text-xs text-slate-500">{data.totalSeats} total seats</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-600 mb-1">
              <CalendarCheck className="w-4 h-4" />
              <span className="text-xs font-medium">Total Bookings</span>
            </div>
            <p className="text-xl font-bold text-slate-900">{data.totalBookings}</p>
            <p className="text-xs text-slate-500">meeting room bookings</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue & Details */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Monthly Revenue */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Monthly Revenue (Paid)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.monthlyRevenue.length === 0 ? (
              <p className="text-sm text-slate-500">No revenue data yet</p>
            ) : (
              <div className="space-y-2">
                {data.monthlyRevenue.map(([month, amount]) => (
                  <div key={month} className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">{month}</span>
                    <span className="text-sm font-semibold text-slate-900">₹{amount.toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Room Usage */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-blue-600" />
              Room Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.roomUsage.length === 0 ? (
              <p className="text-sm text-slate-500">No bookings yet</p>
            ) : (
              <div className="space-y-2">
                {data.roomUsage.map(([room, count]) => (
                  <div key={room} className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">{room}</span>
                    <Badge variant="secondary">{count} bookings</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plan Distribution */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-600" />
              Client Plan Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.planDist.map(([plan, count]) => (
                <div key={plan} className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">{plan}</span>
                  <Badge variant="outline">{count} clients</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Payment Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-slate-600" />
              Payment Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Total Invoiced</span>
                <span className="text-sm font-semibold">₹{(data.totalRevenue + data.totalOverdue + data.totalPending).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-emerald-600">Collected</span>
                <span className="text-sm font-semibold text-emerald-600">₹{data.totalRevenue.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-amber-600">Pending</span>
                <span className="text-sm font-semibold text-amber-600">₹{data.totalPending.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-red-600">Overdue</span>
                <span className="text-sm font-semibold text-red-600">₹{data.totalOverdue.toLocaleString('en-IN')}</span>
              </div>
              <div className="border-t pt-2 flex justify-between items-center">
                <span className="text-sm font-medium text-slate-700">Collection Rate</span>
                <span className="text-sm font-bold text-slate-900">
                  {data.totalInvoices > 0 ? Math.round((data.paidInvoices / data.totalInvoices) * 100) : 0}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
