import { useState, useEffect } from "react";
import { FileText, Download, Printer, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import axios from "axios";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { saveAs } from "file-saver";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Agreement() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [agreementHtml, setAgreementHtml] = useState("");

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const response = await axios.get(`${API}/companies`);
      setCompanies(response.data.filter(c => c.status === "active"));
    } catch (error) {
      console.error("Failed to fetch companies:", error);
      toast.error("Failed to load companies");
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const getOrdinalDay = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const day = date.getDate();
    const suffix = ['th', 'st', 'nd', 'rd'];
    const v = day % 100;
    return day + (suffix[(v - 20) % 10] || suffix[v] || suffix[0]);
  };

  const getMonthYear = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  };

  // Calculate end date (11 months from start)
  const calculateEndDate = (startDateStr) => {
    if (!startDateStr) return "";
    const startDate = new Date(startDateStr);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 11);
    return endDate.toISOString().split('T')[0];
  };

  // Generate agreement data matching LLA mail merge fields
  const generateAgreementData = (company) => {
    const endDate = company.end_date || calculateEndDate(company.start_date);
    const securityDeposit = company.security_deposit || (company.total_seats * company.rate_per_seat);

    return {
      // Merge fields from LLA template
      Day: getOrdinalDay(company.start_date),
      Month__Year: getMonthYear(company.start_date),
      Companys_Name: company.company_name || "",
      PAN_No: company.signatory_pan || company.company_pan || "",
      GSTIN: company.company_gstin || "",
      Address: company.company_address || "",
      Authorized_Signatory: company.signatory_name || "",
      Designation: company.signatory_designation || "Authorized Signatory",
      Space_Description: company.space_description || company.plan_name || "Workspace",
      Seats: company.total_seats || 1,
      Start_Date: formatDate(company.start_date),
      End_date: formatDate(endDate),
      Lock_in: company.lock_in_months || 11,
      License_fee_: company.rate_per_seat || 0,
      Security_: securityDeposit,
      Setup_charges: company.setup_charges || "Not applicable",
      for_Thryve: "Amit Mehta",
      Thryve_Designation: "Marketing Head"
    };
  };

  const generateAgreementHtml = (data) => {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.8; font-size: 14px;">
        <h2 style="text-align: center; margin-bottom: 30px; font-size: 18px;">LEAVE AND LICENSE AGREEMENT</h2>
        
        <p style="text-align: justify;">THIS LEAVE AND LICENSE AGREEMENT ("Agreement") is executed on this <strong>${data.Day}</strong> day of <strong>${data.Month__Year}</strong>, at Faridabad, Haryana,</p>
        
        <p style="margin-top: 20px;"><strong>BETWEEN</strong></p>
        
        <p style="text-align: justify;"><strong>Thryve Coworking</strong>, (PAN AAYFT8213A & GSTIN 06AAYFT8213A1Z2) a business operating from: Plot No. 3, First Floor, Near Ajronda Metro Station, 18/1, Mathura Road, Faridabad, Haryana 121007, acting through its authorized representative, hereinafter referred to as the "<strong>Licensor</strong>" (which expression shall, unless it be repugnant to the context or meaning thereof, be deemed to mean and include its legal heirs, executors, administrators, permitted assigns, and successors)</p>
        
        <p style="text-align: center; margin: 20px 0;"><strong>AND</strong></p>
        
        <p style="text-align: justify;"><strong>M/s ${data.Companys_Name}</strong>, (PAN ${data.PAN_No} & GSTIN ${data.GSTIN}) having its Regd. office at: ${data.Address}, through its authorized signatory <strong>${data.Authorized_Signatory}</strong>, <strong>${data.Designation}</strong>, hereinafter referred to as the "<strong>Licensee</strong>" (which expression shall, unless it be repugnant to the context or meaning thereof, be deemed to mean and include its legal heirs, executors, administrators, permitted assigns, and successors)</p>
        
        <p style="margin-top: 30px;">The Licensor and the Licensee are hereinafter individually referred to as a "Party" and collectively referred to as the "Parties."</p>
        
        <h3 style="margin-top: 30px;">WHEREAS:</h3>
        <p style="text-align: justify;">The Licensor is engaged in the business of providing coworking spaces and related services at the Premises situated at Plot No. 3, First Floor, Near Ajronda Metro Station, 18/1, Mathura Road, Faridabad, Haryana 121007 ("Premises").</p>
        
        <h3 style="margin-top: 30px;">1. LICENSED AREA & SERVICES</h3>
        <p style="text-align: justify;">The Licensor grants to the Licensee a non-exclusive, non-transferable, revocable license for right to enter and use the following workspace(s) at the Premises:</p>
        <ul style="margin-left: 20px;">
          <li><strong>Space:</strong> ${data.Space_Description}</li>
          <li><strong>Number of Seats:</strong> ${data.Seats}</li>
          <li><strong>Meeting Room Access:</strong> As per usage/plan</li>
          <li><strong>Common Areas:</strong> Reception, Lounge, Pantry, Washrooms, Hallways</li>
        </ul>
        
        <h3 style="margin-top: 30px;">2. TERM</h3>
        <p style="text-align: justify;">The term of this Agreement shall be for <strong>11 months</strong>, commencing from <strong>${data.Start_Date}</strong> until <strong>${data.End_date}</strong>, unless terminated earlier as per the terms herein.</p>
        <p><strong>Lock-in period:</strong> ${data.Lock_in} months</p>
        
        <h3 style="margin-top: 30px;">3. LICENSE FEES & PAYMENTS</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;">Monthly License Fee (per seat)</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;"><strong>Rs. ${data.License_fee_.toLocaleString('en-IN')}/-</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;">Security Deposit (interest-free, refundable)</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;"><strong>Rs. ${data.Security_.toLocaleString('en-IN')}/-</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;">Setup Charges</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;"><strong>${typeof data.Setup_charges === 'number' ? `Rs. ${data.Setup_charges.toLocaleString('en-IN')}/-` : data.Setup_charges}</strong></td>
          </tr>
        </table>
        
        <div style="margin-top: 60px; page-break-inside: avoid;">
          <h3>SIGNATURES</h3>
          <table style="width: 100%; margin-top: 30px;">
            <tr>
              <td style="width: 50%; vertical-align: top; padding-right: 30px;">
                <p><strong>FOR THE LICENSOR</strong></p>
                <p style="margin-top: 60px;">_______________________</p>
                <p><strong>Thryve Coworking</strong></p>
                <p>Name: ${data.for_Thryve}</p>
                <p>Designation: ${data.Thryve_Designation}</p>
                <p>Date: ${data.Start_Date}</p>
              </td>
              <td style="width: 50%; vertical-align: top;">
                <p><strong>FOR THE LICENSEE</strong></p>
                <p style="margin-top: 60px;">_______________________</p>
                <p><strong>${data.Companys_Name}</strong></p>
                <p>Authorized Signatory: ${data.Authorized_Signatory}</p>
                <p>Designation: ${data.Designation}</p>
                <p>Date: ${data.Start_Date}</p>
              </td>
            </tr>
          </table>
        </div>
      </div>
    `;
  };

  const generateWordDocument = async (company) => {
    setGenerating(true);
    
    try {
      const data = generateAgreementData(company);
      
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              text: "LEAVE AND LICENSE AGREEMENT",
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 }
            }),
            new Paragraph({ text: "" }),
            new Paragraph({
              children: [
                new TextRun({ text: `THIS LEAVE AND LICENSE AGREEMENT ("Agreement") is executed on this ` }),
                new TextRun({ text: data.Day, bold: true }),
                new TextRun({ text: ` day of ` }),
                new TextRun({ text: data.Month__Year, bold: true }),
                new TextRun({ text: `, at Faridabad, Haryana,` }),
              ],
            }),
            new Paragraph({ text: "" }),
            new Paragraph({ children: [new TextRun({ text: "BETWEEN", bold: true })] }),
            new Paragraph({ text: "" }),
            new Paragraph({
              children: [
                new TextRun({ text: "Thryve Coworking", bold: true }),
                new TextRun({ text: `, (PAN AAYFT8213A & GSTIN 06AAYFT8213A1Z2) a business operating from: Plot No. 3, First Floor, Near Ajronda Metro Station, 18/1, Mathura Road, Faridabad, Haryana 121007, acting through its authorized representative, hereinafter referred to as the "` }),
                new TextRun({ text: "Licensor", bold: true }),
                new TextRun({ text: `"` }),
              ],
            }),
            new Paragraph({ text: "" }),
            new Paragraph({ children: [new TextRun({ text: "AND", bold: true })], alignment: AlignmentType.CENTER }),
            new Paragraph({ text: "" }),
            new Paragraph({
              children: [
                new TextRun({ text: `M/s ${data.Companys_Name}`, bold: true }),
                new TextRun({ text: `, (PAN ${data.PAN_No} & GSTIN ${data.GSTIN}) having its Regd. office at: ${data.Address}, through its authorized signatory ` }),
                new TextRun({ text: data.Authorized_Signatory, bold: true }),
                new TextRun({ text: `, ` }),
                new TextRun({ text: data.Designation, bold: true }),
                new TextRun({ text: `, hereinafter referred to as the "` }),
                new TextRun({ text: "Licensee", bold: true }),
                new TextRun({ text: `"` }),
              ],
            }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "1. LICENSED AREA & SERVICES", heading: HeadingLevel.HEADING_2 }),
            new Paragraph({ text: `The Licensor grants to the Licensee a non-exclusive, non-transferable, revocable license for right to enter and use the following workspace(s) at the Premises:` }),
            new Paragraph({ text: `• Space: ${data.Space_Description}` }),
            new Paragraph({ text: `• Number of Seats: ${data.Seats}` }),
            new Paragraph({ text: `• Meeting Room Access: As per usage/plan` }),
            new Paragraph({ text: `• Common Areas: Reception, Lounge, Pantry, Washrooms, Hallways` }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "2. TERM", heading: HeadingLevel.HEADING_2 }),
            new Paragraph({ text: `The term of this Agreement shall be for 11 months, commencing from ${data.Start_Date} until ${data.End_date}, unless terminated earlier.` }),
            new Paragraph({ text: `Lock-in period: ${data.Lock_in} months` }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "3. LICENSE FEES & PAYMENTS", heading: HeadingLevel.HEADING_2 }),
            new Paragraph({ text: `• Monthly License Fee (per seat): Rs. ${data.License_fee_.toLocaleString('en-IN')}/-` }),
            new Paragraph({ text: `• Security Deposit (interest-free, refundable): Rs. ${data.Security_.toLocaleString('en-IN')}/-` }),
            new Paragraph({ text: `• Setup Charges: ${typeof data.Setup_charges === 'number' ? `Rs. ${data.Setup_charges.toLocaleString('en-IN')}/-` : data.Setup_charges}` }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "SIGNATURES", heading: HeadingLevel.HEADING_2 }),
            new Paragraph({ text: "" }),
            new Paragraph({ children: [new TextRun({ text: "FOR THE LICENSOR", bold: true })] }),
            new Paragraph({ text: "Thryve Coworking" }),
            new Paragraph({ text: `Name: ${data.for_Thryve}` }),
            new Paragraph({ text: `Designation: ${data.Thryve_Designation}` }),
            new Paragraph({ text: `Date: ${data.Start_Date}` }),
            new Paragraph({ text: "" }),
            new Paragraph({ children: [new TextRun({ text: "FOR THE LICENSEE", bold: true })] }),
            new Paragraph({ text: data.Companys_Name }),
            new Paragraph({ text: `Authorized Signatory: ${data.Authorized_Signatory}` }),
            new Paragraph({ text: `Designation: ${data.Designation}` }),
            new Paragraph({ text: `Date: ${data.Start_Date}` }),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `LLA_${data.Companys_Name.replace(/[^a-zA-Z0-9]/g, '_')}.docx`);
      toast.success("Agreement generated successfully");
    } catch (error) {
      console.error("Error generating document:", error);
      toast.error("Failed to generate agreement");
    } finally {
      setGenerating(false);
    }
  };

  const previewAgreement = (company) => {
    const data = generateAgreementData(company);
    setAgreementHtml(generateAgreementHtml(data));
    setSelectedCompany(company);
    setPreviewOpen(true);
  };

  const printAgreement = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Leave and License Agreement</title>
          <style>
            body { font-family: Arial, sans-serif; }
            @media print { 
              body { margin: 15mm; }
              @page { size: A4; margin: 15mm; }
            }
          </style>
        </head>
        <body>
          ${agreementHtml}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="agreement-page">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#2E375B] tracking-tight font-[Manrope]">
          Leave & License Agreement
        </h1>
        <p className="text-[#2E375B] mt-1">
          Generate LLA documents for clients
        </p>
      </div>

      {/* Generate for Company */}
      <Card className="border border-[#2E375B]/10">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#2E375B]/10 rounded-lg">
              <Building2 className="w-6 h-6 text-[#2E375B]" />
            </div>
            <div>
              <CardTitle className="text-lg text-[#2E375B]">Generate Agreement</CardTitle>
              <CardDescription className="text-[#2E375B]">Select a client to generate their Leave & License Agreement</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end flex-wrap">
            <div className="flex-1 min-w-[250px] space-y-2">
              <Label className="text-[#2E375B]">Select Client</Label>
              <Select onValueChange={(val) => setSelectedCompany(companies.find(c => c.id === val))}>
                <SelectTrigger data-testid="client-select">
                  <SelectValue placeholder="Select a client company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map(company => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => selectedCompany && previewAgreement(selectedCompany)}
              disabled={!selectedCompany}
              variant="outline"
              data-testid="preview-btn"
            >
              <FileText className="w-4 h-4 mr-2" />
              Preview
            </Button>
            <Button
              onClick={() => selectedCompany && generateWordDocument(selectedCompany)}
              disabled={!selectedCompany || generating}
              className="bg-[#2E375B] hover:bg-[#232B47]"
              data-testid="download-word-btn"
            >
              <Download className="w-4 h-4 mr-2" />
              {generating ? "Generating..." : "Download Word"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* All Clients Table */}
      <Card className="border border-[#2E375B]/10">
        <CardHeader>
          <CardTitle className="text-lg text-[#2E375B]">All Active Clients</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 text-[#2E375B]">Company Name</th>
                  <th className="text-left p-3 text-[#2E375B]">Signatory</th>
                  <th className="text-left p-3 text-[#2E375B]">Start Date</th>
                  <th className="text-left p-3 text-[#2E375B]">Seats</th>
                  <th className="text-left p-3 text-[#2E375B]">Space</th>
                  <th className="text-right p-3 text-[#2E375B]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {companies.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-[#2E375B]">
                      No active clients found. Import or add clients first.
                    </td>
                  </tr>
                ) : (
                  companies.map(company => (
                    <tr key={company.id} className="border-b hover:bg-slate-50">
                      <td className="p-3 font-medium text-[#2E375B]">{company.company_name}</td>
                      <td className="p-3 text-[#2E375B]">{company.signatory_name || "-"}</td>
                      <td className="p-3 text-[#2E375B]">{formatDate(company.start_date)}</td>
                      <td className="p-3 text-[#2E375B]">{company.total_seats}</td>
                      <td className="p-3 text-[#2E375B]">{company.space_description || company.plan_name || "-"}</td>
                      <td className="p-3 text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => previewAgreement(company)}
                            title="Preview"
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => generateWordDocument(company)}
                            className="bg-[#2E375B] hover:bg-[#232B47]"
                            title="Download Word"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#2E375B]">
              Agreement Preview - {selectedCompany?.company_name}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 border rounded-lg p-4 bg-white">
            <div dangerouslySetInnerHTML={{ __html: agreementHtml }} />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={printAgreement} data-testid="print-btn">
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button
              onClick={() => selectedCompany && generateWordDocument(selectedCompany)}
              className="bg-[#2E375B] hover:bg-[#232B47]"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Word
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
