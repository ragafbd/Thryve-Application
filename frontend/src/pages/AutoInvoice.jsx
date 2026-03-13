import { useEffect, useState } from "react";
import { FileText, Play, Download, CheckCircle, XCircle, AlertCircle, Calendar, Users, IndianRupee, Eye, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AutoInvoice() {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [runs, setRuns] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  
  // Form state
  const [billingMonth, setBillingMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [notes, setNotes] = useState("");

  const fetchRuns = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/auto-invoice/runs`);
      setRuns(response.data);
    } catch (error) {
      console.error("Failed to fetch runs");
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const response = await axios.get(`${API}/companies`);
      // Filter only active companies
      const activeCompanies = response.data.filter(c => c.status === 'active');
      setCompanies(activeCompanies);
    } catch (error) {
      console.error("Failed to fetch companies");
    }
  };

  useEffect(() => {
    fetchRuns();
    fetchCompanies();
  }, []);

  const handleGenerate = async () => {
    if (!billingMonth) {
      toast.error("Please select a billing month");
      return;
    }

    setGenerating(true);
    try {
      const response = await axios.post(`${API}/auto-invoice/generate`, {
        billing_month: billingMonth,
        notes: notes || undefined
      });
      
      setLastResult(response.data.result);
      setResultDialogOpen(true);
      toast.success(response.data.message);
      fetchRuns();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to generate invoices");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPdf = async (invoiceId, filename) => {
    try {
      const response = await axios.get(`${API}/auto-invoice/invoice/${invoiceId}/pdf`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename || `invoice_${invoiceId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Failed to download PDF");
    }
  };

  const formatMonth = (monthStr) => {
    if (!monthStr) return "-";
    const [year, month] = monthStr.split('-');
    const months = ["January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"];
    return `${months[parseInt(month) - 1]} ${year}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate preview totals based on companies
  const totalActiveCompanies = companies.length;
  const totalMonthlyRevenue = companies.reduce((sum, c) => sum + (c.total_rate || 0), 0);
  const totalWithGst = totalMonthlyRevenue * 1.18;

  return (
    <div className="space-y-6 animate-fade-in" data-testid="auto-invoice-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#2E375B] tracking-tight font-[Manrope]">
            Auto Invoice Generation
          </h1>
          <p className="text-[#2E375B]/60 mt-1">
            Generate monthly invoices with PDFs for all active companies
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-[#2E375B]/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-[#2E375B]/60">Active Companies</p>
                <p className="text-2xl font-bold text-[#2E375B]">{totalActiveCompanies}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border border-[#2E375B]/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <IndianRupee className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-[#2E375B]/60">Monthly Revenue (excl. GST)</p>
                <p className="text-2xl font-bold text-[#2E375B]">₹{totalMonthlyRevenue.toLocaleString('en-IN')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border border-[#2E375B]/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#FFA14A]/20 rounded-lg">
                <IndianRupee className="w-5 h-5 text-[#FFA14A]" />
              </div>
              <div>
                <p className="text-sm text-[#2E375B]/60">With GST (18%)</p>
                <p className="text-2xl font-bold text-[#2E375B]">₹{totalWithGst.toLocaleString('en-IN', {maximumFractionDigits: 0})}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Generate Section */}
      <Card className="border border-[#2E375B]/10">
        <CardHeader>
          <CardTitle className="text-lg font-semibold font-[Manrope] flex items-center gap-2 text-[#2E375B]">
            <FileText className="w-5 h-5" />
            Generate Monthly Invoices
          </CardTitle>
          <CardDescription>
            Generate invoices and PDFs for all active companies for a specific month
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label className="text-[#2E375B]">Billing Month *</Label>
              <Input
                type="month"
                value={billingMonth}
                onChange={(e) => setBillingMonth(e.target.value)}
                className="border-[#2E375B]/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#2E375B]">Notes (optional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Monthly workspace charges"
                className="border-[#2E375B]/20"
              />
            </div>
            <Button
              onClick={handleGenerate}
              disabled={generating || !billingMonth}
              className="bg-[#2E375B] hover:bg-[#232B47]"
              data-testid="generate-invoices-btn"
            >
              {generating ? (
                <>Generating...</>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Generate {totalActiveCompanies} Invoices
                </>
              )}
            </Button>
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-sm text-blue-700">
              <AlertCircle className="w-4 h-4 inline mr-1" />
              This will generate invoices for <strong>{totalActiveCompanies} active companies</strong> for{" "}
              <strong>{formatMonth(billingMonth)}</strong>. Each invoice will include a PDF attachment.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Generation History */}
      <Card className="border border-[#2E375B]/10">
        <CardHeader>
          <CardTitle className="text-lg font-semibold font-[Manrope] flex items-center gap-2 text-[#2E375B]">
            <Calendar className="w-5 h-5" />
            Generation History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-[#2E375B]/60">Loading...</p>
          ) : runs.length === 0 ? (
            <p className="text-center py-8 text-[#2E375B]/60">No invoice generation runs yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[#2E375B]">Billing Month</TableHead>
                  <TableHead className="text-[#2E375B]">Generated On</TableHead>
                  <TableHead className="text-[#2E375B] text-center">Total</TableHead>
                  <TableHead className="text-[#2E375B] text-center">Success</TableHead>
                  <TableHead className="text-[#2E375B] text-center">Failed</TableHead>
                  <TableHead className="text-[#2E375B] text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium text-[#2E375B]">
                      {formatMonth(run.billing_month)}
                    </TableCell>
                    <TableCell className="text-[#2E375B]/70">
                      {formatDate(run.created_at)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{run.total_invoices}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-green-100 text-green-700">{run.successful}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {run.failed > 0 ? (
                        <Badge className="bg-red-100 text-red-700">{run.failed}</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-500">0</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium text-[#2E375B]">
                      ₹{run.total_amount?.toLocaleString('en-IN', {maximumFractionDigits: 0}) || 0}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Result Dialog */}
      <Dialog open={resultDialogOpen} onOpenChange={setResultDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-[Manrope] text-[#2E375B] flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Invoice Generation Complete
            </DialogTitle>
          </DialogHeader>
          
          {lastResult && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-green-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-700">{lastResult.successful}</p>
                  <p className="text-sm text-green-600">Successful</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-red-700">{lastResult.failed}</p>
                  <p className="text-sm text-red-600">Failed</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-700">
                    ₹{lastResult.total_amount?.toLocaleString('en-IN', {maximumFractionDigits: 0})}
                  </p>
                  <p className="text-sm text-blue-600">Total Amount</p>
                </div>
              </div>
              
              {/* Generated Invoices */}
              {lastResult.invoices?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-[#2E375B] mb-2">Generated Invoices</h4>
                  <div className="max-h-48 overflow-y-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Member</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">PDF</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lastResult.invoices.map((inv) => (
                          <TableRow key={inv.invoice_id}>
                            <TableCell className="font-mono text-sm">{inv.invoice_number}</TableCell>
                            <TableCell>{inv.member_name}</TableCell>
                            <TableCell className="text-right">₹{inv.amount?.toLocaleString('en-IN')}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownloadPdf(inv.invoice_id, inv.pdf_filename)}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
              
              {/* Errors */}
              {lastResult.errors?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-red-700 mb-2">Errors</h4>
                  <div className="max-h-32 overflow-y-auto bg-red-50 p-3 rounded-lg">
                    {lastResult.errors.map((err, idx) => (
                      <p key={idx} className="text-sm text-red-600">
                        <XCircle className="w-3 h-3 inline mr-1" />
                        {err.member_name}: {err.error}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setResultDialogOpen(false)} className="bg-[#2E375B] hover:bg-[#232B47]">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
