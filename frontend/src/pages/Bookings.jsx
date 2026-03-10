import { useEffect, useState } from "react";
import { Calendar, Clock, Users, Building2, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Booking rules
const MAX_ADVANCE_DAYS = 10;

export default function Bookings() {
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [publicHolidays, setPublicHolidays] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);

  // Calculate date limits
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + MAX_ADVANCE_DAYS);
  
  const minDateStr = today.toISOString().split('T')[0];
  const maxDateStr = maxDate.toISOString().split('T')[0];

  // Check if date is a Sunday or public holiday
  const isBlockedDate = (dateStr) => {
    const date = new Date(dateStr);
    const isHoliday = publicHolidays.some(h => h.date === dateStr);
    return date.getDay() === 0 || isHoliday;
  };

  // Get holiday name for a date
  const getHolidayName = (dateStr) => {
    const holiday = publicHolidays.find(h => h.date === dateStr);
    return holiday ? holiday.name : null;
  };

  const fetchPublicHolidays = async () => {
    try {
      const response = await axios.get(`${API}/holidays`);
      setPublicHolidays(response.data);
    } catch (error) {
      console.error("Failed to fetch public holidays");
    }
  };

  const fetchRooms = async () => {
    try {
      const response = await axios.get(`${API}/management/rooms`);
      setRooms(response.data);
      if (response.data.length > 0 && !selectedRoom) {
        setSelectedRoom(response.data[0]);
      }
    } catch (error) {
      toast.error("Failed to fetch rooms");
    } finally {
      setLoading(false);
    }
  };

  const fetchBookings = async () => {
    try {
      const response = await axios.get(`${API}/management/bookings`);
      setBookings(response.data);
    } catch (error) {
      console.error("Failed to fetch bookings");
    }
  };

  const fetchAvailability = async () => {
    if (!selectedRoom) return;
    
    try {
      const response = await axios.get(
        `${API}/management/bookings/availability?room_id=${selectedRoom.id}&date=${selectedDate}`
      );
      setSlots(response.data.slots || []);
    } catch (error) {
      console.error("Failed to fetch availability");
      setSlots([]);
    }
  };

  useEffect(() => {
    fetchPublicHolidays();
    fetchRooms();
    fetchBookings();
  }, []);

  useEffect(() => {
    fetchAvailability();
  }, [selectedDate, selectedRoom]);

  // Change date by number of days
  const changeDate = (days) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    const newDateStr = date.toISOString().split('T')[0];
    
    if (newDateStr >= minDateStr && newDateStr <= maxDateStr) {
      setSelectedDate(newDateStr);
    }
  };

  // Format date for display with ordinal suffix
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const day = date.getDate();
    const weekday = date.toLocaleDateString('en-IN', { weekday: 'long' });
    const month = date.toLocaleDateString('en-IN', { month: 'long' });
    const year = date.getFullYear();
    
    const getOrdinal = (n) => {
      if (n > 3 && n < 21) return 'th';
      switch (n % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    };
    
    return `${weekday}, ${day}${getOrdinal(day)} ${month}, ${year}`;
  };

  const currentDateBlocked = isBlockedDate(selectedDate);

  // Get booking info for a slot
  const getBookingForSlot = (slot) => {
    return bookings.find(b => 
      b.room_id === selectedRoom?.id && 
      b.date === selectedDate && 
      b.start_time === slot.start_time &&
      b.status !== 'cancelled'
    );
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="bookings-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#2E375B] tracking-tight font-[Manrope]">
            Meeting Room Bookings
          </h1>
          <p className="text-[#2E375B]/60 mt-1">
            View room availability and bookings (10 AM - 7 PM, Mon-Sat)
          </p>
        </div>
      </div>

      {/* Date Navigation */}
      <Card className="border border-[#2E375B]/10">
        <CardContent className="p-4">
          <div className="flex items-center justify-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => changeDate(-1)}
              disabled={selectedDate <= minDateStr}
              className="text-[#2E375B] hover:bg-[#2E375B]/10"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            
            <span className="text-lg font-semibold text-[#2E375B]">
              {formatDate(selectedDate)}
            </span>
            
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => changeDate(1)}
              disabled={selectedDate >= maxDateStr}
              className="text-[#2E375B] hover:bg-[#2E375B]/10"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sunday/Holiday Warning with Holiday Name */}
      {currentDateBlocked && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-red-700 font-medium">
            {new Date(selectedDate).getDay() === 0 
              ? "Bookings are not available on Sundays" 
              : `Bookings are not available on ${getHolidayName(selectedDate) || 'this public holiday'}`}
          </p>
          <p className="text-red-600 text-sm mt-1">Please select a different date</p>
        </div>
      )}

      {/* Room Selection and Slots */}
      {!currentDateBlocked && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Room Selection */}
          <Card className="lg:col-span-1 border border-[#2E375B]/10">
            <CardHeader>
              <CardTitle className="text-lg font-semibold font-[Manrope] flex items-center gap-2 text-[#2E375B]">
                <Building2 className="w-5 h-5" />
                Select Room
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {rooms.map(room => (
                <button
                  key={room.id}
                  onClick={() => setSelectedRoom(room)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedRoom?.id === room.id
                      ? "border-[#FFA14A] bg-[#FFA14A]/10"
                      : "border-[#2E375B]/10 hover:border-[#2E375B]/30"
                  }`}
                >
                  <p className="font-medium text-[#2E375B]">{room.display_name}</p>
                  <p className="text-sm text-[#2E375B]/60">
                    {room.capacity} seats • ₹{room.hourly_rate}/hr
                  </p>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Time Slots */}
          <Card className="lg:col-span-3 border border-[#2E375B]/10">
            <CardHeader>
              <CardTitle className="text-lg font-semibold font-[Manrope] flex items-center gap-2 text-[#2E375B]">
                <Clock className="w-5 h-5" />
                {selectedRoom?.display_name || "Room"} - Availability
              </CardTitle>
            </CardHeader>
            <CardContent>
              {slots.length === 0 ? (
                <p className="text-center py-8 text-[#2E375B]/60">
                  {loading ? "Loading slots..." : "No slots available"}
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {slots.map((slot, idx) => {
                    const booking = getBookingForSlot(slot);
                    const isBooked = !slot.is_available || booking;
                    
                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border text-center ${
                          isBooked
                            ? "bg-red-50 border-red-200"
                            : "bg-green-50 border-green-200"
                        }`}
                      >
                        <p className={`font-medium ${isBooked ? "text-red-700" : "text-green-700"}`}>
                          {slot.start_time} - {slot.end_time}
                        </p>
                        {isBooked ? (
                          <div className="mt-1">
                            <Badge className="bg-red-100 text-red-700 text-xs">Booked</Badge>
                            {booking && (
                              <p className="text-xs text-red-600 mt-1 truncate" title={booking.member_name}>
                                {booking.member_name || "Member"}
                              </p>
                            )}
                          </div>
                        ) : (
                          <Badge className="bg-green-100 text-green-700 text-xs mt-1">Available</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Today's Bookings */}
      <Card className="border border-[#2E375B]/10">
        <CardHeader>
          <CardTitle className="text-lg font-semibold font-[Manrope] flex items-center gap-2 text-[#2E375B]">
            <Calendar className="w-5 h-5" />
            Bookings for {formatDate(selectedDate)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const dayBookings = bookings.filter(b => b.date === selectedDate && b.status !== 'cancelled');
            if (dayBookings.length === 0) {
              return <p className="text-center py-4 text-[#2E375B]/60">No bookings for this date</p>;
            }
            return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 text-[#2E375B]/70">Room</th>
                      <th className="text-left p-3 text-[#2E375B]/70">Time</th>
                      <th className="text-left p-3 text-[#2E375B]/70">Member</th>
                      <th className="text-left p-3 text-[#2E375B]/70">Purpose</th>
                      <th className="text-left p-3 text-[#2E375B]/70">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayBookings.map((booking) => (
                      <tr key={booking.id} className="border-b hover:bg-slate-50">
                        <td className="p-3 font-medium text-[#2E375B]">{booking.room_name}</td>
                        <td className="p-3 text-[#2E375B]">{booking.start_time} - {booking.end_time}</td>
                        <td className="p-3 text-[#2E375B]">{booking.member_name}</td>
                        <td className="p-3 text-[#2E375B]/70">{booking.purpose || "-"}</td>
                        <td className="p-3">
                          <Badge className={
                            booking.status === 'confirmed' 
                              ? "bg-green-100 text-green-700" 
                              : "bg-amber-100 text-amber-700"
                          }>
                            {booking.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
