import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Download, Printer, Trash2, CheckCircle, Clock, AlertTriangle, FileDown, Edit, X, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import axios from "axios";
import InvoicePreview from "@/components/InvoicePreview";
import { useReactToPrint } from "react-to-print";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const StatusBadge = ({ status }) => {
  const config = {
    paid: { label: "Paid", icon: CheckCircle, className: "bg-emerald-100 text-emerald-700" },
    pending: { label: "Pending", icon: Clock, className: "bg-amber-100 text-amber-700" },
    overdue: { label: "Overdue", icon: AlertTriangle, className: "bg-red-100 text-red-700" }
  };
  const { label, icon: Icon, className } = config[status] || config.pending;
  return (
    <Badge className={`${className} flex items-center gap-1.5 px-3 py-1`}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </Badge>
  );
};

export default function InvoiceView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const printRef = useRef(null);
  
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState([]);
  const [editForm, setEditForm] = useState({
    client_id: "",
    due_date: "",
    notes: "",
    line_items: []
  });

  const serviceTypes = [
    { value: "workspace", label: "Workspace/Cabin Rent" },
    { value: "meeting_room", label: "Meeting Room" },
    { value: "deposit", label: "Security Deposit" },
    { value: "setup", label: "Setup Charges" },
    { value: "other", label: "Other Services" }
  ];

  const fetchInvoice = async () => {
    try {
      const response = await axios.get(`${API}/invoices/${id}`);
      setInvoice(response.data);
    } catch (error) {
      toast.error("Invoice not found");
      navigate("/admin/invoices");
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const response = await axios.get(`${API}/companies`);
      setClients(response.data);
    } catch (error) {
      console.error("Failed to fetch clients:", error);
    }
  };

  useEffect(() => {
    fetchInvoice();
    fetchClients();
  }, [id]);

  const openEditDialog = () => {
    if (invoice) {
      setEditForm({
        client_id: invoice.client?.id || "",
        due_date: invoice.due_date || "",
        notes: invoice.notes || "",
        line_items: invoice.line_items?.map(item => ({
          description: item.description || "",
          service_type: item.service_type || "workspace",
          quantity: item.quantity || 1,
          rate: item.rate || 0,
          is_taxable: item.is_taxable !== false
        })) || []
      });
      setEditDialogOpen(true);
    }
  };

  const handleAddLineItem = () => {
    setEditForm({
      ...editForm,
      line_items: [
        ...editForm.line_items,
        { description: "", service_type: "workspace", quantity: 1, rate: 0, is_taxable: true }
      ]
    });
  };

  const handleRemoveLineItem = (index) => {
    setEditForm({
      ...editForm,
      line_items: editForm.line_items.filter((_, i) => i !== index)
    });
  };

  const handleLineItemChange = (index, field, value) => {
    const updated = [...editForm.line_items];
    updated[index] = { ...updated[index], [field]: value };
    setEditForm({ ...editForm, line_items: updated });
  };

  const handleSaveEdit = async () => {
    if (editForm.line_items.length === 0) {
      toast.error("Please add at least one line item");
      return;
    }

    setSaving(true);
    try {
      await axios.put(`${API}/invoices/${id}`, {
        client_id: editForm.client_id || undefined,
        due_date: editForm.due_date || undefined,
        notes: editForm.notes,
        line_items: editForm.line_items
      });
      toast.success("Invoice updated successfully");
      setEditDialogOpen(false);
      fetchInvoice(); // Refresh
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update invoice");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: invoice ? `Invoice-${invoice.invoice_number}` : 'Invoice',
    onAfterPrint: () => toast.success("Invoice printed/saved as PDF"),
  });

  const handleDownloadPDF = async () => {
    try {
      const response = await axios.get(`${API}/invoices/${id}/pdf`, {
        responseType: 'blob'
      });
      
      // Get filename from invoice number and client name
      const invoiceNum = invoice.invoice_number.replace(/\//g, '-');
      const clientName = invoice.client?.company_name?.replace(/\s+/g, '_').replace(/[\/\\]/g, '-') || 'Client';
      const filename = `${invoiceNum}_${clientName}.pdf`;
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success(`Downloaded ${filename}`);
    } catch (error) {
      toast.error("Failed to download PDF");
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API}/invoices/${id}`);
      toast.success("Invoice deleted successfully");
      navigate("/invoices");
    } catch (error) {
      toast.error("Failed to delete invoice");
    }
  };

  const handleMarkAsPaid = async () => {
    try {
      await axios.patch(`${API}/invoices/${id}/status`, { status: "paid" });
      toast.success("Invoice marked as paid");
      fetchInvoice();
    } catch (error) {
      toast.error("Failed to update invoice status");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">Loading invoice...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Invoice not found</p>
        <Link to="/invoices">
          <Button className="mt-4">Back to Invoices</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="invoice-view-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 no-print">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/invoices")}
            className="hover:bg-slate-100"
            data-testid="back-btn"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-[Manrope]">
                Invoice {invoice.invoice_number}
              </h1>
              <StatusBadge status={invoice.status} />
            </div>
            <p className="text-slate-500 font-mono text-sm mt-1">
              {new Date(invoice.invoice_date).toLocaleDateString('en-IN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
              {invoice.due_date && (
                <span className={invoice.status === 'overdue' ? 'text-red-600 ml-3' : 'text-slate-400 ml-3'}>
                  Due: {new Date(invoice.due_date).toLocaleDateString('en-IN')}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={openEditDialog}
            className="border-[#2E375B] text-[#2E375B] hover:bg-[#2E375B]/10"
            data-testid="edit-invoice-btn"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          {invoice.status !== 'paid' && (
            <Button
              onClick={handleMarkAsPaid}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              data-testid="mark-as-paid-btn"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Mark as Paid
            </Button>
          )}
          <Button
            onClick={handleDownloadPDF}
            className="bg-[#FFA14A] hover:bg-[#E8923E] text-[#2E375B]"
            data-testid="download-pdf-btn"
          >
            <FileDown className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
          <Button
            variant="outline"
            onClick={handlePrint}
            className="border-[#2E375B] text-[#2E375B] hover:bg-[#FFD4B0]"
            data-testid="print-invoice-btn"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button
            variant="outline"
            onClick={() => setDeleteDialogOpen(true)}
            className="border-red-300 text-red-600 hover:bg-red-50"
            data-testid="delete-invoice-btn"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Payment Info Banner */}
      {invoice.status === 'paid' && invoice.payment_date && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3 no-print">
          <CheckCircle className="w-5 h-5 text-emerald-600" />
          <div>
            <p className="font-medium text-emerald-800">Payment Received</p>
            <p className="text-sm text-emerald-600">
              Paid on {new Date(invoice.payment_date).toLocaleDateString('en-IN', {
                year: 'numeric', month: 'long', day: 'numeric'
              })}
            </p>
          </div>
        </div>
      )}

      {invoice.status === 'overdue' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 no-print">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <div>
            <p className="font-medium text-red-800">Payment Overdue</p>
            <p className="text-sm text-red-600">
              This invoice was due on {invoice.due_date && new Date(invoice.due_date).toLocaleDateString('en-IN')}
            </p>
          </div>
        </div>
      )}

      {/* Invoice Preview */}
      <div className="flex justify-center">
        <div 
          ref={printRef} 
          className="w-full max-w-4xl bg-white rounded-xl shadow-lg overflow-hidden print:shadow-none print:rounded-none"
        >
          <InvoicePreview invoice={invoice} isPreview={false} />
        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete invoice "{invoice.invoice_number}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
              data-testid="confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
