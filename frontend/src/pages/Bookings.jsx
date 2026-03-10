import { useEffect, useState } from "react";
import { Calendar, Clock, Users, Building2, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MAX_ADVANCE_DAYS = 10;

// Helper function to get local date string (YYYY-MM-DD)
const getLocalDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function Bookings() {
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [members, setMembers] = useState([]);
  const [publicHolidays, setPublicHolidays] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    return getLocalDateString(new Date());
  });
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Booking dialog
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingForm, setBookingForm] = useState({
    member_id: "",
    purpose: ""
  });
  const [saving, setSaving] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + MAX_ADVANCE_DAYS);
  
  const minDateStr = getLocalDateString(today);
  const maxDateStr = getLocalDateString(maxDate);

  const isBlockedDate = (dateStr) => {
    const date = new Date(dateStr);
    const isHoliday = publicHolidays.some(h => h.date === dateStr);
    return date.getDay() === 0 || isHoliday;
  };

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

  const fetchMembers = async () => {
    try {
      const response = await axios.get(`${API}/management/members`);
      setMembers(response.data.filter(m => m.status === 'active'));
    } catch (error) {
      console.error("Failed to fetch members");
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
    fetchMembers();
  }, []);

  useEffect(() => {
    fetchAvailability();
  }, [selectedDate, selectedRoom]);

  const changeDate = (days) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    const newDateStr = date.toISOString().split('T')[0];
    
    if (newDateStr >= minDateStr && newDateStr <= maxDateStr) {
      setSelectedDate(newDateStr);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getBookingForSlot = (slot) => {
    return bookings.find(b => 
      b.room_id === selectedRoom?.id &&
      b.date === selectedDate &&
      b.start_time === slot.start_time &&
      b.status !== 'cancelled'
    );
  };

  const openBookingDialog = (slot) => {
    setSelectedSlot(slot);
    setBookingForm({ member_id: "", purpose: "" });
    setBookingDialogOpen(true);
  };

  const handleBookSlot = async () => {
    if (!bookingForm.member_id) {
      toast.error("Please select a member");
      return;
    }

    setSaving(true);
    try {
      await axios.post(`${API}/management/bookings`, {
        room_id: selectedRoom.id,
        member_id: bookingForm.member_id,
        date: selectedDate,
        start_time: selectedSlot.start_time,
        end_time: selectedSlot.end_time,
        purpose: bookingForm.purpose
      });
      
      toast.success("Booking created successfully");
      setBookingDialogOpen(false);
      fetchBookings();
      fetchAvailability();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create booking");
    } finally {
      setSaving(false);
    }
  };

  const currentDateBlocked = isBlockedDate(selectedDate);

  return (
    <div className="space-y-6 animate-fade-in" data-testid="bookings-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#2E375B] tracking-tight font-[Manrope]">
            Meeting Room Bookings
          </h1>
          <p className="text-[#2E375B] mt-1">
            Book and manage meeting room reservations
          </p>
        </div>
      </div>

      {/* Date Navigation */}
      <Card className="border border-[#2E375B]/10">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="icon"
              onClick={() => changeDate(-1)}
              disabled={selectedDate <= minDateStr}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <div className="text-center">
              <input
                type="date"
                value={selectedDate}
                min={minDateStr}
                max={maxDateStr}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-lg font-semibold text-[#2E375B] border rounded px-3 py-2 cursor-pointer"
              />
            </div>
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => changeDate(1)}
              disabled={selectedDate >= maxDateStr}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Blocked Date Warning */}
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
                  <p className="text-sm text-[#2E375B]">
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
                <p className="text-center py-8 text-[#2E375B]">
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
                            : "bg-green-50 border-green-200 cursor-pointer hover:bg-green-100"
                        }`}
                        onClick={() => !isBooked && openBookingDialog(slot)}
                      >
                        <p className={`font-medium ${isBooked ? "text-red-700" : "text-green-700"}`}>
                          {slot.start_time} - {slot.end_time}
                        </p>
                        {isBooked ? (
                          <div className="mt-1">
                            <Badge className="bg-red-100 text-red-700 text-xs">Booked</Badge>
                            {booking && (
                              <div className="text-xs text-red-600 mt-1">
                                <p className="truncate font-medium" title={booking.company_name}>
                                  {booking.company_name || "Company"}
                                </p>
                                <p className="truncate" title={booking.member_name}>
                                  {booking.member_name || "Member"}
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="mt-1">
                            <Badge className="bg-green-100 text-green-700 text-xs">Available</Badge>
                            <p className="text-xs text-green-600 mt-1">Click to book</p>
                          </div>
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
              return <p className="text-center py-4 text-[#2E375B]">No bookings for this date</p>;
            }
            return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 text-[#2E375B]">Room</th>
                      <th className="text-left p-3 text-[#2E375B]">Time</th>
                      <th className="text-left p-3 text-[#2E375B]">Company</th>
                      <th className="text-left p-3 text-[#2E375B]">Member</th>
                      <th className="text-left p-3 text-[#2E375B]">Purpose</th>
                      <th className="text-left p-3 text-[#2E375B]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayBookings.map((booking) => (
                      <tr key={booking.id} className="border-b hover:bg-slate-50">
                        <td className="p-3 font-medium text-[#2E375B]">{booking.room_name}</td>
                        <td className="p-3 text-[#2E375B]">{booking.start_time} - {booking.end_time}</td>
                        <td className="p-3 text-[#2E375B]">{booking.company_name || "-"}</td>
                        <td className="p-3 text-[#2E375B]">{booking.member_name}</td>
                        <td className="p-3 text-[#2E375B]">{booking.purpose || "-"}</td>
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

      {/* Booking Dialog */}
      <Dialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-[#2E375B]">Book Meeting Room</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-[#2E375B]/5 p-3 rounded-lg">
              <p className="text-sm text-[#2E375B]"><strong>Room:</strong> {selectedRoom?.display_name}</p>
              <p className="text-sm text-[#2E375B]"><strong>Date:</strong> {formatDate(selectedDate)}</p>
              <p className="text-sm text-[#2E375B]"><strong>Time:</strong> {selectedSlot?.start_time} - {selectedSlot?.end_time}</p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-[#2E375B]">Select Member *</Label>
              <Select 
                value={bookingForm.member_id} 
                onValueChange={(value) => setBookingForm({...bookingForm, member_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a member" />
                </SelectTrigger>
                <SelectContent>
                  {members.map(member => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name} ({member.company_name || 'No Company'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-[#2E375B]">Purpose (Optional)</Label>
              <Input
                value={bookingForm.purpose}
                onChange={(e) => setBookingForm({...bookingForm, purpose: e.target.value})}
                placeholder="Meeting purpose"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBookingDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleBookSlot} 
              disabled={saving}
              className="bg-[#2E375B] hover:bg-[#232B47]"
            >
              {saving ? "Booking..." : "Confirm Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
