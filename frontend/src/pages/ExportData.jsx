import { useState } from "react";
import { Download, FileSpreadsheet, Building2, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import axios from "axios";
import * as XLSX from "xlsx";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ExportData() {
  const [exportingClients, setExportingClients] = useState(false);
  const [exportingMembers, setExportingMembers] = useState(false);

  const exportClientsData = async () => {
    setExportingClients(true);
    try {
      const response = await axios.get(`${API}/companies`);
      const companies = response.data;

      if (companies.length === 0) {
        toast.error("No client data to export");
        setExportingClients(false);
        return;
      }

      const exportData = companies.map(company => ({
        "Company Name": company.company_name || "",
        "Status": company.status || "",
        "Plan": company.plan_name || "",
        "Total Seats": company.total_seats || 0,
        "Seats Occupied": company.seats_occupied || 0,
        "Rate per Seat (₹)": company.rate_per_seat || 0,
        "Discount (%)": company.discount_percent || 0,
        "Monthly Rate (₹)": company.total_rate || 0,
        "Meeting Credits/Seat (min)": company.meeting_room_credits || 0,
        "Start Date": company.start_date || "",
        "GSTIN": company.company_gstin || "",
        "PAN": company.company_pan || "",
        "Email": company.company_email || "",
        "Website": company.company_website || "",
        "Address": company.company_address || "",
        "Signatory Name": company.signatory_name || "",
        "Signatory Phone": company.signatory_phone || "",
        "Signatory Email": company.signatory_email || "",
        "Signatory Aadhar": company.signatory_aadhar || "",
        "Signatory PAN": company.signatory_pan || "",
        "ISP Provider": company.isp_provider || "",
        "Bandwidth": company.bandwidth_speed || "",
        "ISP Account ID": company.isp_account_id || "",
        "Notes": company.notes || "",
        "Created At": company.created_at || ""
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Clients");

      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Thryve_Clients_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${exportData.length} clients to Excel`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data");
    } finally {
      setExportingClients(false);
    }
  };

  const exportMembersData = async () => {
    setExportingMembers(true);
    try {
      const response = await axios.get(`${API}/management/members`);
      const members = response.data;

      if (members.length === 0) {
        toast.error("No member data to export");
        setExportingMembers(false);
        return;
      }

      const exportData = members.map(member => ({
        "Name": member.name || "",
        "Email": member.email || "",
        "Phone": member.phone || "",
        "Company": member.company_name || "",
        "Status": member.status || "",
        "Aadhar Number": member.aadhar_number || "",
        "PAN Number": member.pan_number || "",
        "Address": member.address || "",
        "Emergency Contact": member.emergency_contact || "",
        "Join Date": member.join_date || "",
        "Notes": member.notes || "",
        "Created At": member.created_at || ""
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Members");

      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Thryve_Members_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${exportData.length} members to Excel`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data");
    } finally {
      setExportingMembers(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="export-data-page">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#2E375B] tracking-tight font-[Manrope]">
          Export Client's Data
        </h1>
        <p className="text-[#2E375B] mt-1">
          Download client and member information as Excel files
        </p>
      </div>

      {/* Export Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border border-[#2E375B]/10">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#2E375B]/10 rounded-lg">
                <Building2 className="w-6 h-6 text-[#2E375B]" />
              </div>
              <div>
                <CardTitle className="text-lg text-[#2E375B]">Client Data</CardTitle>
                <CardDescription className="text-[#2E375B]">Export all client/company information</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-[#2E375B]">
                <p className="font-medium mb-2">Includes:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Company details (name, GSTIN, PAN, address)</li>
                  <li>Contact information (email, website)</li>
                  <li>Authorised signatory details</li>
                  <li>Subscription details (plan, seats, rate)</li>
                  <li>Internet/bandwidth information</li>
                  <li>Status and dates</li>
                </ul>
              </div>
              <Button 
                onClick={exportClientsData}
                disabled={exportingClients}
                className="w-full bg-[#2E375B] hover:bg-[#232B47]"
                data-testid="export-clients-btn"
              >
                {exportingClients ? (
                  <>
                    <FileSpreadsheet className="w-4 h-4 mr-2 animate-pulse" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download Excel
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-[#2E375B]/10">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#2E375B]/10 rounded-lg">
                <Users className="w-6 h-6 text-[#2E375B]" />
              </div>
              <div>
                <CardTitle className="text-lg text-[#2E375B]">Member Data</CardTitle>
                <CardDescription className="text-[#2E375B]">Export all member information</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-[#2E375B]">
                <p className="font-medium mb-2">Includes:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Member personal details</li>
                  <li>Company association</li>
                  <li>Contact information (email, phone)</li>
                  <li>Aadhar and PAN details</li>
                  <li>Emergency contact</li>
                  <li>Status and join dates</li>
                </ul>
              </div>
              <Button 
                onClick={exportMembersData}
                disabled={exportingMembers}
                className="w-full bg-[#2E375B] hover:bg-[#232B47]"
                data-testid="export-members-btn"
              >
                {exportingMembers ? (
                  <>
                    <FileSpreadsheet className="w-4 h-4 mr-2 animate-pulse" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download Excel
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
