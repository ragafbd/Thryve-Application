import { useEffect, useState } from "react";
import { Plus, Ticket, AlertCircle, CheckCircle, Clock, Search, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORIES = [
  { value: "maintenance", label: "Maintenance", color: "bg-yellow-100 text-yellow-700" },
  { value: "it_support", label: "IT Support", color: "bg-blue-100 text-blue-700" },
  { value: "admin", label: "Admin", color: "bg-purple-100 text-purple-700" },
  { value: "facilities", label: "Facilities", color: "bg-green-100 text-green-700" },
  { value: "other", label: "Other", color: "bg-slate-100 text-slate-700" }
];

const PRIORITIES = [
  { value: "low", label: "Low", color: "bg-slate-100 text-slate-700" },
  { value: "medium", label: "Medium", color: "bg-blue-100 text-blue-700" },
  { value: "high", label: "High", color: "bg-orange-100 text-orange-700" },
  { value: "urgent", label: "Urgent", color: "bg-red-100 text-red-700" }
];

const STATUSES = [
  { value: "open", label: "Open", color: "bg-yellow-100 text-yellow-700", icon: AlertCircle },
  { value: "in_progress", label: "In Progress", color: "bg-blue-100 text-blue-700", icon: Clock },
  { value: "resolved", label: "Resolved", color: "bg-green-100 text-green-700", icon: CheckCircle },
  { value: "closed", label: "Closed", color: "bg-slate-100 text-slate-700", icon: CheckCircle }
];

const StatusBadge = ({ status }) => {
  const config = STATUSES.find(s => s.value === status) || STATUSES[0];
  return <Badge className={config.color}>{config.label}</Badge>;
};

const PriorityBadge = ({ priority }) => {
  const config = PRIORITIES.find(p => p.value === priority) || PRIORITIES[1];
  return <Badge className={config.color}>{config.label}</Badge>;
};

const CategoryBadge = ({ category }) => {
  const config = CATEGORIES.find(c => c.value === category) || CATEGORIES[4];
  return <Badge className={config.color}>{config.label}</Badge>;
};

export default function Tickets() {
  const { user, isAdmin } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [members, setMembers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "maintenance",
    priority: "medium",
    member_id: ""
  });

  const fetchTickets = async () => {
    try {
      const response = await axios.get(`${API}/management/tickets`);
      setTickets(response.data);
    } catch (error) {
      toast.error("Failed to fetch tickets");
    } finally {
      setLoading(false);
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

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/auth/users`);
      setUsers(response.data);
    } catch (error) {
      console.error("Failed to fetch users");
    }
  };

  useEffect(() => {
    fetchTickets();
    fetchMembers();
    if (isAdmin()) {
      fetchUsers();
    }
  }, []);

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      category: "maintenance",
      priority: "medium",
      member_id: ""
    });
  };

  const handleCreate = async () => {
    if (!formData.title || !formData.description) {
      toast.error("Please fill in title and description");
      return;
    }

    setSaving(true);
    try {
      await axios.post(`${API}/management/tickets`, formData);
      toast.success("Ticket created successfully");
      setDialogOpen(false);
      resetForm();
      fetchTickets();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create ticket");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTicket = async (ticketId, updates) => {
    try {
      await axios.put(`${API}/management/tickets/${ticketId}`, updates);
      toast.success("Ticket updated");
      fetchTickets();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, ...updates });
      }
    } catch (error) {
      toast.error("Failed to update ticket");
    }
  };

  const openTicketDetail = (ticket) => {
    setSelectedTicket(ticket);
    setDetailDialogOpen(true);
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = 
      ticket.title.toLowerCase().includes(search.toLowerCase()) ||
      ticket.ticket_number.toLowerCase().includes(search.toLowerCase()) ||
      ticket.member_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const ticketCounts = {
    open: tickets.filter(t => t.status === "open").length,
    in_progress: tickets.filter(t => t.status === "in_progress").length,
    resolved: tickets.filter(t => t.status === "resolved").length
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="tickets-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight font-[Manrope]">
            Support Tickets
          </h1>
          <p className="text-slate-600 mt-1">
            Manage maintenance and support requests
          </p>
        </div>
        <Button 
          className="bg-[#2E375B] hover:bg-[#232B47] text-white"
          onClick={() => setDialogOpen(true)}
          data-testid="create-ticket-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Ticket
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-8 h-8 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold text-yellow-700">{ticketCounts.open}</p>
                <p className="text-xs text-yellow-600">Open</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold text-blue-700">{ticketCounts.in_progress}</p>
                <p className="text-xs text-blue-600">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-700">{ticketCounts.resolved}</p>
                <p className="text-xs text-green-600">Resolved</p>
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
            placeholder="Search tickets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUSES.map(status => (
              <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tickets List */}
      <Card className="border border-slate-200 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading tickets...</div>
          ) : filteredTickets.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              {search || statusFilter !== "all" ? "No tickets found" : "No tickets yet"}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredTickets.map(ticket => (
                <div 
                  key={ticket.id} 
                  className="p-4 hover:bg-slate-50 cursor-pointer"
                  onClick={() => openTicketDetail(ticket)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-slate-500">{ticket.ticket_number}</span>
                        <StatusBadge status={ticket.status} />
                        <PriorityBadge priority={ticket.priority} />
                      </div>
                      <h3 className="font-medium text-slate-900">{ticket.title}</h3>
                      <p className="text-sm text-slate-500 line-clamp-1 mt-1">{ticket.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        <CategoryBadge category={ticket.category} />
                        {ticket.member_name && (
                          <span>From: {ticket.member_name}</span>
                        )}
                        <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Ticket Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-[Manrope]">Create Support Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Brief description of the issue"
              />
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed description of the issue"
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reported By (Member)</Label>
              <Select value={formData.member_id} onValueChange={(v) => setFormData({ ...formData, member_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select member (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {members.map(member => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name} - {member.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button 
              className="bg-[#2E375B] hover:bg-[#232B47]"
              onClick={handleCreate}
              disabled={saving}
            >
              {saving ? "Creating..." : "Create Ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ticket Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-[Manrope] flex items-center gap-2">
              <Ticket className="w-5 h-5" />
              {selectedTicket?.ticket_number}
            </DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-4 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{selectedTicket.title}</h3>
                <p className="text-sm text-slate-600 mt-2">{selectedTicket.description}</p>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={selectedTicket.status} />
                <PriorityBadge priority={selectedTicket.priority} />
                <CategoryBadge category={selectedTicket.category} />
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Created</p>
                  <p className="font-medium">{new Date(selectedTicket.created_at).toLocaleString()}</p>
                </div>
                {selectedTicket.member_name && (
                  <div>
                    <p className="text-slate-500">Reported By</p>
                    <p className="font-medium">{selectedTicket.member_name}</p>
                  </div>
                )}
                {selectedTicket.assigned_name && (
                  <div>
                    <p className="text-slate-500">Assigned To</p>
                    <p className="font-medium">{selectedTicket.assigned_name}</p>
                  </div>
                )}
                {selectedTicket.resolved_at && (
                  <div>
                    <p className="text-slate-500">Resolved</p>
                    <p className="font-medium">{new Date(selectedTicket.resolved_at).toLocaleString()}</p>
                  </div>
                )}
              </div>

              {selectedTicket.resolution && (
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-sm font-medium text-green-700">Resolution</p>
                  <p className="text-sm text-green-600">{selectedTicket.resolution}</p>
                </div>
              )}

              {/* Admin Actions */}
              {isAdmin() && selectedTicket.status !== 'closed' && (
                <div className="border-t pt-4 space-y-4">
                  <h4 className="font-semibold text-sm">Update Ticket</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select 
                        value={selectedTicket.status} 
                        onValueChange={(v) => handleUpdateTicket(selectedTicket.id, { status: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map(s => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Assign To</Label>
                      <Select 
                        value={selectedTicket.assigned_to || ""} 
                        onValueChange={(v) => handleUpdateTicket(selectedTicket.id, { assigned_to: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select staff" />
                        </SelectTrigger>
                        <SelectContent>
                          {users.map(u => (
                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {(selectedTicket.status === 'resolved' || selectedTicket.status === 'in_progress') && (
                    <div className="space-y-2">
                      <Label>Resolution Notes</Label>
                      <Textarea
                        defaultValue={selectedTicket.resolution || ""}
                        placeholder="Describe how the issue was resolved"
                        onBlur={(e) => {
                          if (e.target.value !== selectedTicket.resolution) {
                            handleUpdateTicket(selectedTicket.id, { resolution: e.target.value });
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
