import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, Users, IndianRupee, PlusCircle, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Dashboard() {
  const [stats, setStats] = useState({ total_invoices: 0, total_clients: 0, total_revenue: 0 });
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
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
      title: "Total Invoices",
      value: stats.total_invoices,
      icon: FileText,
      color: "bg-[#064E3B]"
    },
    {
      title: "Total Clients",
      value: stats.total_clients,
      icon: Users,
      color: "bg-[#064E3B]"
    },
    {
      title: "Total Revenue",
      value: `₹${stats.total_revenue.toLocaleString('en-IN')}`,
      icon: IndianRupee,
      color: "bg-[#064E3B]"
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
                </div>
                <div className={`w-12 h-12 rounded-xl ${stat.color} flex items-center justify-center`}>
                  <stat.icon className="w-6 h-6 text-white" strokeWidth={1.5} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
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
