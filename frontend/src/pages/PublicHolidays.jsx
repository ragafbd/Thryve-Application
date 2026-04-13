import { useEffect, useState } from "react";
import { Calendar, Plus, Trash2, Edit2, Check, X, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PublicHolidays() {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [formData, setFormData] = useState({
    date: "",
    name: "",
    description: ""
  });

  const fetchHolidays = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/holidays?year=${selectedYear}&active_only=false`);
      setHolidays(response.data);
    } catch (error) {
      toast.error("Failed to fetch holidays");
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchHolidays();
  }, [selectedYear]);

  const openAddDialog = () => {
    setEditingHoliday(null);
    setFormData({
      date: `${selectedYear}-01-01`,
      name: "",
      description: ""
    });
    setDialogOpen(true);
  };

  const openEditDialog = (holiday) => {
    setEditingHoliday(holiday);
    setFormData({
      date: holiday.date,
      name: holiday.name,
      description: holiday.description || ""
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.date || !formData.name) {
      toast.error("Date and name are required");
      return;
    }

    setSaving(true);
    try {
      if (editingHoliday) {
        await axios.put(`${API}/holidays/${editingHoliday.id}`, formData);
        toast.success("Holiday updated successfully");
      } else {
        await axios.post(`${API}/holidays`, formData);
        toast.success("Holiday added successfully");
      }
      setDialogOpen(false);
      fetchHolidays();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save holiday");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (holiday) => {
    if (!window.confirm(`Delete "${holiday.name}" on ${holiday.date}?`)) return;

    try {
      await axios.delete(`${API}/holidays/${holiday.id}`);
      toast.success("Holiday deleted");
      fetchHolidays();
    } catch (error) {
      toast.error("Failed to delete holiday");
    }
  };

  const handleToggleActive = async (holiday) => {
    try {
      await axios.put(`${API}/holidays/${holiday.id}`, { is_active: !holiday.is_active });
      toast.success(holiday.is_active ? "Holiday deactivated" : "Holiday activated");
      fetchHolidays();
    } catch (error) {
      toast.error("Failed to update holiday");
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const day = date.getDate();
    const ordinal = (d) => {
      if (d > 3 && d < 21) return 'th';
      switch (d % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    };
    const weekday = date.toLocaleDateString('en-IN', { weekday: 'short' });
    const month = date.toLocaleDateString('en-IN', { month: 'short' });
    return `${weekday}, ${day}${ordinal(day)} ${month}`;
  };

  const years = [2025, 2026, 2027];

  return (
    <div className="space-y-6 animate-fade-in" data-testid="public-holidays-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#2E375B] tracking-tight font-[Manrope]">
            Public Holidays
          </h1>
          <p className="text-[#2E375B]/60 mt-1">
            Manage public holidays - bookings are blocked on these dates
          </p>
        </div>
        <Button 
          onClick={openAddDialog}
          className="bg-[#2E375B] hover:bg-[#232B47]"
          data-testid="add-holiday-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Holiday
        </Button>
      </div>

      {/* Info Banner */}
      <div className="bg-[#FFA14A]/10 border border-[#FFA14A]/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#FFA14A] mt-0.5 flex-shrink-0" />
          <div className="text-sm text-[#2E375B]/80">
            <p className="font-medium text-[#2E375B]">How it works</p>
            <p className="mt-1">Holidays you add here will automatically block meeting room bookings on those dates. Default Indian national holidays for 2025-2026 have been pre-loaded.</p>
          </div>
        </div>
      </div>

      {/* Year Filter */}
      <Card className="border border-[#2E375B]/10">
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <Label className="text-[#2E375B]">Filter by Year:</Label>
            <div className="flex gap-2">
              {years.map(year => (
                <Button
                  key={year}
                  variant={selectedYear === year ? "default" : "outline"}
                  size="sm"
                  className={selectedYear === year 
                    ? "bg-[#2E375B] hover:bg-[#232B47]" 
                    : "border-[#2E375B]/20 text-[#2E375B] hover:bg-[#2E375B]/10"}
                  onClick={() => setSelectedYear(year)}
                >
                  {year}
                </Button>
              ))}
            </div>
            <span className="text-sm text-[#2E375B]/60 ml-auto">
              {holidays.filter(h => h.is_active).length} active holidays in {selectedYear}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Holidays Table */}
      <Card className="border border-[#2E375B]/10">
        <CardHeader>
          <CardTitle className="text-lg font-semibold font-[Manrope] flex items-center gap-2 text-[#2E375B]">
            <Calendar className="w-5 h-5" />
            Holidays for {selectedYear}
          </CardTitle>
          <CardDescription>
            Meeting room bookings will be blocked on active holidays
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-[#2E375B]/60">Loading...</p>
          ) : holidays.length === 0 ? (
            <p className="text-center py-8 text-[#2E375B]/60">No holidays found for {selectedYear}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[#2E375B]">Date</TableHead>
                  <TableHead className="text-[#2E375B]">Holiday Name</TableHead>
                  <TableHead className="text-[#2E375B]">Description</TableHead>
                  <TableHead className="text-[#2E375B]">Status</TableHead>
                  <TableHead className="text-right text-[#2E375B]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.sort((a, b) => a.date.localeCompare(b.date)).map((holiday) => (
                  <TableRow key={holiday.id} className={!holiday.is_active ? "opacity-50" : ""}>
                    <TableCell className="font-medium">
                      <div>
                        <p className="text-[#2E375B]">{formatDate(holiday.date)}</p>
                        <p className="text-xs text-[#2E375B]/50">{holiday.date}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-[#2E375B] font-medium">{holiday.name}</TableCell>
                    <TableCell className="text-[#2E375B]/70 text-sm max-w-[200px] truncate">
                      {holiday.description || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        className={holiday.is_active 
                          ? "bg-green-100 text-green-700" 
                          : "bg-gray-100 text-gray-500"}
                      >
                        {holiday.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-[#2E375B]/70 hover:text-[#2E375B]"
                          onClick={() => handleToggleActive(holiday)}
                          title={holiday.is_active ? "Deactivate" : "Activate"}
                        >
                          {holiday.is_active ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-[#2E375B]/70 hover:text-[#2E375B]"
                          onClick={() => openEditDialog(holiday)}
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-700"
                          onClick={() => handleDelete(holiday)}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-[Manrope] text-[#2E375B]">
              {editingHoliday ? "Edit Holiday" : "Add Holiday"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[#2E375B]">Date *</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="border-[#2E375B]/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#2E375B]">Holiday Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Independence Day"
                className="border-[#2E375B]/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#2E375B]">Description (optional)</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g., National holiday"
                className="border-[#2E375B]/20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDialogOpen(false)}
              className="border-[#2E375B]/20 text-[#2E375B]"
            >
              Cancel
            </Button>
            <Button 
              className="bg-[#2E375B] hover:bg-[#232B47]"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : (editingHoliday ? "Update" : "Add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
