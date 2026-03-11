import { useState, useEffect } from "react";
import { FileText, Download, Printer, Building2, Users } from "lucide-react";
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
  const [members, setMembers] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [agreementHtml, setAgreementHtml] = useState("");

  useEffect(() => {
    fetchCompanies();
    fetchMembers();
  }, []);

  const fetchCompanies = async () => {
    try {
      const response = await axios.get(`${API}/companies`);
      setCompanies(response.data);
    } catch (error) {
      console.error("Failed to fetch companies");
    }
  };

  const fetchMembers = async () => {
    try {
      const response = await axios.get(`${API}/management/members`);
      setMembers(response.data);
    } catch (error) {
      console.error("Failed to fetch members");
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

  const generateAgreementData = (company) => {
    const endDate = new Date(company.start_date);
    endDate.setMonth(endDate.getMonth() + 11);

    return {
      day: getOrdinalDay(company.start_date),
      monthYear: getMonthYear(company.start_date),
      companyName: company.company_name || "",
      panNo: company.signatory_pan || company.company_pan || "",
      gstin: company.company_gstin || "",
      address: company.company_address || "",
      authorizedSignatory: company.signatory_name || "",
      designation: company.signatory_designation || "Authorized Signatory",
      spaceDescription: `${company.plan_name || "Workspace"} - ${company.space_description || "Dedicated Seat"}`,
      seats: company.total_seats || 1,
      startDate: formatDate(company.start_date),
      endDate: formatDate(endDate.toISOString().split('T')[0]),
      lockIn: company.lock_in_months || 6,
      licenseFee: company.rate_per_seat || 0,
      security: company.security_deposit || 0,
      setupCharges: company.setup_charges || 0,
      forThryve: "Amit Mehta",
      thryveDesignation: "Director"
    };
  };

  const generateAgreementHtml = (data) => {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6;">
        <h2 style="text-align: center; margin-bottom: 20px;">LEAVE AND LICENSE AGREEMENT</h2>
        
        <p>THIS LEAVE AND LICENSE AGREEMENT ("Agreement") is executed on this <strong>${data.day}</strong> day of <strong>${data.monthYear}</strong>, at Faridabad, Haryana,</p>
        
        <p><strong>BETWEEN</strong></p>
        
        <p><strong>Thryve Coworking</strong>, (PAN AAYFT8213A & GSTIN 06AAYFT8213A1Z2) a business operating from: Plot No. 3, First Floor, Near Ajronda Metro Station, 18/1, Mathura Road, Faridabad, Haryana 121007, acting through its authorized representative, hereinafter referred to as the "<strong>Licensor</strong>"</p>
        
        <p><strong>AND</strong></p>
        
        <p><strong>M/s ${data.companyName}</strong>, (PAN ${data.panNo} & GSTIN ${data.gstin}) having its Regd. office at: ${data.address}, through its authorized signatory <strong>${data.authorizedSignatory}</strong>, hereinafter referred to as the "<strong>Licensee</strong>"</p>
        
        <h3>1. LICENSED AREA & SERVICES</h3>
        <p>The Licensor grants to the Licensee a non-exclusive, non-transferable, revocable license for right to enter and use the following workspace(s) at the Premises:</p>
        <ul>
          <li>${data.spaceDescription}</li>
          <li>Number of Seats: <strong>${data.seats}</strong></li>
          <li>Meeting Room Access: As per usage/plan</li>
          <li>Common Areas: Reception, Lounge, Pantry, Washrooms, Hallways</li>
        </ul>
        
        <h3>2. TERM</h3>
        <p>The term of this Agreement shall be for 11 months, commencing from <strong>${data.startDate}</strong> until <strong>${data.endDate}</strong>.</p>
        <p>Lock-in period: <strong>${data.lockIn} months</strong></p>
        
        <h3>3. LICENSE FEES & PAYMENTS</h3>
        <ul>
          <li>Monthly License Fee per seat: <strong>Rs. ${data.licenseFee}/-</strong></li>
          <li>Security Deposit (interest-free): <strong>Rs. ${data.security}/-</strong></li>
          <li>Setup Charges: <strong>Rs. ${data.setupCharges}/-</strong></li>
        </ul>
        
        <div style="margin-top: 40px;">
          <h3>SIGNATURES</h3>
          <div style="display: flex; justify-content: space-between; margin-top: 20px;">
            <div>
              <p><strong>FOR THE LICENSOR</strong></p>
              <p>Thryve Coworking</p>
              <p>Name: ${data.forThryve}</p>
              <p>Designation: ${data.thryveDesignation}</p>
              <p>Date: ${data.startDate}</p>
            </div>
            <div>
              <p><strong>FOR THE LICENSEE</strong></p>
              <p>${data.companyName}</p>
              <p>Authorized Signatory: ${data.authorizedSignatory}</p>
              <p>Designation: ${data.designation}</p>
              <p>Date: ${data.startDate}</p>
            </div>
          </div>
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
            }),
            new Paragraph({ text: "" }),
            new Paragraph({
              children: [
                new TextRun({ text: `THIS LEAVE AND LICENSE AGREEMENT ("Agreement") is executed on this ` }),
                new TextRun({ text: data.day, bold: true }),
                new TextRun({ text: ` day of ` }),
                new TextRun({ text: data.monthYear, bold: true }),
                new TextRun({ text: `, at Faridabad, Haryana,` }),
              ],
            }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "BETWEEN", bold: true }),
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
            new Paragraph({ text: "AND", bold: true }),
            new Paragraph({ text: "" }),
            new Paragraph({
              children: [
                new TextRun({ text: `M/s ${data.companyName}`, bold: true }),
                new TextRun({ text: `, (PAN ${data.panNo} & GSTIN ${data.gstin}) having its Regd. office at: ${data.address}, through its authorized signatory ` }),
                new TextRun({ text: data.authorizedSignatory, bold: true }),
                new TextRun({ text: `, hereinafter referred to as the "` }),
                new TextRun({ text: "Licensee", bold: true }),
                new TextRun({ text: `"` }),
              ],
            }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "1. LICENSED AREA & SERVICES", heading: HeadingLevel.HEADING_2 }),
            new Paragraph({ text: `• ${data.spaceDescription}` }),
            new Paragraph({ text: `• Number of Seats: ${data.seats}` }),
            new Paragraph({ text: `• Meeting Room Access: As per usage/plan` }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "2. TERM", heading: HeadingLevel.HEADING_2 }),
            new Paragraph({ text: `The term of this Agreement shall be for 11 months, commencing from ${data.startDate} until ${data.endDate}.` }),
            new Paragraph({ text: `Lock-in period: ${data.lockIn} months` }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "3. LICENSE FEES & PAYMENTS", heading: HeadingLevel.HEADING_2 }),
            new Paragraph({ text: `• Monthly License Fee per seat: Rs. ${data.licenseFee}/-` }),
            new Paragraph({ text: `• Security Deposit (interest-free): Rs. ${data.security}/-` }),
            new Paragraph({ text: `• Setup Charges: Rs. ${data.setupCharges}/-` }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "SIGNATURES", heading: HeadingLevel.HEADING_2 }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "FOR THE LICENSOR", bold: true }),
            new Paragraph({ text: "Thryve Coworking" }),
            new Paragraph({ text: `Name: ${data.forThryve}` }),
            new Paragraph({ text: `Designation: ${data.thryveDesignation}` }),
            new Paragraph({ text: `Date: ${data.startDate}` }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "FOR THE LICENSEE", bold: true }),
            new Paragraph({ text: data.companyName }),
            new Paragraph({ text: `Authorized Signatory: ${data.authorizedSignatory}` }),
            new Paragraph({ text: `Designation: ${data.designation}` }),
            new Paragraph({ text: `Date: ${data.startDate}` }),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `LLA_${data.companyName.replace(/[^a-zA-Z0-9]/g, '_')}.docx`);
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
            @media print { body { margin: 20mm; } }
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
          Generate agreements for clients and members
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
              <CardTitle className="text-lg text-[#2E375B]">Generate for Client Company</CardTitle>
              <CardDescription className="text-[#2E375B]">Select a client to generate their Leave & License Agreement</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1 space-y-2">
              <Label className="text-[#2E375B]">Select Client</Label>
              <Select onValueChange={(val) => setSelectedCompany(companies.find(c => c.id === val))}>
                <SelectTrigger>
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
            >
              <FileText className="w-4 h-4 mr-2" />
              Preview
            </Button>
            <Button
              onClick={() => selectedCompany && generateWordDocument(selectedCompany)}
              disabled={!selectedCompany || generating}
              className="bg-[#2E375B] hover:bg-[#232B47]"
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
          <CardTitle className="text-lg text-[#2E375B]">All Clients</CardTitle>
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
                  <th className="text-right p-3 text-[#2E375B]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {companies.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-[#2E375B]">
                      No clients found. Add clients first.
                    </td>
                  </tr>
                ) : (
                  companies.map(company => (
                    <tr key={company.id} className="border-b hover:bg-slate-50">
                      <td className="p-3 font-medium text-[#2E375B]">{company.company_name}</td>
                      <td className="p-3 text-[#2E375B]">{company.signatory_name || "-"}</td>
                      <td className="p-3 text-[#2E375B]">{formatDate(company.start_date)}</td>
                      <td className="p-3 text-[#2E375B]">{company.total_seats}</td>
                      <td className="p-3 text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => previewAgreement(company)}
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => generateWordDocument(company)}
                            className="bg-[#2E375B] hover:bg-[#232B47]"
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
          <div className="mt-4">
            <div dangerouslySetInnerHTML={{ __html: agreementHtml }} />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={printAgreement}>
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
