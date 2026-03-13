import { useEffect, useState } from "react";
import { Cake, Phone, Building2, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function UpcomingBirthdays() {
  const [birthdays, setBirthdays] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBirthdays = async () => {
      try {
        const response = await axios.get(`${API}/management/birthdays/upcoming?days=365`);
        setBirthdays(response.data || []);
      } catch (error) {
        console.error("Error fetching birthdays:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchBirthdays();
  }, []);

  // Format date as dd-mm
  const formatBirthday = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}-${month}`;
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="upcoming-birthdays-page">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#2E375B] flex items-center justify-center">
          <Cake className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-[Manrope]">
            Upcoming Birthdays
          </h1>
          <p className="text-slate-500 text-sm">
            Member birthdays in the upcoming year
          </p>
        </div>
        {birthdays.length > 0 && (
          <Badge className="ml-auto bg-[#2E375B] text-white text-sm px-3 py-1">
            {birthdays.length} {birthdays.length === 1 ? 'Birthday' : 'Birthdays'}
          </Badge>
        )}
      </div>

      {/* Birthdays List */}
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-slate-50">
          <div className="grid grid-cols-12 gap-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
            <div className="col-span-4">Member Name</div>
            <div className="col-span-3">Client Name</div>
            <div className="col-span-2">Birthday</div>
            <div className="col-span-3">Phone Number</div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading...</div>
          ) : birthdays.length === 0 ? (
            <div className="p-8 text-center">
              <Cake className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No upcoming birthdays found</p>
              <p className="text-slate-400 text-sm mt-1">Add date of birth for members to see them here</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {birthdays.map((member) => (
                <div 
                  key={member.id} 
                  className="grid grid-cols-12 gap-4 p-4 hover:bg-slate-50 transition-colors items-center"
                  data-testid={`birthday-row-${member.id}`}
                >
                  {/* Member Name */}
                  <div className="col-span-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                      <Cake className="w-4 h-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{member.name}</p>
                      {member.is_today && (
                        <Badge className="bg-green-500 text-white text-xs mt-0.5">Today!</Badge>
                      )}
                      {!member.is_today && member.days_until <= 7 && (
                        <span className="text-xs text-amber-600">In {member.days_until} day{member.days_until > 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>

                  {/* Client/Company Name */}
                  <div className="col-span-3 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600 text-sm">{member.company_name || "-"}</span>
                  </div>

                  {/* Birthday (dd-mm) */}
                  <div className="col-span-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-700 font-mono text-sm">
                      {formatBirthday(member.date_of_birth)}
                    </span>
                  </div>

                  {/* Phone Number */}
                  <div className="col-span-3 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600 text-sm font-mono">
                      {member.phone || "-"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
