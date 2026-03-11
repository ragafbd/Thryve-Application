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
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, TabStopType, TabStopPosition } from "docx";
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

  const calculateEndDate = (startDateStr, months = 11) => {
    if (!startDateStr) return "";
    const startDate = new Date(startDateStr);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + months);
    endDate.setDate(endDate.getDate() - 1);
    return endDate.toISOString().split('T')[0];
  };

  // Generate agreement data matching LLA mail merge fields
  const generateAgreementData = (company) => {
    const endDate = company.end_date || calculateEndDate(company.start_date, company.lock_in_months || 11);
    const securityDeposit = company.security_deposit || (company.total_seats * company.rate_per_seat);

    return {
      Day: getOrdinalDay(company.start_date),
      Month_Year: getMonthYear(company.start_date),
      Companys_Name: company.company_name || "",
      PAN_No: company.signatory_pan || company.company_pan || "",
      GSTIN: company.company_gstin || "N/A",
      Address: company.company_address || "",
      Authorized_Signatory: company.signatory_name || "",
      Designation: company.signatory_designation || "Authorized Signatory",
      Space_Description: company.space_description || company.plan_name || "Workspace",
      Seats: company.total_seats || 1,
      Start_Date: formatDate(company.start_date),
      End_Date: formatDate(endDate),
      Lock_in: company.lock_in_months || 11,
      License_fee: company.rate_per_seat || 0,
      Security: securityDeposit,
      Setup_charges: company.setup_charges || "Not applicable",
      for_Thryve: "Amit Mehta",
      Thryve_Designation: "Marketing Head"
    };
  };

  const generateAgreementHtml = (data) => {
    return `
      <div style="font-family: Calibri, 'Segoe UI', Arial, sans-serif; max-width: 210mm; margin: 0 auto; padding: 25mm 20mm; line-height: 1.6; font-size: 11pt; color: #000; background: white;">
        <h2 style="text-align: center; margin-bottom: 24pt; font-size: 14pt; font-weight: bold; letter-spacing: 1px;">LEAVE & LICENSE AGREEMENT</h2>
        
        <p style="text-align: justify; margin-bottom: 12pt;">THIS LEAVE AND LICENSE AGREEMENT ("Agreement") is executed on this <strong>${data.Day}</strong> day of <strong>${data.Month_Year}</strong>, at Faridabad, Haryana,</p>
        
        <p style="margin: 16pt 0 8pt 0;"><strong>BETWEEN</strong></p>
        
        <p style="text-align: justify; margin-bottom: 12pt;"><strong>Thryve Coworking</strong>, (PAN AAYFT8213A & GSTIN 06AAYFT8213A1Z2) a business operating from: Plot No. 3, First Floor, Near Ajronda Metro Station, 18/1, Mathura Road, Faridabad, Haryana 121007, acting through its authorized representative, hereinafter referred to as the "<strong>Licensor</strong>", (which expression shall, unless repugnant to the context, include its successors, assigns, administrators, and representatives)</p>
        
        <p style="text-align: center; margin: 16pt 0;"><strong>AND</strong></p>
        
        <p style="text-align: justify; margin-bottom: 12pt;"><strong>M/s ${data.Companys_Name}</strong>, (PAN ${data.PAN_No} & GSTIN ${data.GSTIN}) having its Regd. office at: ${data.Address}, through its authorized signatory <strong>${data.Authorized_Signatory}</strong>, hereinafter referred to as the "<strong>Licensee</strong>", (which expression shall, unless repugnant to the context, include its successors, permitted assigns, employees, and representatives)</p>
        
        <p style="margin: 16pt 0 12pt 0;">The Licensor and the Licensee are collectively referred to as the "Parties" and individually as a "Party."</p>
        
        <h3 style="margin-top: 20pt; margin-bottom: 8pt; font-size: 11pt; font-weight: bold;">WHEREAS</h3>
        <ol style="margin-left: 20pt; margin-bottom: 12pt;">
          <li style="text-align: justify; margin-bottom: 6pt;">The Licensor is operating a coworking facility known as "Thryve Coworking" at Plot No. 3, First Floor, Near Ajronda Metro Station, 18/1, Mathura Road, Faridabad 121007 ("hereinafter referred to as Premises").</li>
          <li style="text-align: justify; margin-bottom: 6pt;">The Licensor is in lawful possession of the Premises and entitled to grant a license for the use of certain designated workspace(s), cabins, meeting rooms, and/or coworking desks.</li>
          <li style="text-align: justify; margin-bottom: 6pt;">The Licensee has requested use of the Licensor's coworking facilities and services, and the Licensor has agreed to grant the Licensee a limited, non-exclusive, revocable license with rights to enter and strictly for business use on the terms and conditions set forth below:</li>
        </ol>
        
        <p style="margin: 16pt 0 12pt 0;"><strong>NOW, THEREFORE, THE PARTIES AGREE AS FOLLOWS:</strong></p>
        
        <h3 style="margin-top: 16pt; margin-bottom: 8pt; font-size: 11pt; font-weight: bold;">1. LICENSED AREA & SERVICES</h3>
        <p style="text-align: justify; margin-bottom: 6pt;"><strong>1.1</strong> The Licensor grants to the Licensee a non-exclusive, non-transferable, revocable license for right to enter and use the following workspace(s) at the Premises:</p>
        <ul style="margin-left: 24pt; margin-bottom: 8pt;">
          <li style="margin-bottom: 4pt;">${data.Space_Description}</li>
          <li style="margin-bottom: 4pt;">Number of Seats: <strong>${data.Seats}</strong></li>
          <li style="margin-bottom: 4pt;">Meeting Room Access: As per usage/plan</li>
          <li style="margin-bottom: 4pt;">Common Areas: Reception, Lounge, Pantry, Washrooms, Hallways, and such other areas as designated by the Licensor.</li>
        </ul>
        <p style="text-align: justify; margin-bottom: 6pt;"><strong>1.2</strong> The License is limited to right to enter and use only, and no tenancy, lease, or rights of possession are created or transferred.</p>
        <p style="text-align: justify; margin-bottom: 6pt;"><strong>1.3</strong> The following services are included (as applicable to the chosen plan):</p>
        <ul style="margin-left: 24pt; margin-bottom: 8pt;">
          <li style="margin-bottom: 3pt;">High-speed Internet</li>
          <li style="margin-bottom: 3pt;">Electricity & Air Conditioning during business hours</li>
          <li style="margin-bottom: 3pt;">Housekeeping of common spaces</li>
          <li style="margin-bottom: 3pt;">Power Backup</li>
          <li style="margin-bottom: 3pt;">Front Desk Assistance</li>
          <li style="margin-bottom: 3pt;">Access to Pantry Facilities</li>
          <li style="margin-bottom: 3pt;">Access to Conference Rooms (subject to availability and booking rules)</li>
          <li style="margin-bottom: 3pt;">CCTV Surveillance (excluding private cabins)</li>
        </ul>
        <p style="text-align: justify; margin-bottom: 6pt;"><strong>1.4</strong> The Licensor may modify or enhance services at its discretion.</p>
        
        <h3 style="margin-top: 16pt; margin-bottom: 8pt; font-size: 11pt; font-weight: bold;">2. TERM</h3>
        <p style="text-align: justify; margin-bottom: 6pt;"><strong>2.1</strong> The term of this Agreement shall be for 11 months, commencing from <strong>${data.Start_Date}</strong> ("Start Date") until <strong>${data.End_Date}</strong> ("End Date"), unless terminated earlier. There will be a lock-in period of <strong>${data.Lock_in} months</strong> before which the Licensee will not terminate this Leave & License Deed.</p>
        <p style="text-align: justify; margin-bottom: 6pt;"><strong>2.2</strong> Renewal shall be subject to discretion of the Licensor and a new Leave & License Deed will be executed.</p>
        
        <h3 style="margin-top: 16pt; margin-bottom: 8pt; font-size: 11pt; font-weight: bold;">3. LICENSE FEES & PAYMENTS</h3>
        <p style="text-align: justify; margin-bottom: 6pt;"><strong>3.1</strong> The Licensee agrees to pay:</p>
        <ul style="margin-left: 24pt; margin-bottom: 8pt;">
          <li style="margin-bottom: 4pt;">Monthly License Fee per seat/member: <strong>Rs. ${data.License_fee.toLocaleString('en-IN')}/-</strong></li>
          <li style="margin-bottom: 4pt;">Security Deposit (interest-free): <strong>Rs. ${data.Security.toLocaleString('en-IN')}/-</strong></li>
          <li style="margin-bottom: 4pt;">Setup Charges (if any): <strong>${typeof data.Setup_charges === 'number' ? `Rs. ${data.Setup_charges.toLocaleString('en-IN')}/-` : data.Setup_charges}</strong></li>
          <li style="margin-bottom: 4pt;">GST/other applicable taxes/extra usage of facilities will be paid extra.</li>
        </ul>
        <p style="text-align: justify; margin-bottom: 6pt;"><strong>3.2</strong> The License Fee shall be payable in advance on or before the 5th day of each English calendar month.</p>
        <p style="text-align: justify; margin-bottom: 6pt;"><strong>3.3</strong> Delay in payment beyond the due date attracts a penalty of Rs. 500/- per day apart from the outstanding dues until the full outstanding payment is made.</p>
        <p style="text-align: justify; margin-bottom: 6pt;"><strong>3.4</strong> Non-payment for two consecutive months constitutes a material breach, allowing the Licensor to terminate the Agreement without further notice.</p>
        
        <h3 style="margin-top: 16pt; margin-bottom: 8pt; font-size: 11pt; font-weight: bold;">4. SECURITY DEPOSIT</h3>
        <p style="text-align: justify; margin-bottom: 6pt;"><strong>4.1</strong> The Security Deposit shall be refunded within 30 working days from the date of vacating the Premises, after adjusting:</p>
        <ul style="margin-left: 24pt; margin-bottom: 8pt;">
          <li style="margin-bottom: 3pt;">Pending dues</li>
          <li style="margin-bottom: 3pt;">Damages (if any)</li>
          <li style="margin-bottom: 3pt;">Loss of property or assets</li>
          <li style="margin-bottom: 3pt;">Outstanding penalties</li>
        </ul>
        <p style="text-align: justify; margin-bottom: 6pt;"><strong>4.2</strong> The Security Deposit shall not be used by the Licensee towards monthly fees.</p>
        
        <h3 style="margin-top: 16pt; margin-bottom: 8pt; font-size: 11pt; font-weight: bold;">5. USE OF PREMISES</h3>
        <p style="text-align: justify; margin-bottom: 6pt;"><strong>5.1</strong> The Premises shall be used only for lawful business activities. Any illegal, immoral, or hazardous activities are strictly prohibited.</p>
        <p style="text-align: justify; margin-bottom: 6pt;"><strong>5.2</strong> The Licensee shall not:</p>
        <ul style="margin-left: 30px;">
          <li>Install permanent fixtures</li>
          <li>Alter or damage the Premises</li>
          <li>Store hazardous materials</li>
          <li>Conduct activities causing nuisance, noise, or disturbance</li>
          <li>Allow unauthorized persons to occupy the workspace</li>
        </ul>
        <p style="text-align: justify;"><strong>5.3</strong> The Licensee must maintain cleanliness and hygiene in its designated area.</p>
        <p style="text-align: justify;"><strong>5.4</strong> Sub-licensing, assignment, or sharing of the workspace is strictly prohibited.</p>
        
        <h3 style="margin-top: 25px; font-size: 14px;">6. MEETING ROOM & FACILITY RULES</h3>
        <p style="text-align: justify;"><strong>6.1</strong> Meeting room usage is subject to prior booking and availability.</p>
        <p style="text-align: justify;"><strong>6.2</strong> Overstay beyond the reserved slot may attract overtime charges.</p>
        <p style="text-align: justify;"><strong>6.3</strong> Common area usage shall be respectful and non-disruptive. Any events or visitors should be notified in advance and are subject to approval & charges at the discretion of the Licensor.</p>
        <p style="text-align: justify;"><strong>6.4</strong> Pantry use is for light refreshments only; cooking/heating heavy food items is prohibited.</p>
        
        <h3 style="margin-top: 25px; font-size: 14px;">7. INTERNET, IT & ELECTRICAL USAGE</h3>
        <p style="text-align: justify;"><strong>7.1</strong> The Licensee shall use the Licensor's internet responsibly and not engage in illegal downloads, hacking, or bandwidth abuse.</p>
        <p style="text-align: justify;"><strong>7.2</strong> High electrical load equipment (servers, printers, etc.) requires prior approval.</p>
        <p style="text-align: justify;"><strong>7.3</strong> The Licensor is not liable for internet downtime caused by third-party providers.</p>
        
        <h3 style="margin-top: 25px; font-size: 14px;">8. ACCESS & SECURITY</h3>
        <p style="text-align: justify;"><strong>8.1</strong> Normal access hours: Monday to Saturday 9:00 AM to 9:00 PM. The Premises will remain closed on all Sundays and Govt. declared public holidays (as notified from time to time) unless otherwise permitted.</p>
        <p style="text-align: justify;"><strong>8.2</strong> Licensee shall not tamper with CCTV, access control systems, or security devices.</p>
        <p style="text-align: justify;"><strong>8.3</strong> Visitors must follow the Licensor's entry protocols.</p>
        
        <h3 style="margin-top: 25px; font-size: 14px;">9. DAMAGE & LOSS</h3>
        <p style="text-align: justify;"><strong>9.1</strong> The Licensee shall be responsible for any damage caused by its employees, agents, or guests.</p>
        <p style="text-align: justify;"><strong>9.2</strong> The Licensor is not responsible for theft, loss, or damage to personal belongings, laptops, or equipment brought by the Licensee.</p>
        
        <h3 style="margin-top: 25px; font-size: 14px;">10. TERMINATION</h3>
        <p style="text-align: justify;"><strong>10.1</strong> Either Party may terminate this Agreement by giving 30 days prior written notice.</p>
        <p style="text-align: justify;"><strong>10.2</strong> The Licensor may terminate this leave and license agreement immediately if there is:</p>
        <ul style="margin-left: 30px;">
          <li>Non-payment of license fee for two months</li>
          <li>Any illegal activity, misconduct or nuisance by the Licensee or its employees</li>
          <li>Any damage caused to property & person by the Licensee or its employees</li>
          <li>Any Breach of Agreement terms by the Licensee or its employees</li>
        </ul>
        <p style="text-align: justify;"><strong>10.3</strong> On termination, the Licensee shall:</p>
        <ul style="margin-left: 30px;">
          <li>Vacate the workspace peacefully</li>
          <li>Remove all personal belongings</li>
          <li>Return access cards/keys</li>
          <li>Clear all dues</li>
        </ul>
        
        <h3 style="margin-top: 25px; font-size: 14px;">11. NO TENANCY / NO LEASE</h3>
        <p style="text-align: justify;"><strong>11.1</strong> This Agreement creates no tenancy, lease, occupancy rights, or interest in the Premises.</p>
        <p style="text-align: justify;"><strong>11.2</strong> The Licensee acknowledges that:</p>
        <ul style="margin-left: 30px;">
          <li>The Licensor retains full control over the Premises</li>
          <li>The Licensee's right is purely permissive</li>
          <li>This Agreement does not fall under the Rent Control Act</li>
        </ul>
        
        <h3 style="margin-top: 25px; font-size: 14px;">12. INDEMNITY</h3>
        <p style="text-align: justify;"><strong>12.1</strong> The Licensee agrees to indemnify and hold harmless the Licensor from all:</p>
        <ul style="margin-left: 30px;">
          <li>Legal claims</li>
          <li>Damages</li>
          <li>Liabilities</li>
          <li>Losses arising out of the Licensee's use of the Premises.</li>
        </ul>
        <p style="text-align: justify;"><strong>12.2</strong> The Licensee will be solely responsible for compliance with all applicable laws, payments of all statutory levies, dues, or liabilities including Goods & Service Tax (GST) arising from the use of the licensed premises. The Licensor will not be held responsible in any manner whatsoever for any such liabilities, defaults or non-compliances on the part of the Licensee.</p>
        
        <h3 style="margin-top: 25px; font-size: 14px;">13. LIMITATION OF LIABILITY</h3>
        <p style="text-align: justify;"><strong>13.1</strong> The Licensor shall not be responsible for:</p>
        <ul style="margin-left: 30px;">
          <li>Business losses</li>
          <li>Data loss</li>
          <li>Interruption of services due to external factors</li>
          <li>Acts of God, electrical failures, or internet breakdowns</li>
        </ul>
        <p style="text-align: justify;"><strong>13.2</strong> The maximum liability of the Licensor shall not exceed the monthly license fee.</p>
        
        <h3 style="margin-top: 25px; font-size: 14px;">14. GOVERNING LAW & JURISDICTION</h3>
        <p style="text-align: justify;"><strong>14.1</strong> This Agreement shall be governed by the laws of India.</p>
        <p style="text-align: justify;"><strong>14.2</strong> Courts in Faridabad, Haryana shall have exclusive jurisdiction.</p>
        
        <h3 style="margin-top: 25px; font-size: 14px;">15. MISCELLANEOUS</h3>
        <p style="text-align: justify;"><strong>15.1</strong> Any amendments must be in writing and signed by both Parties.</p>
        <p style="text-align: justify;"><strong>15.2</strong> Notices shall be served via email and registered post.</p>
        <p style="text-align: justify;"><strong>15.3</strong> If any clause is held invalid, the remaining clauses shall remain enforceable.</p>
        
        <h3 style="margin-top: 30px; font-size: 14px;">16. SIGNATURES</h3>
        <p>IN WITNESS WHEREOF, the Parties hereto have executed this Agreement on the date and year first written above.</p>
        
        <div style="margin-top: 40px; page-break-inside: avoid;">
          <table style="width: 100%; margin-top: 30px;">
            <tr>
              <td style="width: 50%; vertical-align: top; padding-right: 30px;">
                <p><strong>FOR THE LICENSOR</strong></p>
                <p>Thryve Coworking</p>
                <p>Name: ${data.for_Thryve}</p>
                <p>Designation: ${data.Thryve_Designation}</p>
                <p>Signature: ________________</p>
                <p>Date: ${data.Start_Date}</p>
              </td>
              <td style="width: 50%; vertical-align: top;">
                <p><strong>FOR THE LICENSEE</strong></p>
                <p>Name of Company: ${data.Companys_Name}</p>
                <p>Authorized Signatory: ${data.Authorized_Signatory}</p>
                <p>Designation: ${data.Designation}</p>
                <p>Signature: ________________</p>
                <p>Date: ${data.Start_Date}</p>
              </td>
            </tr>
          </table>
        </div>
        
        <div style="margin-top: 50px;">
          <p><strong>WITNESSES:</strong></p>
          <table style="width: 100%; margin-top: 20px;">
            <tr>
              <td style="width: 50%; vertical-align: top;">
                <p>1. Name: ________________</p>
                <p>&nbsp;&nbsp;&nbsp;Address: ________________</p>
                <p>&nbsp;&nbsp;&nbsp;Signature: ________________</p>
              </td>
              <td style="width: 50%; vertical-align: top;">
                <p>2. Name: ________________</p>
                <p>&nbsp;&nbsp;&nbsp;Address: ________________</p>
                <p>&nbsp;&nbsp;&nbsp;Signature: ________________</p>
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
      
      // Helper to create a paragraph with specific formatting
      const createPara = (text, options = {}) => new Paragraph({
        children: [new TextRun({ text, ...options })],
        spacing: { after: 120 },
        alignment: options.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED
      });

      const createBullet = (text) => new Paragraph({
        children: [new TextRun({ text: `• ${text}` })],
        spacing: { after: 80 },
        indent: { left: 720 }
      });

      const createNumbered = (num, text) => new Paragraph({
        children: [
          new TextRun({ text: `${num} `, bold: true }),
          new TextRun({ text })
        ],
        spacing: { after: 120 },
        alignment: AlignmentType.JUSTIFIED
      });

      const createHeading = (text) => new Paragraph({
        children: [new TextRun({ text, bold: true, font: "Calibri", size: 22 })],
        spacing: { before: 240, after: 120 }
      });
      
      const doc = new Document({
        styles: {
          default: {
            document: {
              run: {
                font: "Calibri",
                size: 22 // 11pt
              }
            }
          }
        },
        sections: [{
          properties: {
            page: {
              margin: { top: 1440, right: 1080, bottom: 1440, left: 1080 } // 1 inch top/bottom, 0.75 inch sides
            }
          },
          children: [
            // Title
            new Paragraph({
              children: [new TextRun({ text: "LEAVE & LICENSE AGREEMENT", bold: true, font: "Calibri", size: 28 })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 }
            }),
            
            // Opening
            new Paragraph({
              children: [
                new TextRun({ text: `THIS LEAVE AND LICENSE AGREEMENT ("Agreement") is executed on this ` }),
                new TextRun({ text: data.Day, bold: true }),
                new TextRun({ text: ` day of ` }),
                new TextRun({ text: data.Month_Year, bold: true }),
                new TextRun({ text: `, at Faridabad, Haryana,` }),
              ],
              spacing: { after: 200 },
              alignment: AlignmentType.JUSTIFIED
            }),
            
            // BETWEEN
            createPara("BETWEEN", { bold: true }),
            
            // Licensor
            new Paragraph({
              children: [
                new TextRun({ text: "Thryve Coworking", bold: true }),
                new TextRun({ text: `, (PAN AAYFT8213A & GSTIN 06AAYFT8213A1Z2) a business operating from: Plot No. 3, First Floor, Near Ajronda Metro Station, 18/1, Mathura Road, Faridabad, Haryana 121007, acting through its authorized representative, hereinafter referred to as the "` }),
                new TextRun({ text: "Licensor", bold: true }),
                new TextRun({ text: `", (which expression shall, unless repugnant to the context, include its successors, assigns, administrators, and representatives)` }),
              ],
              spacing: { after: 200 },
              alignment: AlignmentType.JUSTIFIED
            }),
            
            // AND
            new Paragraph({
              children: [new TextRun({ text: "AND", bold: true })],
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 }
            }),
            
            // Licensee
            new Paragraph({
              children: [
                new TextRun({ text: `M/s ${data.Companys_Name}`, bold: true }),
                new TextRun({ text: `, (PAN ${data.PAN_No} & GSTIN ${data.GSTIN}) having its Regd. office at: ${data.Address}, through its authorized signatory ` }),
                new TextRun({ text: data.Authorized_Signatory, bold: true }),
                new TextRun({ text: `, hereinafter referred to as the "` }),
                new TextRun({ text: "Licensee", bold: true }),
                new TextRun({ text: `", (which expression shall, unless repugnant to the context, include its successors, permitted assigns, employees, and representatives)` }),
              ],
              spacing: { after: 200 },
              alignment: AlignmentType.JUSTIFIED
            }),
            
            createPara(`The Licensor and the Licensee are collectively referred to as the "Parties" and individually as a "Party."`),
            
            // WHEREAS
            createHeading("WHEREAS"),
            createNumbered("1.", `The Licensor is operating a coworking facility known as "Thryve Coworking" at Plot No. 3, First Floor, Near Ajronda Metro Station, 18/1, Mathura Road, Faridabad 121007 ("hereinafter referred to as Premises").`),
            createNumbered("2.", "The Licensor is in lawful possession of the Premises and entitled to grant a license for the use of certain designated workspace(s), cabins, meeting rooms, and/or coworking desks."),
            createNumbered("3.", "The Licensee has requested use of the Licensor's coworking facilities and services, and the Licensor has agreed to grant the Licensee a limited, non-exclusive, revocable license with rights to enter and strictly for business use on the terms and conditions set forth below:"),
            
            createPara("NOW, THEREFORE, THE PARTIES AGREE AS FOLLOWS:", { bold: true }),
            
            // Section 1
            createHeading("1. LICENSED AREA & SERVICES"),
            createNumbered("1.1", "The Licensor grants to the Licensee a non-exclusive, non-transferable, revocable license for right to enter and use the following workspace(s) at the Premises:"),
            createBullet(data.Space_Description),
            createBullet(`Number of Seats: ${data.Seats}`),
            createBullet("Meeting Room Access: As per usage/plan"),
            createBullet("Common Areas: Reception, Lounge, Pantry, Washrooms, Hallways, and such other areas as designated by the Licensor."),
            createNumbered("1.2", "The License is limited to right to enter and use only, and no tenancy, lease, or rights of possession are created or transferred."),
            createNumbered("1.3", "The following services are included (as applicable to the chosen plan):"),
            createBullet("High-speed Internet"),
            createBullet("Electricity & Air Conditioning during business hours"),
            createBullet("Housekeeping of common spaces"),
            createBullet("Power Backup"),
            createBullet("Front Desk Assistance"),
            createBullet("Access to Pantry Facilities"),
            createBullet("Access to Conference Rooms (subject to availability and booking rules)"),
            createBullet("CCTV Surveillance (excluding private cabins)"),
            createNumbered("1.4", "The Licensor may modify or enhance services at its discretion."),
            
            // Section 2
            createHeading("2. TERM"),
            new Paragraph({
              children: [
                new TextRun({ text: "2.1 ", bold: true }),
                new TextRun({ text: `The term of this Agreement shall be for 11 months, commencing from ` }),
                new TextRun({ text: data.Start_Date, bold: true }),
                new TextRun({ text: ` ("Start Date") until ` }),
                new TextRun({ text: data.End_Date, bold: true }),
                new TextRun({ text: ` ("End Date"), unless terminated earlier. There will be a lock-in period of ` }),
                new TextRun({ text: `${data.Lock_in} months`, bold: true }),
                new TextRun({ text: ` before which the Licensee will not terminate this Leave & License Deed.` }),
              ],
              spacing: { after: 120 },
              alignment: AlignmentType.JUSTIFIED
            }),
            createNumbered("2.2", "Renewal shall be subject to discretion of the Licensor and a new Leave & License Deed will be executed."),
            
            // Section 3
            createHeading("3. LICENSE FEES & PAYMENTS"),
            createNumbered("3.1", "The Licensee agrees to pay:"),
            createBullet(`Monthly License Fee per seat/member: Rs. ${data.License_fee.toLocaleString('en-IN')}/-`),
            createBullet(`Security Deposit (interest-free): Rs. ${data.Security.toLocaleString('en-IN')}/-`),
            createBullet(`Setup Charges (if any): ${typeof data.Setup_charges === 'number' ? `Rs. ${data.Setup_charges.toLocaleString('en-IN')}/-` : data.Setup_charges}`),
            createBullet("GST/other applicable taxes/extra usage of facilities will be paid extra."),
            createNumbered("3.2", "The License Fee shall be payable in advance on or before the 5th day of each English calendar month."),
            createNumbered("3.3", "Delay in payment beyond the due date attracts a penalty of Rs. 500/- per day apart from the outstanding dues until the full outstanding payment is made."),
            createNumbered("3.4", "Non-payment for two consecutive months constitutes a material breach, allowing the Licensor to terminate the Agreement without further notice."),
            
            // Section 4
            createHeading("4. SECURITY DEPOSIT"),
            createNumbered("4.1", "The Security Deposit shall be refunded within 30 working days from the date of vacating the Premises, after adjusting:"),
            createBullet("Pending dues"),
            createBullet("Damages (if any)"),
            createBullet("Loss of property or assets"),
            createBullet("Outstanding penalties"),
            createNumbered("4.2", "The Security Deposit shall not be used by the Licensee towards monthly fees."),
            
            // Section 5
            createHeading("5. USE OF PREMISES"),
            createNumbered("5.1", "The Premises shall be used only for lawful business activities. Any illegal, immoral, or hazardous activities are strictly prohibited."),
            createNumbered("5.2", "The Licensee shall not:"),
            createBullet("Install permanent fixtures"),
            createBullet("Alter or damage the Premises"),
            createBullet("Store hazardous materials"),
            createBullet("Conduct activities causing nuisance, noise, or disturbance"),
            createBullet("Allow unauthorized persons to occupy the workspace"),
            createNumbered("5.3", "The Licensee must maintain cleanliness and hygiene in its designated area."),
            createNumbered("5.4", "Sub-licensing, assignment, or sharing of the workspace is strictly prohibited."),
            
            // Section 6
            createHeading("6. MEETING ROOM & FACILITY RULES"),
            createNumbered("6.1", "Meeting room usage is subject to prior booking and availability."),
            createNumbered("6.2", "Overstay beyond the reserved slot may attract overtime charges."),
            createNumbered("6.3", "Common area usage shall be respectful and non-disruptive. Any events or visitors should be notified in advance and are subject to approval & charges at the discretion of the Licensor."),
            createNumbered("6.4", "Pantry use is for light refreshments only; cooking/heating heavy food items is prohibited."),
            
            // Section 7
            createHeading("7. INTERNET, IT & ELECTRICAL USAGE"),
            createNumbered("7.1", "The Licensee shall use the Licensor's internet responsibly and not engage in illegal downloads, hacking, or bandwidth abuse."),
            createNumbered("7.2", "High electrical load equipment (servers, printers, etc.) requires prior approval."),
            createNumbered("7.3", "The Licensor is not liable for internet downtime caused by third-party providers."),
            
            // Section 8
            createHeading("8. ACCESS & SECURITY"),
            createNumbered("8.1", "Normal access hours: Monday to Saturday 9:00 AM to 9:00 PM. The Premises will remain closed on all Sundays and Govt. declared public holidays (as notified from time to time) unless otherwise permitted."),
            createNumbered("8.2", "Licensee shall not tamper with CCTV, access control systems, or security devices."),
            createNumbered("8.3", "Visitors must follow the Licensor's entry protocols."),
            
            // Section 9
            createHeading("9. DAMAGE & LOSS"),
            createNumbered("9.1", "The Licensee shall be responsible for any damage caused by its employees, agents, or guests."),
            createNumbered("9.2", "The Licensor is not responsible for theft, loss, or damage to personal belongings, laptops, or equipment brought by the Licensee."),
            
            // Section 10
            createHeading("10. TERMINATION"),
            createNumbered("10.1", "Either Party may terminate this Agreement by giving 30 days prior written notice."),
            createNumbered("10.2", "The Licensor may terminate this leave and license agreement immediately if there is:"),
            createBullet("Non-payment of license fee for two months"),
            createBullet("Any illegal activity, misconduct or nuisance by the Licensee or its employees"),
            createBullet("Any damage caused to property & person by the Licensee or its employees"),
            createBullet("Any Breach of Agreement terms by the Licensee or its employees"),
            createNumbered("10.3", "On termination, the Licensee shall:"),
            createBullet("Vacate the workspace peacefully"),
            createBullet("Remove all personal belongings"),
            createBullet("Return access cards/keys"),
            createBullet("Clear all dues"),
            
            // Section 11
            createHeading("11. NO TENANCY / NO LEASE"),
            createNumbered("11.1", "This Agreement creates no tenancy, lease, occupancy rights, or interest in the Premises."),
            createNumbered("11.2", "The Licensee acknowledges that:"),
            createBullet("The Licensor retains full control over the Premises"),
            createBullet("The Licensee's right is purely permissive"),
            createBullet("This Agreement does not fall under the Rent Control Act"),
            
            // Section 12
            createHeading("12. INDEMNITY"),
            createNumbered("12.1", "The Licensee agrees to indemnify and hold harmless the Licensor from all:"),
            createBullet("Legal claims"),
            createBullet("Damages"),
            createBullet("Liabilities"),
            createBullet("Losses arising out of the Licensee's use of the Premises."),
            createNumbered("12.2", "The Licensee will be solely responsible for compliance with all applicable laws, payments of all statutory levies, dues, or liabilities including Goods & Service Tax (GST) arising from the use of the licensed premises. The Licensor will not be held responsible in any manner whatsoever for any such liabilities, defaults or non-compliances on the part of the Licensee."),
            
            // Section 13
            createHeading("13. LIMITATION OF LIABILITY"),
            createNumbered("13.1", "The Licensor shall not be responsible for:"),
            createBullet("Business losses"),
            createBullet("Data loss"),
            createBullet("Interruption of services due to external factors"),
            createBullet("Acts of God, electrical failures, or internet breakdowns"),
            createNumbered("13.2", "The maximum liability of the Licensor shall not exceed the monthly license fee."),
            
            // Section 14
            createHeading("14. GOVERNING LAW & JURISDICTION"),
            createNumbered("14.1", "This Agreement shall be governed by the laws of India."),
            createNumbered("14.2", "Courts in Faridabad, Haryana shall have exclusive jurisdiction."),
            
            // Section 15
            createHeading("15. MISCELLANEOUS"),
            createNumbered("15.1", "Any amendments must be in writing and signed by both Parties."),
            createNumbered("15.2", "Notices shall be served via email and registered post."),
            createNumbered("15.3", "If any clause is held invalid, the remaining clauses shall remain enforceable."),
            
            // Section 16 - Signatures
            createHeading("16. SIGNATURES"),
            createPara("IN WITNESS WHEREOF, the Parties hereto have executed this Agreement on the date and year first written above."),
            
            new Paragraph({ text: "", spacing: { after: 300 } }),
            
            // Licensor signature block
            createPara("FOR THE LICENSOR", { bold: true }),
            createPara("Thryve Coworking"),
            createPara(`Name: ${data.for_Thryve}`),
            createPara(`Designation: ${data.Thryve_Designation}`),
            createPara("Signature: ________________"),
            createPara(`Date: ${data.Start_Date}`),
            
            new Paragraph({ text: "", spacing: { after: 300 } }),
            
            // Licensee signature block
            createPara("FOR THE LICENSEE", { bold: true }),
            createPara(`Name of Company: ${data.Companys_Name}`),
            createPara(`Authorized Signatory: ${data.Authorized_Signatory}`),
            createPara(`Designation: ${data.Designation}`),
            createPara("Signature: ________________"),
            createPara(`Date: ${data.Start_Date}`),
            
            new Paragraph({ text: "", spacing: { after: 400 } }),
            
            // Witnesses
            createPara("WITNESSES:", { bold: true }),
            new Paragraph({ text: "", spacing: { after: 200 } }),
            createPara("1. Name: ________________"),
            createPara("   Address: ________________"),
            createPara("   Signature: ________________"),
            new Paragraph({ text: "", spacing: { after: 200 } }),
            createPara("2. Name: ________________"),
            createPara("   Address: ________________"),
            createPara("   Signature: ________________"),
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
            body { 
              font-family: Calibri, 'Segoe UI', Arial, sans-serif; 
              font-size: 11pt;
              line-height: 1.5;
              color: #000;
            }
            @media print { 
              body { margin: 20mm 15mm; }
              @page { size: A4; margin: 20mm 15mm; }
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
          Generate complete LLA documents for clients
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
                  <th className="text-left p-3 text-[#2E375B]">Rate/Seat</th>
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
                      <td className="p-3 text-[#2E375B]">₹{(company.rate_per_seat || 0).toLocaleString('en-IN')}</td>
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
