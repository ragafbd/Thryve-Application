import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, Search, Trash2, Eye, PlusCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function InvoiceList() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const fetchInvoices = async () => {
    try {
      const response = await axios.get(`${API}/invoices`);
      setInvoices(response.data);
    } catch (error) {
      toast.error("Failed to fetch invoices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const filteredInvoices = invoices.filter(invoice =>
    invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    invoice.client?.company_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async () => {
    if (!selectedInvoice) return;
    
    try {
      await axios.delete(`${API}/invoices/${selectedInvoice.id}`);
      toast.success("Invoice deleted successfully");
      setDeleteDialogOpen(false);
      setSelectedInvoice(null);
      fetchInvoices();
    } catch (error) {
      toast.error("Failed to delete invoice");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="invoices-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight font-[Manrope]">
            Invoices
          </h1>
          <p className="text-slate-600 mt-1">
            View and manage all your invoices
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

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search by invoice number or client..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-white border-slate-200"
          data-testid="invoice-search-input"
        />
      </div>

      {/* Invoices Table */}
      <Card className="border border-slate-200 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading invoices...</div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">
                {searchQuery ? "No invoices found matching your search" : "No invoices yet"}
              </p>
              {!searchQuery && (
                <Link to="/create-invoice">
                  <Button className="mt-4 bg-[#064E3B] hover:bg-[#022C22]">
                    Create Your First Invoice
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full invoice-table">
                <thead>
                  <tr className="bg-slate-50">
                    <th>Invoice #</th>
                    <th>Client</th>
                    <th>Date</th>
                    <th className="text-right">Subtotal</th>
                    <th className="text-right">Tax</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((invoice, index) => (
                    <tr 
                      key={invoice.id}
                      className="animate-fade-in"
                      style={{ animationDelay: `${index * 0.03}s` }}
                      data-testid={`invoice-row-${invoice.id}`}
                    >
                      <td className="font-mono text-sm">
                        <Link 
                          to={`/invoices/${invoice.id}`}
                          className="text-[#064E3B] hover:underline font-medium"
                          data-testid={`invoice-link-${invoice.id}`}
                        >
                          {invoice.invoice_number}
                        </Link>
                      </td>
                      <td className="text-slate-700">
                        {invoice.client?.company_name}
                      </td>
                      <td className="text-slate-500 font-mono text-sm">
                        {new Date(invoice.invoice_date).toLocaleDateString('en-IN')}
                      </td>
                      <td className="text-right font-mono text-slate-600">
                        ₹{invoice.subtotal?.toLocaleString('en-IN')}
                      </td>
                      <td className="text-right font-mono text-slate-500 text-sm">
                        ₹{invoice.total_tax?.toLocaleString('en-IN')}
                      </td>
                      <td className="text-right font-mono font-semibold text-slate-900">
                        ₹{invoice.grand_total?.toLocaleString('en-IN')}
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link to={`/invoices/${invoice.id}`}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500 hover:text-[#064E3B]"
                              data-testid={`view-invoice-${invoice.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-red-600"
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setDeleteDialogOpen(true);
                            }}
                            data-testid={`delete-invoice-${invoice.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {filteredInvoices.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border border-slate-200">
            <CardContent className="p-4">
              <p className="text-sm text-slate-500">Total Invoices</p>
              <p className="text-2xl font-bold text-slate-900 font-mono">
                {filteredInvoices.length}
              </p>
            </CardContent>
          </Card>
          <Card className="border border-slate-200">
            <CardContent className="p-4">
              <p className="text-sm text-slate-500">Total Tax Collected</p>
              <p className="text-2xl font-bold text-slate-900 font-mono">
                ₹{filteredInvoices.reduce((sum, inv) => sum + (inv.total_tax || 0), 0).toLocaleString('en-IN')}
              </p>
            </CardContent>
          </Card>
          <Card className="border border-slate-200">
            <CardContent className="p-4">
              <p className="text-sm text-slate-500">Total Revenue</p>
              <p className="text-2xl font-bold text-[#064E3B] font-mono">
                ₹{filteredInvoices.reduce((sum, inv) => sum + (inv.grand_total || 0), 0).toLocaleString('en-IN')}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete invoice "{selectedInvoice?.invoice_number}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
              data-testid="confirm-delete-invoice"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
