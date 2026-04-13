import { useEffect, useState } from "react";
import { Megaphone, Pin, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api/member`;

const CATEGORIES = {
  general: { label: "General", className: "bg-slate-100 text-slate-700" },
  event: { label: "Event", className: "bg-purple-100 text-purple-700" },
  maintenance: { label: "Maintenance", className: "bg-yellow-100 text-yellow-700" },
  important: { label: "Important", className: "bg-red-100 text-red-700" }
};

export default function MemberAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const response = await axios.get(`${API}/announcements`);
        setAnnouncements(response.data);
      } catch (error) {
        // silenced
      } finally {
        setLoading(false);
      }
    };
    fetchAnnouncements();
  }, []);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const pinnedAnnouncements = announcements.filter(a => a.is_pinned);
  const regularAnnouncements = announcements.filter(a => !a.is_pinned);

  return (
    <div className="space-y-6 animate-fade-in" data-testid="member-announcements">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 font-[Manrope]">Community Announcements</h1>
        <p className="text-slate-600 mt-1">Stay updated with the latest news from Thryve</p>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-500">Loading announcements...</div>
      ) : announcements.length === 0 ? (
        <Card className="border border-slate-200">
          <CardContent className="p-8 text-center">
            <Megaphone className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">No announcements at the moment</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Pinned Announcements */}
          {pinnedAnnouncements.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Pin className="w-5 h-5 text-[#FFA14A]" />
                Pinned
              </h2>
              {pinnedAnnouncements.map(announcement => (
                <Card key={announcement.id} className="border-2 border-[#FFA14A]/30 bg-[#FFA14A]/5">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-2 mb-3">
                      <Badge className={CATEGORIES[announcement.category]?.className || CATEGORIES.general.className}>
                        {CATEGORIES[announcement.category]?.label || announcement.category}
                      </Badge>
                      <Pin className="w-4 h-4 text-[#FFA14A]" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">{announcement.title}</h3>
                    <p className="text-slate-600 mt-2 whitespace-pre-wrap">{announcement.content}</p>
                    <div className="flex items-center gap-4 mt-4 text-xs text-slate-500">
                      <span>By {announcement.author_name}</span>
                      <span>{formatDate(announcement.created_at)}</span>
                      {announcement.expires_at && (
                        <span className="flex items-center gap-1 text-amber-600">
                          <Calendar className="w-3 h-3" />
                          Expires: {formatDate(announcement.expires_at)}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Regular Announcements */}
          {regularAnnouncements.length > 0 && (
            <div className="space-y-4">
              {pinnedAnnouncements.length > 0 && (
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-[#2E375B]" />
                  All Announcements
                </h2>
              )}
              {regularAnnouncements.map(announcement => (
                <Card key={announcement.id} className="border border-slate-200 hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="mb-3">
                      <Badge className={CATEGORIES[announcement.category]?.className || CATEGORIES.general.className}>
                        {CATEGORIES[announcement.category]?.label || announcement.category}
                      </Badge>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">{announcement.title}</h3>
                    <p className="text-slate-600 mt-2 whitespace-pre-wrap">{announcement.content}</p>
                    <div className="flex items-center gap-4 mt-4 text-xs text-slate-500">
                      <span>By {announcement.author_name}</span>
                      <span>{formatDate(announcement.created_at)}</span>
                      {announcement.expires_at && (
                        <span className="flex items-center gap-1 text-amber-600">
                          <Calendar className="w-3 h-3" />
                          Expires: {formatDate(announcement.expires_at)}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
