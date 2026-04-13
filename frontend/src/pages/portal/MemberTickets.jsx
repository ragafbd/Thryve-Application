import { useEffect, useState } from "react";
import { Plus, Ticket, AlertCircle, CheckCircle, Clock, Search } from "lucide-react";
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

const API = `${process.env.REACT_APP_BACKEND_URL}/api/member`;

const CATEGORIES = [
  { value: "maintenance", label: "Maintenance" },
  { value: "it_support", label: "IT Support" },
  { value: "admin", label: "Admin" },
  { value: "facilities", label: "Facilities" },
  { value: "other", label: "Other" }
];

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" }
];

const StatusBadge = ({ status }) => {
  const config = {
    open: { label: "Open", className: "bg-yellow-100 text-yellow-700", icon: AlertCircle },
    in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-700", icon: Clock },
    resolved: { label: "Resolved", className: "bg-green-100 text-green-700", icon: CheckCircle },
    closed: { label: "Closed", className: "bg-slate-100 text-slate-700", icon: CheckCircle }
  };
  const { label, className } = config[status] || config.open;
  return <Badge className={className}>{label}</Badge>;
};

export default function MemberTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "maintenance",
    priority: "medium"
  });

  const fetchTickets = async () => {
    try {
      const response = await axios.get(`${API}/tickets`);
      setTickets(response.data);
    } catch (error) {
      // silenced
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleCreate = async () => {
    if (!formData.title || !formData.description) {
      toast.error("Please fill in title and description");
      return;
    }

    setSaving(true);
    try {
      await axios.post(`${API}/tickets`, formData);
      toast.success("Ticket submitted successfully");
      setDialogOpen(false);
      setFormData({ title: "", description: "", category: "maintenance", priority: "medium" });
      fetchTickets();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create ticket");
    } finally {
      setSaving(false);
    }
  };

  const filteredTickets = tickets.filter(ticket =>
    ticket.title.toLowerCase().includes(search.toLowerCase()) ||
    ticket.ticket_number.toLowerCase().includes(search.toLowerCase())
  );

  const openCount = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;
  const resolvedCount = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;

  return (
    <div className="space-y-6 animate-fade-in" data-testid="member-tickets">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-[Manrope]">Support Tickets</h1>
          <p className="text-slate-600 mt-1">Submit and track your support requests</p>
        </div>
        <Button 
          className="bg-[#FFA14A] hover:bg-[#e8893a]"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Ticket
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-8 h-8 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold text-yellow-700">{openCount}</p>
                <p className="text-xs text-yellow-600">Open Tickets</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-700">{resolvedCount}</p>
                <p className="text-xs text-green-600">Resolved</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search tickets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tickets List */}
      <Card className="border border-slate-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading tickets...</div>
          ) : filteredTickets.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Ticket className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p>No tickets found</p>
              <Button 
                className="mt-4 bg-[#FFA14A] hover:bg-[#e8893a]"
                onClick={() => setDialogOpen(true)}
              >
                Create Your First Ticket
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredTickets.map((ticket) => (
                <div 
                  key={ticket.id} 
                  className="p-4 hover:bg-slate-50 cursor-pointer"
                  onClick={() => {
                    setSelectedTicket(ticket);
                    setDetailDialogOpen(true);
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-slate-500">{ticket.ticket_number}</span>
                        <StatusBadge status={ticket.status} />
                        <Badge className={
                          ticket.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                          ticket.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                          'bg-slate-100 text-slate-700'
                        }>
                          {ticket.priority}
                        </Badge>
                      </div>
                      <h3 className="font-medium text-slate-900">{ticket.title}</h3>
                      <p className="text-sm text-slate-500 mt-1 line-clamp-1">{ticket.description}</p>
                      <p className="text-xs text-slate-400 mt-2">
                        Created: {new Date(ticket.created_at).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Ticket Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-[Manrope]">Submit Support Ticket</DialogTitle>
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
                placeholder="Please provide details about your issue..."
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button 
              className="bg-[#FFA14A] hover:bg-[#e8893a]"
              onClick={handleCreate}
              disabled={saving}
            >
              {saving ? "Submitting..." : "Submit Ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ticket Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono">{selectedTicket?.ticket_number}</DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">{selectedTicket.title}</h3>
                <div className="flex gap-2 mt-2">
                  <StatusBadge status={selectedTicket.status} />
                  <Badge className="bg-slate-100 text-slate-700">{selectedTicket.category}</Badge>
                  <Badge className={
                    selectedTicket.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                    selectedTicket.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                    'bg-slate-100 text-slate-700'
                  }>
                    {selectedTicket.priority}
                  </Badge>
                </div>
              </div>
              
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Created</p>
                  <p className="font-medium">{new Date(selectedTicket.created_at).toLocaleString('en-IN')}</p>
                </div>
                {selectedTicket.assigned_name && (
                  <div>
                    <p className="text-slate-500">Assigned To</p>
                    <p className="font-medium">{selectedTicket.assigned_name}</p>
                  </div>
                )}
              </div>

              {selectedTicket.resolution && (
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-green-700">Resolution</p>
                  <p className="text-sm text-green-600 mt-1">{selectedTicket.resolution}</p>
                  {selectedTicket.resolved_at && (
                    <p className="text-xs text-green-500 mt-2">
                      Resolved on {new Date(selectedTicket.resolved_at).toLocaleString('en-IN')}
                    </p>
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
