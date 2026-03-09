import { useState } from "react";
import { FileSpreadsheet, Download, Upload, CheckCircle, AlertCircle, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function BulkInvoice() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState(null);

  const handleDownloadTemplate = async () => {
    try {
      const response = await axios.get(`${API}/excel/template`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'thryve_invoice_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success("Template downloaded successfully!");
    } catch (error) {
      toast.error("Failed to download template");
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
        toast.error("Please select an Excel file (.xlsx or .xls)");
        return;
      }
      setFile(selectedFile);
      setResults(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file first");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${API}/excel/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setResults(response.data);
      
      if (response.data.created_count > 0) {
        toast.success(`Successfully created ${response.data.created_count} invoice(s)!`);
      }
      
      if (response.data.errors?.length > 0) {
        toast.error(`${response.data.errors.length} error(s) occurred`);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to process Excel file");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="bulk-invoice-page">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight font-[Manrope]">
          Bulk Invoice Generation
        </h1>
        <p className="text-slate-600 mt-1">
          Upload an Excel file to generate multiple invoices at once
        </p>
      </div>

      {/* Instructions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border border-slate-200">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-[#2E375B] text-white flex items-center justify-center mx-auto mb-4">
              <span className="font-bold">1</span>
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Download Template</h3>
            <p className="text-sm text-slate-500 mb-4">
              Get the Excel template with the correct format
            </p>
            <Button 
              variant="outline" 
              onClick={handleDownloadTemplate}
              className="border-[#2E375B] text-[#2E375B] hover:bg-[#2E375B] hover:text-white"
              data-testid="download-template-btn"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </Button>
          </CardContent>
        </Card>

        <Card className="border border-slate-200">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-[#FFA14A] text-[#2E375B] flex items-center justify-center mx-auto mb-4">
              <span className="font-bold">2</span>
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Fill in Data</h3>
            <p className="text-sm text-slate-500">
              Add client details, service types, rates, and billing info for each invoice
            </p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-[#2E375B] text-white flex items-center justify-center mx-auto mb-4">
              <span className="font-bold">3</span>
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Upload & Generate</h3>
            <p className="text-sm text-slate-500">
              Upload the filled Excel to auto-generate all invoices
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Upload Section */}
      <Card className="border border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold font-[Manrope] flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#2E375B]" />
            Upload Excel File
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-[#FFA14A] transition-colors">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
              id="excel-upload"
              data-testid="excel-file-input"
            />
            <label htmlFor="excel-upload" className="cursor-pointer">
              <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 mb-2">
                {file ? (
                  <span className="text-[#2E375B] font-medium">{file.name}</span>
                ) : (
                  "Click to select or drag and drop your Excel file"
                )}
              </p>
              <p className="text-xs text-slate-400">Supports .xlsx and .xls files</p>
            </label>
          </div>

          {file && (
            <div className="mt-6 flex justify-center">
              <Button
                onClick={handleUpload}
                disabled={uploading}
                className="bg-[#2E375B] hover:bg-[#232B47] text-white px-8"
                data-testid="upload-excel-btn"
              >
                {uploading ? (
                  <>Processing...</>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Generate Invoices
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {results && (
        <Card className="border border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold font-[Manrope]">
              Generation Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Summary */}
            <div className="flex gap-4 mb-6">
              <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-700">
                  {results.created_count} Invoice(s) Created
                </span>
              </div>
              {results.errors?.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-red-50 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <span className="font-medium text-red-700">
                    {results.errors.length} Error(s)
                  </span>
                </div>
              )}
            </div>

            {/* Created Invoices */}
            {results.created_invoices?.length > 0 && (
              <div className="mb-6">
                <h4 className="font-medium text-slate-700 mb-3">Created Invoices:</h4>
                <div className="space-y-2">
                  {results.created_invoices.map((invoice, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-[#2E375B]" />
                        <span className="font-mono text-sm text-[#2E375B]">
                          {invoice.invoice_number}
                        </span>
                        <span className="text-slate-600">-</span>
                        <span className="text-slate-700">{invoice.client}</span>
                      </div>
                      <span className="font-mono font-medium text-slate-900">
                        ₹{invoice.grand_total.toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Errors */}
            {results.errors?.length > 0 && (
              <div>
                <h4 className="font-medium text-red-700 mb-3">Errors:</h4>
                <div className="space-y-2">
                  {results.errors.map((error, index) => (
                    <div 
                      key={index} 
                      className="flex items-center gap-3 p-3 bg-red-50 rounded-lg"
                    >
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      <span className="text-red-700">
                        {error.client}: {error.error}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* View Invoices Link */}
            <div className="mt-6 pt-6 border-t border-slate-200">
              <Link to="/invoices">
                <Button className="bg-[#FFA14A] hover:bg-[#E8923E] text-[#2E375B]">
                  View All Invoices
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Excel Format Info */}
      <Card className="border border-slate-200 bg-slate-50">
        <CardContent className="p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Excel Format - One Row Per Invoice</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <h4 className="font-medium text-[#2E375B] mb-2">Client Details (Required):</h4>
              <ul className="space-y-1 text-slate-600">
                <li>• Client Company Name</li>
                <li>• Client Address</li>
                <li>• Client GSTIN</li>
                <li>• Invoice Date & Due Date</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-[#FFA14A] mb-2">Service Columns (Fill only what applies):</h4>
              <ul className="space-y-1 text-slate-600">
                <li>• <span className="font-medium">Monthly Plan Fee</span> + Prorate Days (GST ✓)</li>
                <li>• <span className="font-medium">Day Pass Rate</span> + Qty (GST ✓)</li>
                <li>• <span className="font-medium">Security Deposit</span> (No GST)</li>
                <li>• <span className="font-medium">Setup Charges</span> (GST ✓)</li>
                <li>• <span className="font-medium">Meeting Room Rate</span> + Hours (GST ✓)</li>
                <li>• <span className="font-medium">Additional Charges</span> + Description (GST ✓)</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 p-3 bg-white rounded border border-slate-200">
            <p className="text-sm text-slate-600">
              <span className="font-medium text-[#2E375B]">Tip:</span> Leave service columns empty if not applicable - only filled values appear on the invoice.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
