import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, Users, IndianRupee, PlusCircle, ArrowRight, Clock, CheckCircle, AlertTriangle } from "lucide-react";
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
  const [stats, setStats] = useState({ 
    total_invoices: 0, 
    total_clients: 0, 
    total_revenue: 0,
    paid_count: 0,
    pending_count: 0,
    overdue_count: 0,
    pending_amount: 0,
    paid_amount: 0
  });
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Check for overdue invoices first
        await axios.post(`${API}/invoices/check-overdue`);
        
        const [statsRes, invoicesRes] = await Promise.all([
          axios.get(`${API}/stats`),
          axios.get(`${API}/invoices`)
        ]);
        setStats(statsRes.data);
        setRecentInvoices(invoicesRes.data.slice(0, 5));
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const statCards = [
    {
      title: "Total Revenue",
      value: `₹${stats.total_revenue.toLocaleString('en-IN')}`,
      icon: IndianRupee,
      color: "bg-[#064E3B]"
    },
    {
      title: "Paid",
      value: `₹${stats.paid_amount.toLocaleString('en-IN')}`,
      subtitle: `${stats.paid_count} invoices`,
      icon: CheckCircle,
      color: "bg-emerald-600"
    },
    {
      title: "Pending",
      value: `₹${stats.pending_amount.toLocaleString('en-IN')}`,
      subtitle: `${stats.pending_count + stats.overdue_count} invoices`,
      icon: Clock,
      color: "bg-amber-500"
    }
  ];

  return (
    <div className="space-y-8 animate-fade-in" data-testid="dashboard">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight font-[Manrope]">
            Dashboard
          </h1>
          <p className="text-slate-600 mt-1">
            Welcome to Thryve Invoice Generator
          </p>
        </div>
        <Link to="/create-invoice">
          <Button 
            className="bg-[#064E3B] hover:bg-[#022C22] text-white"
            data-testid="create-invoice-btn"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            Create Invoice
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statCards.map((stat, index) => (
          <Card 
            key={stat.title} 
            className="border border-slate-200 shadow-sm card-hover"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-bold text-slate-900 mt-2 font-mono">
                    {loading ? "..." : stat.value}
                  </p>
                  {stat.subtitle && (
                    <p className="text-xs text-slate-400 mt-1">{stat.subtitle}</p>
                  )}
                </div>
                <div className={`w-12 h-12 rounded-xl ${stat.color} flex items-center justify-center`}>
                  <stat.icon className="w-6 h-6 text-white" strokeWidth={1.5} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border border-slate-200">
          <CardContent className="p-4 flex items-center gap-3">
            <FileText className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-2xl font-bold text-slate-900 font-mono">{stats.total_invoices}</p>
              <p className="text-xs text-slate-500">Total Invoices</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-slate-200">
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-2xl font-bold text-slate-900 font-mono">{stats.total_clients}</p>
              <p className="text-xs text-slate-500">Total Clients</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-slate-200">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
            <div>
              <p className="text-2xl font-bold text-emerald-600 font-mono">{stats.paid_count}</p>
              <p className="text-xs text-slate-500">Paid Invoices</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-slate-200">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <div>
              <p className="text-2xl font-bold text-red-600 font-mono">{stats.overdue_count}</p>
              <p className="text-xs text-slate-500">Overdue</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Invoices */}
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-slate-900 font-[Manrope]">
              Recent Invoices
            </CardTitle>
            <Link to="/invoices">
              <Button variant="ghost" className="text-[#064E3B] hover:text-[#022C22]">
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
                <Button className="mt-4 bg-[#064E3B] hover:bg-[#022C22]">
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
                    <td className="font-mono text-sm text-[#064E3B]">
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
