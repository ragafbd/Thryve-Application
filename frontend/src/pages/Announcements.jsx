import { useEffect, useState } from "react";
import { Plus, Megaphone, Pin, Trash2, Edit, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { useAuth } from "@/contexts/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORIES = [
  { value: "general", label: "General", color: "bg-slate-100 text-slate-700" },
  { value: "event", label: "Event", color: "bg-purple-100 text-purple-700" },
  { value: "maintenance", label: "Maintenance", color: "bg-yellow-100 text-yellow-700" },
  { value: "important", label: "Important", color: "bg-red-100 text-red-700" }
];

const CategoryBadge = ({ category }) => {
  const config = CATEGORIES.find(c => c.value === category) || CATEGORIES[0];
  return <Badge className={config.color}>{config.label}</Badge>;
};

export default function Announcements() {
  const { isAdmin } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [announcementToDelete, setAnnouncementToDelete] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "general",
    is_pinned: false,
    expires_at: ""
  });

  const fetchAnnouncements = async () => {
    try {
      const response = await axios.get(`${API}/management/announcements`);
      setAnnouncements(response.data);
    } catch (error) {
      toast.error("Failed to fetch announcements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const resetForm = () => {
    setFormData({
      title: "",
      content: "",
      category: "general",
      is_pinned: false,
      expires_at: ""
    });
    setEditingAnnouncement(null);
  };

  const handleOpenDialog = (announcement = null) => {
    if (announcement) {
      setEditingAnnouncement(announcement);
      setFormData({
        title: announcement.title,
        content: announcement.content,
        category: announcement.category,
        is_pinned: announcement.is_pinned,
        expires_at: announcement.expires_at?.split('T')[0] || ""
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.content) {
      toast.error("Please fill in title and content");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        expires_at: formData.expires_at ? new Date(formData.expires_at).toISOString() : null
      };

      if (editingAnnouncement) {
        await axios.put(`${API}/management/announcements/${editingAnnouncement.id}`, payload);
        toast.success("Announcement updated");
      } else {
        await axios.post(`${API}/management/announcements`, payload);
        toast.success("Announcement published");
      }
      setDialogOpen(false);
      resetForm();
      fetchAnnouncements();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save announcement");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!announcementToDelete) return;
    
    try {
      await axios.delete(`${API}/management/announcements/${announcementToDelete.id}`);
      toast.success("Announcement deleted");
      setDeleteDialogOpen(false);
      setAnnouncementToDelete(null);
      fetchAnnouncements();
    } catch (error) {
      toast.error("Failed to delete announcement");
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const pinnedAnnouncements = announcements.filter(a => a.is_pinned);
  const regularAnnouncements = announcements.filter(a => !a.is_pinned);

  return (
    <div className="space-y-6 animate-fade-in" data-testid="announcements-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight font-[Manrope]">
            Community Announcements
          </h1>
          <p className="text-slate-600 mt-1">
            Stay updated with the latest news and events
          </p>
        </div>
        {isAdmin() && (
          <Button 
            className="bg-[#2E375B] hover:bg-[#232B47] text-white"
            onClick={() => handleOpenDialog()}
            data-testid="create-announcement-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Announcement
          </Button>
        )}
      </div>

      {/* Pinned Announcements */}
      {pinnedAnnouncements.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Pin className="w-5 h-5 text-[#FFA14A]" />
            Pinned
          </h2>
          <div className="grid gap-4">
            {pinnedAnnouncements.map(announcement => (
              <Card key={announcement.id} className="border-2 border-[#FFA14A]/30 bg-[#FFA14A]/5">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CategoryBadge category={announcement.category} />
                        <Pin className="w-4 h-4 text-[#FFA14A]" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900">{announcement.title}</h3>
                      <p className="text-slate-600 mt-2 whitespace-pre-wrap">{announcement.content}</p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                        <span>By {announcement.author_name}</span>
                        <span>{formatDate(announcement.created_at)}</span>
                        {announcement.expires_at && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Expires: {formatDate(announcement.expires_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    {isAdmin() && (
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => handleOpenDialog(announcement)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-red-500"
                          onClick={() => {
                            setAnnouncementToDelete(announcement);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Regular Announcements */}
      <div className="space-y-4">
        {pinnedAnnouncements.length > 0 && (
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-[#2E375B]" />
            All Announcements
          </h2>
        )}
        
        {loading ? (
          <Card className="border border-slate-200">
            <CardContent className="p-8 text-center text-slate-500">
              Loading announcements...
            </CardContent>
          </Card>
        ) : regularAnnouncements.length === 0 && pinnedAnnouncements.length === 0 ? (
          <Card className="border border-slate-200">
            <CardContent className="p-8 text-center text-slate-500">
              <Megaphone className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p>No announcements yet</p>
              {isAdmin() && (
                <p className="text-sm mt-1">Create your first announcement to get started</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {regularAnnouncements.map(announcement => (
              <Card key={announcement.id} className="border border-slate-200 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CategoryBadge category={announcement.category} />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900">{announcement.title}</h3>
                      <p className="text-slate-600 mt-2 whitespace-pre-wrap">{announcement.content}</p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                        <span>By {announcement.author_name}</span>
                        <span>{formatDate(announcement.created_at)}</span>
                        {announcement.expires_at && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Expires: {formatDate(announcement.expires_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    {isAdmin() && (
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => handleOpenDialog(announcement)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-red-500"
                          onClick={() => {
                            setAnnouncementToDelete(announcement);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-[Manrope]">
              {editingAnnouncement ? "Edit Announcement" : "New Announcement"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Announcement title"
              />
            </div>
            <div className="space-y-2">
              <Label>Content *</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Announcement details"
                rows={5}
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
                <Label>Expires On</Label>
                <Input
                  type="date"
                  value={formData.expires_at}
                  onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <Label className="font-medium">Pin Announcement</Label>
                <p className="text-xs text-slate-500">Pinned announcements appear at the top</p>
              </div>
              <Switch
                checked={formData.is_pinned}
                onCheckedChange={(checked) => setFormData({ ...formData, is_pinned: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button 
              className="bg-[#2E375B] hover:bg-[#232B47]"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : (editingAnnouncement ? "Update" : "Publish")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Announcement</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this announcement? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
