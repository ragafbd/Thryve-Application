import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Building2, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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

const emptyClient = {
  company_name: "",
  address: "",
  gstin: ""
};

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [formData, setFormData] = useState(emptyClient);
  const [saving, setSaving] = useState(false);

  const fetchClients = async () => {
    try {
      const response = await axios.get(`${API}/clients`);
      setClients(response.data);
    } catch (error) {
      toast.error("Failed to fetch clients");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const filteredClients = clients.filter(client =>
    client.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.gstin.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenDialog = (client = null) => {
    if (client) {
      setSelectedClient(client);
      setFormData({
        company_name: client.company_name,
        address: client.address,
        gstin: client.gstin
      });
    } else {
      setSelectedClient(null);
      setFormData(emptyClient);
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.company_name || !formData.address || !formData.gstin) {
      toast.error("Please fill in all fields");
      return;
    }

    setSaving(true);
    try {
      if (selectedClient) {
        await axios.put(`${API}/clients/${selectedClient.id}`, formData);
        toast.success("Client updated successfully");
      } else {
        await axios.post(`${API}/clients`, formData);
        toast.success("Client created successfully");
      }
      setDialogOpen(false);
      fetchClients();
    } catch (error) {
      toast.error(selectedClient ? "Failed to update client" : "Failed to create client");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedClient) return;
    
    try {
      await axios.delete(`${API}/clients/${selectedClient.id}`);
      toast.success("Client deleted successfully");
      setDeleteDialogOpen(false);
      setSelectedClient(null);
      fetchClients();
    } catch (error) {
      toast.error("Failed to delete client");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="clients-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight font-[Manrope]">
            Clients
          </h1>
          <p className="text-slate-600 mt-1">
            Manage your client information
          </p>
        </div>
        <Button 
          className="bg-[#2E375B] hover:bg-[#232B47] text-white"
          onClick={() => handleOpenDialog()}
          data-testid="add-client-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Client
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search by company name or GSTIN..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-white border-slate-200"
          data-testid="client-search-input"
        />
      </div>

      {/* Clients Grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading clients...</div>
      ) : filteredClients.length === 0 ? (
        <Card className="border border-slate-200">
          <CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">
              {searchQuery ? "No clients found matching your search" : "No clients yet"}
            </p>
            {!searchQuery && (
              <Button 
                className="mt-4 bg-[#2E375B] hover:bg-[#232B47]"
                onClick={() => handleOpenDialog()}
              >
                Add Your First Client
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client, index) => (
            <Card 
              key={client.id} 
              className="border border-slate-200 shadow-sm card-hover animate-fade-in"
              style={{ animationDelay: `${index * 0.05}s` }}
              data-testid={`client-card-${client.id}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 truncate font-[Manrope]">
                      {client.company_name}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                      {client.address}
                    </p>
                    <p className="text-xs font-mono text-[#2E375B] mt-2 bg-[#FFD4B0] inline-block px-2 py-1 rounded">
                      {client.gstin}
                    </p>
                  </div>
                  <div className="flex gap-1 ml-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-500 hover:text-[#2E375B]"
                      onClick={() => handleOpenDialog(client)}
                      data-testid={`edit-client-${client.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-500 hover:text-red-600"
                      onClick={() => {
                        setSelectedClient(client);
                        setDeleteDialogOpen(true);
                      }}
                      data-testid={`delete-client-${client.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-[Manrope]">
              {selectedClient ? "Edit Client" : "Add New Client"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                placeholder="Enter company name"
                data-testid="client-company-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Enter company address"
                data-testid="client-address-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gstin">GSTIN</Label>
              <Input
                id="gstin"
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                placeholder="e.g., 29AABCT1234F1Z5"
                className="font-mono"
                data-testid="client-gstin-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              className="bg-[#2E375B] hover:bg-[#232B47]"
              onClick={handleSave}
              disabled={saving}
              data-testid="save-client-btn"
            >
              {saving ? "Saving..." : (selectedClient ? "Update" : "Add Client")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedClient?.company_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
              data-testid="confirm-delete-client"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
