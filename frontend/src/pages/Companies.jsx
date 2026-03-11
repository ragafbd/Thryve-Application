import { useEffect, useState } from "react";
import { Plus, Building2, Users, ChevronRight, ChevronDown, Edit, Trash2, UserPlus, Search, MoreVertical, UserX, RefreshCw, CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const StatusBadge = ({ status }) => {
  const config = {
    active: { label: "Active", className: "bg-green-100 text-green-700" },
    inactive: { label: "Inactive", className: "bg-slate-100 text-slate-700" },
    terminated: { label: "Terminated", className: "bg-red-100 text-red-700" }
  };
  const { label, className } = config[status] || config.inactive;
  return <Badge className={className}>{label}</Badge>;
};

export default function Companies() {
  const [companies, setCompanies] = useState([]);
  const [plans, setPlans] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedCompany, setExpandedCompany] = useState(null);
  
  // Company dialog
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [signatoryIsMember, setSignatoryIsMember] = useState(false);
  const [companyForm, setCompanyForm] = useState({
    company_name: "",
    company_address: "",
    company_gstin: "",
    company_pan: "",
    company_email: "",
    company_website: "",
    signatory_name: "",
    signatory_aadhar: "",
    signatory_pan: "",
    signatory_phone: "",
    signatory_email: "",
    plan_type_id: "",
    total_seats: "",
    rate_per_seat: "",
    discount_percent: "",
    meeting_room_credits: "",
    start_date: "",
    isp_provider: "",
    bandwidth_speed: "",
    isp_account_id: "",
    notes: ""
  });
  
  // Member dialog
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [selectedCompanyForMember, setSelectedCompanyForMember] = useState(null);
  const [memberForm, setMemberForm] = useState({
    name: "",
    email: "",
    phone: "",
    aadhar_number: "",
    pan_number: "",
    date_of_birth: "",
    seat_number: "",
    is_primary_contact: false,
    notes: ""
  });
  
  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteType, setDeleteType] = useState(""); // "company" or "member"
  
  const [saving, setSaving] = useState(false);

  const fetchCompanies = async () => {
    try {
      const query = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const response = await axios.get(`${API}/companies${query}`);
      setCompanies(response.data);
    } catch (error) {
      toast.error("Failed to fetch companies");
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const response = await axios.get(`${API}/management/plans`);
      setPlans(response.data);
    } catch (error) {
      console.error("Failed to fetch plans");
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/companies/stats/summary`);
      setStats(response.data);
    } catch (error) {
      console.error("Failed to fetch stats");
    }
  };

  useEffect(() => {
    fetchCompanies();
    fetchPlans();
    fetchStats();
  }, [statusFilter]);

  const resetCompanyForm = () => {
    setCompanyForm({
      company_name: "",
      company_address: "",
      company_gstin: "",
      company_pan: "",
      company_email: "",
      company_website: "",
      signatory_name: "",
      signatory_aadhar: "",
      signatory_pan: "",
      signatory_phone: "",
      signatory_email: "",
      plan_type_id: "",
      total_seats: "",
      rate_per_seat: "",
      discount_percent: "",
      meeting_room_credits: "",
      start_date: "",
      isp_provider: "",
      bandwidth_speed: "",
      isp_account_id: "",
      notes: ""
    });
    setEditingCompany(null);
    setSignatoryIsMember(false);
  };

  const resetMemberForm = () => {
    setMemberForm({
      name: "",
      email: "",
      phone: "",
      aadhar_number: "",
      pan_number: "",
      seat_number: "",
      is_primary_contact: false,
      notes: ""
    });
  };

  const openCompanyDialog = (company = null) => {
    if (company) {
      setEditingCompany(company);
      setCompanyForm({
        company_name: company.company_name,
        company_address: company.company_address || "",
        company_gstin: company.company_gstin || "",
        company_pan: company.company_pan || "",
        company_email: company.company_email || "",
        company_website: company.company_website || "",
        signatory_name: company.signatory_name || "",
        signatory_aadhar: company.signatory_aadhar || "",
        signatory_pan: company.signatory_pan || "",
        signatory_phone: company.signatory_phone || "",
        signatory_email: company.signatory_email || "",
        plan_type_id: company.plan_type_id,
        total_seats: company.total_seats,
        rate_per_seat: company.rate_per_seat,
        discount_percent: company.discount_percent || "",
        meeting_room_credits: company.meeting_room_credits || "",
        start_date: company.start_date,
        isp_provider: company.isp_provider || "",
        bandwidth_speed: company.bandwidth_speed || "",
        isp_account_id: company.isp_account_id || "",
        notes: company.notes || ""
      });
    } else {
      resetCompanyForm();
    }
    setCompanyDialogOpen(true);
  };

  const openMemberDialog = (company) => {
    setSelectedCompanyForMember(company);
    resetMemberForm();
    setMemberDialogOpen(true);
  };

  const handleSaveCompany = async () => {
    if (!companyForm.company_name || !companyForm.plan_type_id || !companyForm.rate_per_seat || !companyForm.total_seats || !companyForm.start_date) {
      toast.error("Please fill in all required fields (Company Name, Plan, Seats, Rate, Start Date)");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...companyForm,
        total_seats: parseInt(companyForm.total_seats) || 1,
        rate_per_seat: parseFloat(companyForm.rate_per_seat) || 0,
        discount_percent: companyForm.discount_percent ? parseFloat(companyForm.discount_percent) : 0,
        meeting_room_credits: companyForm.meeting_room_credits ? parseInt(companyForm.meeting_room_credits) : 0
      };

      if (editingCompany) {
        await axios.put(`${API}/companies/${editingCompany.id}`, payload);
        toast.success("Company updated successfully");
      } else {
        // Create company
        const companyResponse = await axios.post(`${API}/companies`, payload);
        const newCompany = companyResponse.data;
        toast.success("Company created successfully");
        
        // If signatory is also a member, create member record automatically
        if (signatoryIsMember && companyForm.signatory_name && companyForm.signatory_email) {
          try {
            await axios.post(`${API}/companies/${newCompany.id}/members`, {
              company_id: newCompany.id,
              name: companyForm.signatory_name,
              email: companyForm.signatory_email,
              phone: companyForm.signatory_phone || "",
              aadhar_number: companyForm.signatory_aadhar || "",
              pan_number: companyForm.signatory_pan || "",
              is_primary_contact: true,
              notes: "Auto-added as authorized signatory"
            });
            toast.success("Signatory added as member");
          } catch (memberError) {
            console.error("Failed to add signatory as member:", memberError);
            toast.warning("Company created, but failed to add signatory as member");
          }
        }
      }
      setCompanyDialogOpen(false);
      resetCompanyForm();
      fetchCompanies();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save company");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMember = async () => {
    if (!memberForm.name || !memberForm.email || !memberForm.phone) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      await axios.post(`${API}/companies/${selectedCompanyForMember.id}/members`, {
        ...memberForm,
        company_id: selectedCompanyForMember.id
      });
      toast.success("Member added successfully");
      setMemberDialogOpen(false);
      resetMemberForm();
      fetchCompanies();
      // Refresh expanded company
      if (expandedCompany === selectedCompanyForMember.id) {
        const response = await axios.get(`${API}/companies/${selectedCompanyForMember.id}`);
        setCompanies(prev => prev.map(c => c.id === selectedCompanyForMember.id ? response.data : c));
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to add member");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    
    try {
      if (deleteType === "company") {
        await axios.delete(`${API}/companies/${itemToDelete.id}`);
        toast.success("Company deleted");
      } else if (deleteType === "member") {
        await axios.delete(`${API}/companies/${itemToDelete.company_id}/members/${itemToDelete.id}`);
        toast.success("Member removed");
      }
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      fetchCompanies();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Delete failed");
    }
  };

  const handleTerminateCompany = async (company) => {
    try {
      await axios.post(`${API}/companies/${company.id}/terminate`, {
        end_date: new Date().toISOString().split('T')[0],
        termination_reason: "Subscription ended",
        has_outstanding_dues: false
      });
      toast.success("Company terminated");
      fetchCompanies();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to terminate");
    }
  };

  const handleReactivateCompany = async (company) => {
    try {
      await axios.post(`${API}/companies/${company.id}/reactivate`);
      toast.success("Company reactivated");
      fetchCompanies();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to reactivate");
    }
  };

  const toggleExpand = async (companyId) => {
    if (expandedCompany === companyId) {
      setExpandedCompany(null);
    } else {
      // Fetch company with members
      try {
        const response = await axios.get(`${API}/companies/${companyId}`);
        setCompanies(prev => prev.map(c => c.id === companyId ? response.data : c));
        setExpandedCompany(companyId);
      } catch (error) {
        toast.error("Failed to load members");
      }
    }
  };

  const filteredCompanies = companies.filter(c => 
    c.company_name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedPlan = plans.find(p => p.id === companyForm.plan_type_id);

  return (
    <div className="space-y-6 animate-fade-in" data-testid="companies-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#2E375B] tracking-tight font-[Manrope]">
            Clients
          </h1>
          <p className="text-[#2E375B]/60 mt-1">
            Manage clients and their members
          </p>
        </div>
        <Button 
          onClick={() => openCompanyDialog()}
          className="bg-[#2E375B] hover:bg-[#232B47]"
          data-testid="add-company-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Client
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-[#2E375B]/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-[#2E375B]/60">Active Companies</p>
                <p className="text-2xl font-bold text-[#2E375B]">{stats.active_companies || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-[#2E375B]/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-[#2E375B]/60">Seats Occupied</p>
                <p className="text-2xl font-bold text-[#2E375B]">{stats.occupied_seats || 0} / {stats.total_seats || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-[#2E375B]/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#FFA14A]/20 rounded-lg">
                <CreditCard className="w-5 h-5 text-[#FFA14A]" />
              </div>
              <div>
                <p className="text-sm text-[#2E375B]/60">Monthly Revenue</p>
                <p className="text-2xl font-bold text-[#2E375B]">₹{(stats.monthly_revenue || 0).toLocaleString('en-IN')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border border-[#2E375B]/10">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search companies..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Companies List */}
      <div className="space-y-4">
        {loading ? (
          <Card className="border border-[#2E375B]/10">
            <CardContent className="p-8 text-center text-[#2E375B]/60">
              Loading companies...
            </CardContent>
          </Card>
        ) : filteredCompanies.length === 0 ? (
          <Card className="border border-[#2E375B]/10">
            <CardContent className="p-8 text-center text-[#2E375B]/60">
              No clients found. Click "Add Client" to create one.
            </CardContent>
          </Card>
        ) : (
          filteredCompanies.map((company) => (
            <Card key={company.id} className="border border-[#2E375B]/10">
              <Collapsible open={expandedCompany === company.id}>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <CollapsibleTrigger 
                      onClick={() => toggleExpand(company.id)}
                      className="flex items-center gap-3 flex-1 text-left"
                    >
                      {expandedCompany === company.id ? (
                        <ChevronDown className="w-5 h-5 text-[#2E375B]" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-[#2E375B]" />
                      )}
                      <Building2 className="w-5 h-5 text-[#FFA14A]" />
                      <div>
                        <h3 className="font-semibold text-[#2E375B]">{company.company_name}</h3>
                        <p className="text-sm text-[#2E375B]/60">
                          {company.plan_name} • {company.seats_occupied || 0}/{company.total_seats} seats • 
                          ₹{company.total_rate?.toLocaleString('en-IN')}/mo
                        </p>
                      </div>
                    </CollapsibleTrigger>
                    
                    <div className="flex items-center gap-3">
                      <StatusBadge status={company.status} />
                      <Badge variant="outline" className="text-[#2E375B]">
                        {company.meeting_room_credits} min credits
                      </Badge>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openCompanyDialog(company)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Company
                          </DropdownMenuItem>
                          {company.status === "active" && (
                            <DropdownMenuItem onClick={() => openMemberDialog(company)}>
                              <UserPlus className="w-4 h-4 mr-2" />
                              Add Member
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {company.status === "active" ? (
                            <DropdownMenuItem 
                              className="text-amber-600"
                              onClick={() => handleTerminateCompany(company)}
                            >
                              <UserX className="w-4 h-4 mr-2" />
                              Terminate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleReactivateCompany(company)}>
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Reactivate
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
                
                <CollapsibleContent>
                  <div className="border-t border-[#2E375B]/10 p-4 bg-slate-50/50">
                    {/* Company Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                      <div>
                        <p className="text-[#2E375B]/60">GSTIN</p>
                        <p className="font-medium text-[#2E375B]">{company.company_gstin || "-"}</p>
                      </div>
                      <div>
                        <p className="text-[#2E375B]/60">PAN</p>
                        <p className="font-medium text-[#2E375B]">{company.company_pan || "-"}</p>
                      </div>
                      <div>
                        <p className="text-[#2E375B]/60">Rate/Seat</p>
                        <p className="font-medium text-[#2E375B]">₹{company.rate_per_seat?.toLocaleString('en-IN')}</p>
                      </div>
                      <div>
                        <p className="text-[#2E375B]/60">Start Date</p>
                        <p className="font-medium text-[#2E375B]">{company.start_date}</p>
                      </div>
                    </div>
                    
                    {/* Members */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-[#2E375B] flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          Members ({company.members?.length || 0})
                        </h4>
                        {company.status === "active" && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => openMemberDialog(company)}
                          >
                            <UserPlus className="w-4 h-4 mr-1" />
                            Add Member
                          </Button>
                        )}
                      </div>
                      
                      {company.members?.length > 0 ? (
                        <div className="bg-white rounded-lg border">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-slate-50">
                                <th className="text-left p-3 text-[#2E375B]/70">Name</th>
                                <th className="text-left p-3 text-[#2E375B]/70">Email</th>
                                <th className="text-left p-3 text-[#2E375B]/70">Phone</th>
                                <th className="text-left p-3 text-[#2E375B]/70">Seat</th>
                                <th className="text-right p-3 text-[#2E375B]/70">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {company.members.map((member) => (
                                <tr key={member.id} className="border-b last:border-0">
                                  <td className="p-3">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-[#2E375B]">{member.name}</span>
                                      {member.is_primary_contact && (
                                        <Badge className="bg-blue-100 text-blue-700 text-xs">Primary</Badge>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-3 text-[#2E375B]/70">{member.email}</td>
                                  <td className="p-3 text-[#2E375B]/70">{member.phone}</td>
                                  <td className="p-3 text-[#2E375B]/70">{member.seat_number || "-"}</td>
                                  <td className="p-3 text-right">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-red-500 hover:text-red-700"
                                      onClick={() => {
                                        setItemToDelete({ ...member, company_id: company.id });
                                        setDeleteType("member");
                                        setDeleteDialogOpen(true);
                                      }}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-[#2E375B]/50 italic">No members added yet</p>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))
        )}
      </div>

      {/* Add/Edit Company Dialog */}
      <Dialog open={companyDialogOpen} onOpenChange={(open) => { setCompanyDialogOpen(open); if (!open) resetCompanyForm(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-[Manrope] text-[#2E375B]">
              {editingCompany ? "Edit Client" : "Add New Client"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Company Details */}
            <div>
              <h3 className="text-sm font-semibold text-[#2E375B] mb-3 border-b pb-2">Company Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>Company Name *</Label>
                  <Input
                    value={companyForm.company_name}
                    onChange={(e) => setCompanyForm({ ...companyForm, company_name: e.target.value })}
                    placeholder="Enter company name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Company GSTIN</Label>
                  <Input
                    value={companyForm.company_gstin}
                    onChange={(e) => setCompanyForm({ ...companyForm, company_gstin: e.target.value.toUpperCase().slice(0, 15) })}
                    placeholder="Enter GSTIN"
                    maxLength={15}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Company PAN</Label>
                  <Input
                    value={companyForm.company_pan}
                    onChange={(e) => setCompanyForm({ ...companyForm, company_pan: e.target.value.toUpperCase().slice(0, 10) })}
                    placeholder="Enter PAN"
                    maxLength={10}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email ID</Label>
                  <Input
                    type="email"
                    value={companyForm.company_email}
                    onChange={(e) => setCompanyForm({ ...companyForm, company_email: e.target.value })}
                    placeholder="Enter company email"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input
                    value={companyForm.company_website}
                    onChange={(e) => setCompanyForm({ ...companyForm, company_website: e.target.value })}
                    placeholder="Enter website URL"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Company Address</Label>
                  <Input
                    value={companyForm.company_address}
                    onChange={(e) => setCompanyForm({ ...companyForm, company_address: e.target.value })}
                    placeholder="Enter full registered address"
                  />
                </div>
              </div>
            </div>

            {/* Authorised Signatory Details */}
            <div>
              <h3 className="text-sm font-semibold text-[#2E375B] mb-3 border-b pb-2">Authorised Signatory Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={companyForm.signatory_name}
                    onChange={(e) => setCompanyForm({ ...companyForm, signatory_name: e.target.value })}
                    placeholder="Enter signatory name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input
                    value={companyForm.signatory_phone}
                    onChange={(e) => setCompanyForm({ ...companyForm, signatory_phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    placeholder="Enter phone number"
                    maxLength={10}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email ID</Label>
                  <Input
                    type="email"
                    value={companyForm.signatory_email}
                    onChange={(e) => setCompanyForm({ ...companyForm, signatory_email: e.target.value })}
                    placeholder="Enter email"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Aadhar Number</Label>
                  <Input
                    value={companyForm.signatory_aadhar}
                    onChange={(e) => setCompanyForm({ ...companyForm, signatory_aadhar: e.target.value.replace(/\D/g, '').slice(0, 12) })}
                    placeholder="Enter Aadhar number"
                    maxLength={12}
                  />
                </div>
                <div className="space-y-2">
                  <Label>PAN</Label>
                  <Input
                    value={companyForm.signatory_pan}
                    onChange={(e) => setCompanyForm({ ...companyForm, signatory_pan: e.target.value.toUpperCase().slice(0, 10) })}
                    placeholder="Enter PAN"
                    maxLength={10}
                  />
                </div>
                {/* Only show checkbox when creating new company, not editing */}
                {!editingCompany && (
                  <div className="md:col-span-2 flex items-center space-x-2 pt-2">
                    <Checkbox
                      id="signatory-is-member"
                      checked={signatoryIsMember}
                      onCheckedChange={(checked) => setSignatoryIsMember(checked)}
                      data-testid="signatory-is-member-checkbox"
                    />
                    <Label 
                      htmlFor="signatory-is-member" 
                      className="text-sm font-normal cursor-pointer"
                    >
                      Signatory is also a member (auto-add to members list)
                    </Label>
                  </div>
                )}
              </div>
            </div>

            {/* Subscription Details */}
            <div>
              <h3 className="text-sm font-semibold text-[#2E375B] mb-3 border-b pb-2">Subscription Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Plan Type *</Label>
                  <Select 
                    value={companyForm.plan_type_id} 
                    onValueChange={(value) => {
                      setCompanyForm({ 
                        ...companyForm, 
                        plan_type_id: value
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select plan type" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map(plan => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Number of Seats *</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={companyForm.total_seats}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setCompanyForm({ ...companyForm, total_seats: val });
                    }}
                    placeholder="Enter number of seats"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rate per Seat (₹) *</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={companyForm.rate_per_seat}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^\d.]/g, '');
                      setCompanyForm({ ...companyForm, rate_per_seat: val });
                    }}
                    placeholder=""
                  />
                </div>
                <div className="space-y-2">
                  <Label>Discount (%)</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={companyForm.discount_percent}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^\d.]/g, '');
                      setCompanyForm({ ...companyForm, discount_percent: val });
                    }}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Meeting Room Credits (minutes per seat)</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={companyForm.meeting_room_credits}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setCompanyForm({ ...companyForm, meeting_room_credits: val });
                    }}
                    placeholder="Enter credits per seat"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Input
                    type="date"
                    value={companyForm.start_date}
                    onChange={(e) => setCompanyForm({ ...companyForm, start_date: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Internet/Bandwidth Details */}
            <div>
              <h3 className="text-sm font-semibold text-[#2E375B] mb-3 border-b pb-2">Internet/Bandwidth Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ISP Provider</Label>
                  <Input
                    value={companyForm.isp_provider}
                    onChange={(e) => setCompanyForm({ ...companyForm, isp_provider: e.target.value })}
                    placeholder="Enter ISP name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bandwidth Speed</Label>
                  <Input
                    value={companyForm.bandwidth_speed}
                    onChange={(e) => setCompanyForm({ ...companyForm, bandwidth_speed: e.target.value })}
                    placeholder="e.g., 100 Mbps"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account/Connection ID</Label>
                  <Input
                    value={companyForm.isp_account_id}
                    onChange={(e) => setCompanyForm({ ...companyForm, isp_account_id: e.target.value })}
                    placeholder="Enter account number"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input
                    value={companyForm.notes}
                    onChange={(e) => setCompanyForm({ ...companyForm, notes: e.target.value })}
                    placeholder="Additional notes"
                  />
                </div>
              </div>
            </div>

            {/* Calculation Preview */}
            {companyForm.plan_type_id && companyForm.rate_per_seat && companyForm.total_seats && (
              <div className="bg-[#2E375B]/5 p-4 rounded-lg">
                <h4 className="font-semibold text-sm text-[#2E375B] mb-2">Subscription Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-[#2E375B]/60">Seats</p>
                    <p className="font-bold text-[#2E375B]">{companyForm.total_seats || 0}</p>
                  </div>
                  <div>
                    <p className="text-[#2E375B]/60">Rate/Seat</p>
                    <p className="font-bold text-[#2E375B]">₹{parseFloat(companyForm.rate_per_seat || 0).toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-[#2E375B]/60">Total Meeting Credits</p>
                    <p className="font-bold text-[#2E375B]">{(parseInt(companyForm.meeting_room_credits) || 0) * (parseInt(companyForm.total_seats) || 0)} min</p>
                  </div>
                  <div>
                    <p className="text-[#2E375B]/60">Total/Month</p>
                    <p className="font-bold text-[#FFA14A]">
                      ₹{(
                        (parseInt(companyForm.total_seats) || 0) * 
                        parseFloat(companyForm.rate_per_seat || 0) * 
                        (1 - (parseFloat(companyForm.discount_percent) || 0) / 100)
                      ).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompanyDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveCompany} disabled={saving} className="bg-[#2E375B] hover:bg-[#232B47]">
              {saving ? "Saving..." : (editingCompany ? "Update" : "Create Client")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={memberDialogOpen} onOpenChange={(open) => { setMemberDialogOpen(open); if (!open) resetMemberForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-[Manrope] text-[#2E375B]">
              Add Member to {selectedCompanyForMember?.company_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={memberForm.name}
                onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={memberForm.email}
                  onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone *</Label>
                <Input
                  value={memberForm.phone}
                  onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Aadhar Number</Label>
                <Input
                  value={memberForm.aadhar_number}
                  onChange={(e) => setMemberForm({ ...memberForm, aadhar_number: e.target.value.replace(/\D/g, '').slice(0, 12) })}
                  placeholder="1234 5678 9012"
                  maxLength={12}
                />
              </div>
              <div className="space-y-2">
                <Label>PAN Number</Label>
                <Input
                  value={memberForm.pan_number}
                  onChange={(e) => setMemberForm({ ...memberForm, pan_number: e.target.value.toUpperCase().slice(0, 10) })}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Seat Number</Label>
              <Input
                value={memberForm.seat_number}
                onChange={(e) => setMemberForm({ ...memberForm, seat_number: e.target.value })}
                placeholder="e.g., A-12 or Cabin-3"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="primary_contact"
                checked={memberForm.is_primary_contact}
                onCheckedChange={(checked) => setMemberForm({ ...memberForm, is_primary_contact: checked })}
              />
              <Label htmlFor="primary_contact" className="cursor-pointer">Primary Contact for Company</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMemberDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveMember} disabled={saving} className="bg-[#2E375B] hover:bg-[#232B47]">
              {saving ? "Adding..." : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteType === "company" ? "Company" : "Member"}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteType === "company" 
                ? `This will permanently delete "${itemToDelete?.company_name}" and all its members. This action cannot be undone.`
                : `This will remove "${itemToDelete?.name}" from the company. This action cannot be undone.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
