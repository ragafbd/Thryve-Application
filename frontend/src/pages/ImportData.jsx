import { useState } from "react";
import { Upload, FileSpreadsheet, Check, AlertCircle, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import axios from "axios";
import * as XLSX from "xlsx";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ImportData() {
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // Column mapping from Excel to database fields (based on actual Excel file)
  const columnMapping = {
    "Company's Name": "company_name",
    "Authorized Signatory": "signatory_name",
    "Signatory's Father's Name": "signatory_father_name",
    "Designation": "signatory_designation",
    "PAN No.": "signatory_pan",
    "GSTIN": "company_gstin",
    "Aadhar": "signatory_aadhar",
    "Address": "company_address",
    "Space Description": "space_description",
    "Seats": "total_seats",
    "Start Date": "start_date",
    "End date": "end_date",
    "Lock in": "lock_in_months",
    "License fee": "rate_per_seat",
    "Security": "security_deposit",
    "Setup charges": "setup_charges",
  };

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
      toast.error("Please upload an Excel file (.xlsx or .xls)");
      return;
    }

    setFile(selectedFile);
    setImportResult(null);

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { cellDates: true }); // Parse dates properly
      const sheetName = workbook.SheetNames[0]; // Sheet 1
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false });

      // Map Excel columns to database fields
      const mappedData = jsonData
        .filter(row => row["Company's Name"]) // Filter rows with company name
        .map((row, index) => {
          const mapped = { _rowNum: index + 2 }; // Excel row number (1-indexed + header)
          
          Object.entries(columnMapping).forEach(([excelCol, dbField]) => {
            if (row[excelCol] !== undefined && row[excelCol] !== "") {
              mapped[dbField] = row[excelCol];
            }
          });

          return mapped;
        })
        .filter(row => row.company_name); // Only keep rows with company name

      setPreviewData(mappedData);
      toast.success(`Found ${mappedData.length} clients to import`);
    } catch (error) {
      console.error("Error parsing Excel:", error);
      toast.error("Failed to parse Excel file");
    }
  };

  const handleImport = async () => {
    if (previewData.length === 0) {
      toast.error("No data to import");
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const response = await axios.post(
        `${API}/import/clients`,
        { clients: previewData }
      );

      setImportResult(response.data);
      toast.success(`Successfully imported ${response.data.success_count} clients`);
      
      if (response.data.errors && response.data.errors.length > 0) {
        toast.warning(`${response.data.errors.length} rows had errors`);
      }
    } catch (error) {
      console.error("Import error:", error);
      toast.error(error.response?.data?.detail || "Failed to import data");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        "Company's Name": "Example Company Pvt Ltd",
        "Authorized Signatory": "John Doe",
        "Signatory's Father's Name": "S/o Sh. Robert Doe",
        "Designation": "Director",
        "PAN No.": "ABCDE1234F",
        "GSTIN": "06ABCDE1234F1Z5",
        "Aadhar": "123456789012",
        "Address": "123, Business Park, City",
        "Space Description": "Six Seater Cabin",
        "Seats": 6,
        "Start Date": "2026-01-01",
        "End date": "2026-11-30",
        "Lock in": 11,
        "License fee": 5000,
        "Security": 30000,
        "Setup charges": "Not applicable"
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Clients");

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Thryve_Client_Import_Template.xlsx";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("Template downloaded");
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="import-data-page">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#2E375B] tracking-tight font-[Manrope]">
          Import Client Data
        </h1>
        <p className="text-[#2E375B] mt-1">
          One-time bulk import of client data from Excel
        </p>
      </div>

      {/* Upload Section */}
      <Card className="border border-[#2E375B]/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#2E375B]/10 rounded-lg">
                <Upload className="w-6 h-6 text-[#2E375B]" />
              </div>
              <div>
                <CardTitle className="text-lg text-[#2E375B]">Upload Excel File</CardTitle>
                <CardDescription className="text-[#2E375B]">Select your Excel file with client data (Sheet 1)</CardDescription>
              </div>
            </div>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-[#2E375B]/20 rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                id="excel-upload"
                data-testid="excel-upload-input"
              />
              <label htmlFor="excel-upload" className="cursor-pointer">
                <FileSpreadsheet className="w-12 h-12 mx-auto text-[#2E375B]/40 mb-4" />
                <p className="text-[#2E375B] font-medium">
                  {file ? file.name : "Click to select Excel file"}
                </p>
                <p className="text-sm text-[#2E375B]/60 mt-1">
                  Supports .xlsx and .xls files
                </p>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview Section */}
      {previewData.length > 0 && (
        <Card className="border border-[#2E375B]/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-[#2E375B]">
                Preview ({previewData.length} clients found)
              </CardTitle>
              <Button 
                onClick={handleImport}
                disabled={importing}
                className="bg-[#2E375B] hover:bg-[#232B47]"
                data-testid="import-all-btn"
              >
                {importing ? "Importing..." : "Import All"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b">
                    <th className="text-left p-2 text-[#2E375B]">Row</th>
                    <th className="text-left p-2 text-[#2E375B]">Company Name</th>
                    <th className="text-left p-2 text-[#2E375B]">Signatory</th>
                    <th className="text-left p-2 text-[#2E375B]">GSTIN</th>
                    <th className="text-left p-2 text-[#2E375B]">Seats</th>
                    <th className="text-left p-2 text-[#2E375B]">Rate</th>
                    <th className="text-left p-2 text-[#2E375B]">Space</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.slice(0, 20).map((row, idx) => (
                    <tr key={idx} className="border-b hover:bg-slate-50">
                      <td className="p-2 text-[#2E375B]">{row._rowNum}</td>
                      <td className="p-2 text-[#2E375B] font-medium">{row.company_name}</td>
                      <td className="p-2 text-[#2E375B]">{row.signatory_name || "-"}</td>
                      <td className="p-2 text-[#2E375B]">{row.company_gstin || "-"}</td>
                      <td className="p-2 text-[#2E375B]">{row.total_seats || "-"}</td>
                      <td className="p-2 text-[#2E375B]">{row.rate_per_seat ? `₹${row.rate_per_seat}` : "-"}</td>
                      <td className="p-2 text-[#2E375B]">{row.space_description || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewData.length > 20 && (
                <p className="text-center text-sm text-[#2E375B]/60 py-2">
                  Showing first 20 of {previewData.length} rows
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Result */}
      {importResult && (
        <Card className={`border ${importResult.errors?.length > 0 ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {importResult.errors?.length > 0 ? (
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              ) : (
                <Check className="w-5 h-5 text-green-600 mt-0.5" />
              )}
              <div>
                <p className="font-medium text-[#2E375B]">
                  Import Complete: {importResult.success_count} clients imported successfully
                </p>
                {importResult.errors?.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-amber-700 font-medium">Errors ({importResult.errors.length}):</p>
                    <ul className="text-sm text-amber-600 list-disc list-inside mt-1">
                      {importResult.errors.slice(0, 5).map((err, idx) => (
                        <li key={idx}>Row {err.row}: {err.error}</li>
                      ))}
                      {importResult.errors.length > 5 && (
                        <li>...and {importResult.errors.length - 5} more errors</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
