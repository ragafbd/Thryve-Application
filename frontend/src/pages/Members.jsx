import { useEffect, useState } from "react";
import { Plus, Building2, Users, CalendarDays, CreditCard, Search, MoreVertical, Edit, Trash2, UserPlus, UserX, AlertTriangle, RefreshCw, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const StatusBadge = ({ status, hasOutstandingDues }) => {
  const config = {
    active: { label: "Active", className: "bg-green-100 text-green-700" },
    inactive: { label: "Inactive", className: "bg-slate-100 text-slate-700" },
    suspended: { label: "Suspended", className: "bg-amber-100 text-amber-700" },
    terminated: { label: "Terminated", className: "bg-red-100 text-red-700" }
  };
  const { label, className } = config[status] || config.inactive;
  return (
    <div className="flex items-center gap-1">
      <Badge className={className}>{label}</Badge>
      {hasOutstandingDues && (
        <Badge className="bg-orange-100 text-orange-700" title="Outstanding Dues">
          <DollarSign className="w-3 h-3" />
        </Badge>
      )}
    </div>
  );
};

export default function Members() {
  const [members, setMembers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Termination states
  const [terminateDialogOpen, setTerminateDialogOpen] = useState(false);
  const [memberToTerminate, setMemberToTerminate] = useState(null);
  const [bulkTerminateDialogOpen, setBulkTerminateDialogOpen] = useState(false);
  const [companyToTerminate, setCompanyToTerminate] = useState("");
  const [terminateData, setTerminateData] = useState({
    end_date: new Date().toISOString().split('T')[0],
    termination_reason: "",
    has_outstanding_dues: false
  });

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company_name: "",
    company_address: "",
    gstin: "",
    plan_type_id: "",
    seat_number: "",
    custom_rate: "",
    discount_percent: "",
    meeting_room_credits: "",
    start_date: new Date().toISOString().split('T')[0],
    notes: ""
  });

  const fetchMembers = async () => {
    try {
      const response = await axios.get(`${API}/management/members`);
      setMembers(response.data);
    } catch (error) {
      toast.error("Failed to fetch members");
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const response = await axios.get(`${API}/management/plans`);
      setPlans(response.data);
    } catch (error) {
      toast.error("Failed to fetch plans");
    }
  };

  const fetchCompanies = async () => {
    try {
      const response = await axios.get(`${API}/management/members/companies`);
      setCompanies(response.data);
    } catch (error) {
      console.error("Failed to fetch companies");
    }
  };

  useEffect(() => {
    fetchMembers();
    fetchPlans();
    fetchCompanies();
  }, []);

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      company_name: "",
      company_address: "",
      gstin: "",
      plan_type_id: "",
      seat_number: "",
      custom_rate: "",
      discount_percent: "",
      meeting_room_credits: "",
      start_date: new Date().toISOString().split('T')[0],
      notes: ""
    });
    setEditingMember(null);
  };

  const handleOpenDialog = (member = null) => {
    if (member) {
      setEditingMember(member);
      setFormData({
        name: member.name,
        email: member.email,
        phone: member.phone,
        company_name: member.company_name,
        company_address: member.company_address || "",
        gstin: member.gstin || "",
        plan_type_id: member.plan_type_id,
        seat_number: member.seat_number || "",
        custom_rate: member.custom_rate || "",
        discount_percent: member.discount_percent || "",
        meeting_room_credits: member.meeting_room_credits || "",
        start_date: member.start_date,
        notes: member.notes || ""
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.email || !formData.phone || !formData.company_name || !formData.plan_type_id) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        custom_rate: formData.custom_rate ? parseFloat(formData.custom_rate) : null,
        discount_percent: formData.discount_percent ? parseFloat(formData.discount_percent) : 0,
        meeting_room_credits: formData.meeting_room_credits ? parseInt(formData.meeting_room_credits) : null
      };

      if (editingMember) {
        await axios.put(`${API}/management/members/${editingMember.id}`, payload);
        toast.success("Member updated successfully");
      } else {
        await axios.post(`${API}/management/members`, payload);
        toast.success("Member added successfully");
      }
      setDialogOpen(false);
      resetForm();
      fetchMembers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save member");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!memberToDelete) return;
    
    try {
      await axios.delete(`${API}/management/members/${memberToDelete.id}`);
      toast.success("Member deleted successfully");
      setDeleteDialogOpen(false);
      setMemberToDelete(null);
      fetchMembers();
      fetchCompanies();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete member");
    }
  };

  const handleStatusChange = async (member, newStatus) => {
    try {
      await axios.put(`${API}/management/members/${member.id}`, { status: newStatus });
      toast.success(`Member ${newStatus === 'active' ? 'activated' : newStatus}`);
      fetchMembers();
      fetchCompanies();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleTerminate = async () => {
    if (!memberToTerminate) return;
    if (!terminateData.termination_reason) {
      toast.error("Please provide a termination reason");
      return;
    }

    setSaving(true);
    try {
      await axios.post(`${API}/management/members/${memberToTerminate.id}/terminate`, terminateData);
      toast.success(`${memberToTerminate.name} has been terminated`);
      setTerminateDialogOpen(false);
      setMemberToTerminate(null);
      setTerminateData({
        end_date: new Date().toISOString().split('T')[0],
        termination_reason: "",
        has_outstanding_dues: false
      });
      fetchMembers();
      fetchCompanies();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to terminate member");
    } finally {
      setSaving(false);
    }
  };

  const handleReactivate = async (member) => {
    try {
      await axios.post(`${API}/management/members/${member.id}/reactivate`);
      toast.success(`${member.name} has been reactivated`);
      fetchMembers();
      fetchCompanies();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to reactivate member");
    }
  };

  const handleBulkTerminate = async () => {
    if (!companyToTerminate) return;
    if (!terminateData.termination_reason) {
      toast.error("Please provide a termination reason");
      return;
    }

    setSaving(true);
    try {
      const response = await axios.post(`${API}/management/members/bulk-terminate`, {
        company_name: companyToTerminate,
        ...terminateData
      });
      toast.success(response.data.message);
      setBulkTerminateDialogOpen(false);
      setCompanyToTerminate("");
      setTerminateData({
        end_date: new Date().toISOString().split('T')[0],
        termination_reason: "",
        has_outstanding_dues: false
      });
      fetchMembers();
      fetchCompanies();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to terminate members");
    } finally {
      setSaving(false);
    }
  };

  const filteredMembers = members.filter(member => {
    const matchesSearch = 
      member.name.toLowerCase().includes(search.toLowerCase()) ||
      member.company_name.toLowerCase().includes(search.toLowerCase()) ||
      member.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || member.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const selectedPlan = plans.find(p => p.id === formData.plan_type_id);

  return (
    <div className="space-y-6 animate-fade-in" data-testid="members-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight font-[Manrope]">
            Members
          </h1>
          <p className="text-slate-600 mt-1">
            Manage coworking space members and their plans
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50"
            onClick={() => setBulkTerminateDialogOpen(true)}
            data-testid="bulk-terminate-btn"
          >
            <UserX className="w-4 h-4 mr-2" />
            Bulk Terminate
          </Button>
          <Button 
            className="bg-[#2E375B] hover:bg-[#232B47] text-white"
            onClick={() => handleOpenDialog()}
            data-testid="add-member-btn"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Add Member
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#2E375B]/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-[#2E375B]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{members.length}</p>
                <p className="text-xs text-slate-500">Total Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {members.filter(m => m.status === 'active').length}
                </p>
                <p className="text-xs text-slate-500">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <UserX className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {members.filter(m => m.status === 'terminated').length}
                </p>
                <p className="text-xs text-slate-500">Terminated</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {members.filter(m => m.has_outstanding_dues).length}
                </p>
                <p className="text-xs text-slate-500">Outstanding Dues</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  Rs. {members.filter(m => m.status === 'active').reduce((sum, m) => sum + (m.final_rate || 0), 0).toLocaleString()}
                </p>
                <p className="text-xs text-slate-500">Monthly Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="member-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="terminated">Terminated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Members Table */}
      <Card className="border border-slate-200 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading members...</div>
          ) : filteredMembers.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              {search || statusFilter !== "all" ? "No members found matching your criteria" : "No members yet. Add your first member!"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Member</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Company</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Plan</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Rate/Month</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member) => (
                    <tr key={member.id} className={`border-b border-slate-100 hover:bg-slate-50 ${member.status === 'terminated' ? 'bg-slate-50/50' : ''}`}>
                      <td className="px-4 py-3">
                        <div>
                          <p className={`font-medium ${member.status === 'terminated' ? 'text-slate-500' : 'text-slate-900'}`}>{member.name}</p>
                          <p className="text-xs text-slate-500">{member.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-700">{member.company_name}</p>
                        {member.seat_number && (
                          <p className="text-xs text-slate-500">Seat: {member.seat_number}</p>
                        )}
                        {member.end_date && (
                          <p className="text-xs text-red-500">End: {member.end_date}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className="bg-[#2E375B]/10 text-[#2E375B]">{member.plan_name}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <p className={`font-mono ${member.status === 'terminated' ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                          Rs. {member.final_rate?.toLocaleString()}
                        </p>
                        {member.discount_percent > 0 && (
                          <p className="text-xs text-green-600">-{member.discount_percent}% discount</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={member.status} hasOutstandingDues={member.has_outstanding_dues} />
                        {member.termination_reason && (
                          <p className="text-xs text-slate-500 mt-1 max-w-[150px] truncate" title={member.termination_reason}>
                            {member.termination_reason}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {member.status !== 'terminated' && (
                              <>
                                <DropdownMenuItem onClick={() => handleOpenDialog(member)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                {member.status !== 'active' && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(member, 'active')}>
                                    Activate
                                  </DropdownMenuItem>
                                )}
                                {member.status === 'active' && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(member, 'inactive')}>
                                    Deactivate
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-red-600"
                                  onClick={() => {
                                    setMemberToTerminate(member);
                                    setTerminateDialogOpen(true);
                                  }}
                                >
                                  <UserX className="w-4 h-4 mr-2" />
                                  Terminate
                                </DropdownMenuItem>
                              </>
                            )}
                            {member.status === 'terminated' && (
                              <DropdownMenuItem onClick={() => handleReactivate(member)}>
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Reactivate
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-red-600"
                              onClick={() => {
                                setMemberToDelete(member);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Permanently
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Member Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-[Manrope]">
              {editingMember ? "Edit Member" : "Add New Member"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Member name"
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone *</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 98765 43210"
              />
            </div>
            <div className="space-y-2">
              <Label>Company Name *</Label>
              <Input
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                placeholder="Company name"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Company Address</Label>
              <Input
                value={formData.company_address}
                onChange={(e) => setFormData({ ...formData, company_address: e.target.value })}
                placeholder="Full address"
              />
            </div>
            <div className="space-y-2">
              <Label>GSTIN</Label>
              <Input
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                placeholder="22AAAAA0000A1Z5"
              />
            </div>
            <div className="space-y-2">
              <Label>Plan *</Label>
              <Select value={formData.plan_type_id} onValueChange={(value) => setFormData({ ...formData, plan_type_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map(plan => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} - Rs. {plan.default_rate.toLocaleString()}/mo
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Seat/Cabin Number</Label>
              <Input
                value={formData.seat_number}
                onChange={(e) => setFormData({ ...formData, seat_number: e.target.value })}
                placeholder="e.g., A-12 or Cabin-3"
              />
            </div>
            <div className="space-y-2">
              <Label>Custom Rate (Rs.)</Label>
              <Input
                type="number"
                value={formData.custom_rate}
                onChange={(e) => setFormData({ ...formData, custom_rate: e.target.value })}
                placeholder={selectedPlan ? `Default: ${selectedPlan.default_rate}` : "Override default rate"}
              />
            </div>
            <div className="space-y-2">
              <Label>Discount (%)</Label>
              <Input
                type="number"
                value={formData.discount_percent}
                onChange={(e) => setFormData({ ...formData, discount_percent: e.target.value })}
                placeholder="0"
                min="0"
                max="100"
              />
            </div>
            <div className="space-y-2">
              <Label>Meeting Room Credits (minutes)</Label>
              <Input
                type="number"
                value={formData.meeting_room_credits}
                onChange={(e) => setFormData({ ...formData, meeting_room_credits: e.target.value })}
                placeholder={selectedPlan ? `Default: ${selectedPlan.meeting_room_credits}` : "Override default"}
              />
            </div>
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Notes</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional notes"
              />
            </div>
          </div>
          
          {/* Rate Preview */}
          {formData.plan_type_id && (
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="font-semibold text-sm mb-2">Rate Preview</h4>
              <div className="text-sm text-slate-600 space-y-1">
                <p>Base Rate: Rs. {(formData.custom_rate || selectedPlan?.default_rate || 0).toLocaleString()}</p>
                {formData.discount_percent > 0 && (
                  <p className="text-green-600">Discount: -{formData.discount_percent}%</p>
                )}
                <p className="font-semibold text-slate-900">
                  Final Rate: Rs. {(
                    (parseFloat(formData.custom_rate) || selectedPlan?.default_rate || 0) * 
                    (1 - (parseFloat(formData.discount_percent) || 0) / 100)
                  ).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button 
              className="bg-[#2E375B] hover:bg-[#232B47]"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : (editingMember ? "Update Member" : "Add Member")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Member Permanently</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete "{memberToDelete?.name}"? This will remove all history and cannot be undone.
              {memberToDelete?.status !== 'terminated' && (
                <span className="block mt-2 text-amber-600">
                  Consider using "Terminate" instead to preserve history.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Terminate Member Dialog */}
      <Dialog open={terminateDialogOpen} onOpenChange={(open) => {
        setTerminateDialogOpen(open);
        if (!open) {
          setMemberToTerminate(null);
          setTerminateData({
            end_date: new Date().toISOString().split('T')[0],
            termination_reason: "",
            has_outstanding_dues: false
          });
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-[Manrope] flex items-center gap-2">
              <UserX className="w-5 h-5 text-red-500" />
              Terminate Member
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {memberToTerminate && (
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="font-semibold">{memberToTerminate.name}</p>
                <p className="text-sm text-slate-500">{memberToTerminate.company_name}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Last Working Day *</Label>
              <Input
                type="date"
                value={terminateData.end_date}
                onChange={(e) => setTerminateData({ ...terminateData, end_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Reason for Termination *</Label>
              <Textarea
                value={terminateData.termination_reason}
                onChange={(e) => setTerminateData({ ...terminateData, termination_reason: e.target.value })}
                placeholder="e.g., Lease ended, Non-payment, Relocated"
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2 p-3 bg-orange-50 rounded-lg">
              <Checkbox
                id="outstanding-dues"
                checked={terminateData.has_outstanding_dues}
                onCheckedChange={(checked) => setTerminateData({ ...terminateData, has_outstanding_dues: checked })}
              />
              <label htmlFor="outstanding-dues" className="text-sm font-medium cursor-pointer">
                Member has outstanding dues
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTerminateDialogOpen(false)}>Cancel</Button>
            <Button 
              className="bg-red-600 hover:bg-red-700"
              onClick={handleTerminate}
              disabled={saving}
            >
              {saving ? "Processing..." : "Terminate Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Terminate Dialog */}
      <Dialog open={bulkTerminateDialogOpen} onOpenChange={(open) => {
        setBulkTerminateDialogOpen(open);
        if (!open) {
          setCompanyToTerminate("");
          setTerminateData({
            end_date: new Date().toISOString().split('T')[0],
            termination_reason: "",
            has_outstanding_dues: false
          });
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-[Manrope] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Bulk Terminate - Company
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-red-50 p-3 rounded-lg text-sm text-red-700">
              <strong>Warning:</strong> This will terminate ALL active members from the selected company.
            </div>
            <div className="space-y-2">
              <Label>Select Company *</Label>
              <Select value={companyToTerminate} onValueChange={setCompanyToTerminate}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.filter(c => c.active_members > 0).map(company => (
                    <SelectItem key={company.company_name} value={company.company_name}>
                      {company.company_name} ({company.active_members} active)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {companyToTerminate && (
              <div className="bg-slate-50 p-3 rounded-lg text-sm">
                <p className="font-semibold">{companyToTerminate}</p>
                <p className="text-slate-500">
                  {companies.find(c => c.company_name === companyToTerminate)?.active_members || 0} members will be terminated
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Last Working Day *</Label>
              <Input
                type="date"
                value={terminateData.end_date}
                onChange={(e) => setTerminateData({ ...terminateData, end_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Reason for Termination *</Label>
              <Textarea
                value={terminateData.termination_reason}
                onChange={(e) => setTerminateData({ ...terminateData, termination_reason: e.target.value })}
                placeholder="e.g., Lease ended, Non-payment, Company relocated"
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2 p-3 bg-orange-50 rounded-lg">
              <Checkbox
                id="bulk-outstanding-dues"
                checked={terminateData.has_outstanding_dues}
                onCheckedChange={(checked) => setTerminateData({ ...terminateData, has_outstanding_dues: checked })}
              />
              <label htmlFor="bulk-outstanding-dues" className="text-sm font-medium cursor-pointer">
                Company has outstanding dues
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkTerminateDialogOpen(false)}>Cancel</Button>
            <Button 
              className="bg-red-600 hover:bg-red-700"
              onClick={handleBulkTerminate}
              disabled={saving || !companyToTerminate}
            >
              {saving ? "Processing..." : "Terminate All Members"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
