import { useEffect, useState } from "react";
import { Cake, Calendar, Building2 } from "lucide-react";
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
        // Fetch birthdays for the next 10 days
        const response = await axios.get(`${API}/management/birthdays/upcoming?days=10`);
        setBirthdays(response.data || []);
      } catch (error) {
        // silenced
      } finally {
        setLoading(false);
      }
    };
    fetchBirthdays();
  }, []);

  // Format date as "Mar 21" (Month abbreviation and day)
  const formatBirthdayDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = date.getDate();
    const month = months[date.getMonth()];
    return `${month} ${day}`;
  };

  // Format days until text
  const formatDaysUntil = (daysUntil) => {
    if (daysUntil === 0) return "Today!";
    if (daysUntil === 1) return "Tomorrow";
    return `in ${daysUntil} days`;
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
            Member birthdays in the next 10 days
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
        <CardHeader className="border-b border-slate-100 bg-slate-50 py-3">
          <CardTitle className="text-sm font-semibold text-slate-600">
            Birthdays in the next 10 days
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading...</div>
          ) : birthdays.length === 0 ? (
            <div className="p-8 text-center">
              <Cake className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No upcoming birthdays in the next 10 days</p>
              <p className="text-slate-400 text-sm mt-1">Check back later or add date of birth for members</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {birthdays.map((member) => (
                <div 
                  key={member.id} 
                  className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                  data-testid={`birthday-row-${member.id}`}
                >
                  {/* Left: Member Info */}
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      member.days_until === 0 
                        ? 'bg-green-100' 
                        : member.days_until <= 3 
                          ? 'bg-amber-100' 
                          : 'bg-slate-100'
                    }`}>
                      <Cake className={`w-5 h-5 ${
                        member.days_until === 0 
                          ? 'text-green-600' 
                          : member.days_until <= 3 
                            ? 'text-amber-600' 
                            : 'text-slate-500'
                      }`} />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{member.name}</p>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Building2 className="w-3 h-3" />
                        <span>{member.company_name || "No company"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Date and Days Until */}
                  <div className="flex items-center gap-6">
                    {/* Birthday Date */}
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-700 font-medium">
                        {formatBirthdayDate(member.date_of_birth)}
                      </span>
                    </div>

                    {/* Days Until Badge */}
                    <Badge className={`px-3 py-1 text-xs font-medium ${
                      member.days_until === 0 
                        ? 'bg-green-500 text-white' 
                        : member.days_until <= 3 
                          ? 'bg-amber-500 text-white' 
                          : 'bg-slate-200 text-slate-700'
                    }`}>
                      {formatDaysUntil(member.days_until)}
                    </Badge>
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
