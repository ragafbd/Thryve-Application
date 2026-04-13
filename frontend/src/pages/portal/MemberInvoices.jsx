import { useEffect, useState } from "react";
import { FileText, Download, Eye, Search, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const StatusBadge = ({ status }) => {
  const config = {
    paid: { label: "Paid", className: "bg-green-100 text-green-700" },
    pending: { label: "Pending", className: "bg-amber-100 text-amber-700" },
    overdue: { label: "Overdue", className: "bg-red-100 text-red-700" }
  };
  const { label, className } = config[status] || config.pending;
  return <Badge className={className}>{label}</Badge>;
};

export default function MemberInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const response = await axios.get(`${API}/member/invoices`);
        setInvoices(response.data);
      } catch (error) {
        // silenced
      } finally {
        setLoading(false);
      }
    };
    fetchInvoices();
  }, []);

  const handleDownloadPDF = async (invoice) => {
    try {
      const response = await axios.get(`${API}/invoices/${invoice.id}/pdf`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${invoice.invoice_number.replace(/\//g, '-')}_${invoice.client?.company_name || 'Invoice'}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      // silenced
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.invoice_number.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalAmount = invoices.reduce((sum, i) => sum + (i.grand_total || 0), 0);
  const paidAmount = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.grand_total || 0), 0);
  const pendingAmount = invoices.filter(i => i.status !== 'paid').reduce((sum, i) => sum + (i.grand_total || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in" data-testid="member-invoices">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 font-[Manrope]">My Invoices</h1>
        <p className="text-slate-600 mt-1">View and download your invoices</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border border-slate-200">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-[#2E375B] font-mono">₹{totalAmount.toLocaleString('en-IN')}</p>
            <p className="text-xs text-slate-500">Total Billed</p>
          </CardContent>
        </Card>
        <Card className="border border-slate-200">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600 font-mono">₹{paidAmount.toLocaleString('en-IN')}</p>
            <p className="text-xs text-slate-500">Paid</p>
          </CardContent>
        </Card>
        <Card className="border border-slate-200">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600 font-mono">₹{pendingAmount.toLocaleString('en-IN')}</p>
            <p className="text-xs text-slate-500">Pending</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by invoice number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Invoices List */}
      <Card className="border border-slate-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading invoices...</div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p>No invoices found</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredInvoices.map((invoice) => (
                <div key={invoice.id} className="p-4 hover:bg-slate-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <p className="font-mono font-semibold text-[#2E375B]">{invoice.invoice_number}</p>
                        <StatusBadge status={invoice.status} />
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                        <span>Date: {new Date(invoice.invoice_date).toLocaleDateString('en-IN')}</span>
                        {invoice.due_date && (
                          <span>Due: {new Date(invoice.due_date).toLocaleDateString('en-IN')}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right mr-4">
                      <p className="text-xl font-bold font-mono text-slate-900">
                        ₹{invoice.grand_total?.toLocaleString('en-IN')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedInvoice(invoice);
                          setViewDialogOpen(true);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        className="bg-[#FFA14A] hover:bg-[#e8893a]"
                        onClick={() => handleDownloadPDF(invoice)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice Detail Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono">{selectedInvoice?.invoice_number}</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Invoice Date</p>
                  <p className="font-medium">{new Date(selectedInvoice.invoice_date).toLocaleDateString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-slate-500">Due Date</p>
                  <p className="font-medium">{selectedInvoice.due_date ? new Date(selectedInvoice.due_date).toLocaleDateString('en-IN') : '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Status</p>
                  <StatusBadge status={selectedInvoice.status} />
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-3">Description</th>
                      <th className="text-right p-3">Qty</th>
                      <th className="text-right p-3">Rate</th>
                      <th className="text-right p-3">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoice.items?.map((item, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-3">{item.description}</td>
                        <td className="p-3 text-right">{item.quantity}</td>
                        <td className="p-3 text-right font-mono">₹{item.rate?.toLocaleString('en-IN')}</td>
                        <td className="p-3 text-right font-mono">₹{item.amount?.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span className="font-mono">₹{selectedInvoice.subtotal?.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>CGST (9%)</span>
                  <span className="font-mono">₹{selectedInvoice.cgst?.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>SGST (9%)</span>
                  <span className="font-mono">₹{selectedInvoice.sgst?.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total</span>
                  <span className="font-mono">₹{selectedInvoice.grand_total?.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <Button 
                className="w-full bg-[#FFA14A] hover:bg-[#e8893a]"
                onClick={() => handleDownloadPDF(selectedInvoice)}
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
