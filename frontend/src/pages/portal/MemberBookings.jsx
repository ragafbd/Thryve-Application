import { useEffect, useState } from "react";
import { Plus, CalendarDays, Clock, Users, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "sonner";
import axios from "axios";
import { useMemberAuth } from "@/contexts/MemberAuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api/member`;

export default function MemberBookings() {
  const { member, refreshProfile } = useMemberAuth();
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    start_time: "",
    end_time: "",
    purpose: ""
  });

  const fetchRooms = async () => {
    try {
      const response = await axios.get(`${API}/rooms`);
      setRooms(response.data);
      if (response.data.length > 0 && !selectedRoom) {
        setSelectedRoom(response.data[0]);
      }
    } catch (error) {
      console.error("Failed to fetch rooms:", error);
    }
  };

  const fetchBookings = async () => {
    try {
      const response = await axios.get(`${API}/bookings`);
      setBookings(response.data);
    } catch (error) {
      console.error("Failed to fetch bookings:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailability = async () => {
    if (!selectedRoom) return;
    try {
      const response = await axios.get(`${API}/rooms/${selectedRoom.id}/availability?date=${selectedDate}`);
      setSlots(response.data.slots);
    } catch (error) {
      console.error("Failed to fetch availability:", error);
    }
  };

  useEffect(() => {
    fetchRooms();
    fetchBookings();
  }, []);

  useEffect(() => {
    fetchAvailability();
  }, [selectedDate, selectedRoom]);

  const changeDate = (days) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    // Don't allow past dates
    if (date >= new Date().setHours(0,0,0,0)) {
      setSelectedDate(date.toISOString().split('T')[0]);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const handleSlotClick = (slot) => {
    if (!slot.is_available) return;
    setFormData({
      start_time: slot.start_time,
      end_time: slot.end_time,
      purpose: ""
    });
    setDialogOpen(true);
  };

  const handleBooking = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/bookings`, {
        room_id: selectedRoom.id,
        date: selectedDate,
        ...formData
      });
      toast.success("Room booked successfully!");
      setDialogOpen(false);
      fetchBookings();
      fetchAvailability();
      refreshProfile(); // Refresh credits
    } catch (error) {
      const errorDetail = error.response?.data?.detail;
      if (typeof errorDetail === 'string') {
        toast.error(errorDetail);
      } else if (Array.isArray(errorDetail)) {
        toast.error(errorDetail[0]?.msg || "Validation error");
      } else {
        toast.error("Failed to book room");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm("Are you sure you want to cancel this booking?")) return;
    
    try {
      await axios.delete(`${API}/bookings/${bookingId}`);
      toast.success("Booking cancelled");
      fetchBookings();
      fetchAvailability();
      refreshProfile(); // Refresh credits
    } catch (error) {
      const errorDetail = error.response?.data?.detail;
      if (typeof errorDetail === 'string') {
        toast.error(errorDetail);
      } else if (Array.isArray(errorDetail)) {
        toast.error(errorDetail[0]?.msg || "Validation error");
      } else {
        toast.error("Failed to cancel booking");
      }
    }
  };

  const creditsRemaining = (member?.meeting_room_credits || 0) - (member?.credits_used || 0);
  const upcomingBookings = bookings.filter(b => b.date >= new Date().toISOString().split('T')[0] && b.status !== 'cancelled');

  return (
    <div className="space-y-6 animate-fade-in" data-testid="member-bookings">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#2E375B] font-[Manrope]">Meeting Room Booking</h1>
          <p className="text-[#2E375B]/60 mt-1">Book meeting and conference rooms (10 AM - 7 PM)</p>
        </div>
        <div className="bg-[#FFA14A]/10 px-4 py-2 rounded-lg">
          <p className="text-sm text-[#FFA14A] font-medium">
            Credits Remaining: <span className="text-xl font-bold">{creditsRemaining}</span> min
          </p>
        </div>
      </div>
      
      {/* Booking Rules */}
      <div className="bg-[#2E375B]/5 border border-[#2E375B]/10 rounded-lg p-4 text-sm text-[#2E375B]/80">
        <p>• Advance bookings can be done for the next 10 days only</p>
        <p>• Cancellations within 48 hours of the event or No shows will result in credits being used</p>
        <p>• Bookings will not be allowed for Sundays or Public Holidays</p>
      </div>

      {/* Date Navigation */}
      <Card className="border border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => changeDate(-1)}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="text-center">
              <p className="text-lg font-semibold text-slate-900">{formatDate(selectedDate)}</p>
              <Input
                type="date"
                value={selectedDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-auto mx-auto mt-2"
              />
            </div>
            <Button variant="ghost" size="icon" onClick={() => changeDate(1)}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Room Selection */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {rooms.map(room => (
          <Button
            key={room.id}
            variant={selectedRoom?.id === room.id ? "default" : "outline"}
            className={selectedRoom?.id === room.id ? "bg-[#FFA14A] hover:bg-[#e8893a]" : ""}
            onClick={() => setSelectedRoom(room)}
          >
            {room.name}
            <span className="ml-2 text-xs opacity-70">({room.capacity} seats)</span>
          </Button>
        ))}
      </div>

      {/* Room Info & Slots */}
      {selectedRoom && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Room Details */}
          <Card className="border border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">{selectedRoom.display_name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-slate-500" />
                <span>{selectedRoom.capacity} seats</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-slate-500" />
                <span>{selectedRoom.slot_duration} min slots</span>
              </div>
              <div className="text-sm font-semibold text-[#FFA14A]">
                Rs. {selectedRoom.hourly_rate}/hour
              </div>
              <p className="text-xs text-slate-500 pt-2 border-t">
                Click on an available slot below to book
              </p>
            </CardContent>
          </Card>

          {/* Time Slots */}
          <Card className="border border-slate-200 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-[#FFA14A]" />
                Available Slots
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {slots.map((slot, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSlotClick(slot)}
                    disabled={!slot.is_available}
                    className={`p-2 rounded-lg text-xs font-medium transition-all ${
                      slot.is_available
                        ? "bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer"
                        : "bg-slate-100 text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    {slot.start_time}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-4 mt-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-green-100"></div>
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-slate-100"></div>
                  <span>Booked</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* My Upcoming Bookings */}
      <Card className="border border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">My Upcoming Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingBookings.length === 0 ? (
            <p className="text-slate-500 text-sm">No upcoming bookings</p>
          ) : (
            <div className="space-y-3">
              {upcomingBookings.map(booking => (
                <div key={booking.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="text-center min-w-[80px]">
                      <p className="font-semibold text-[#2E375B]">{booking.room_name}</p>
                      <p className="text-xs text-slate-500">{booking.date}</p>
                    </div>
                    <div>
                      <p className="font-mono text-sm">{booking.start_time} - {booking.end_time}</p>
                      {booking.purpose && <p className="text-xs text-slate-500">{booking.purpose}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {booking.credits_used > 0 && (
                      <Badge className="bg-blue-100 text-blue-700">{booking.credits_used} min</Badge>
                    )}
                    {booking.billable_amount > 0 && (
                      <Badge className="bg-amber-100 text-amber-700">Rs. {booking.billable_amount}</Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-700"
                      onClick={() => handleCancelBooking(booking.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Booking Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Book {selectedRoom?.display_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-sm font-medium">{formatDate(selectedDate)}</p>
              <p className="text-lg font-semibold text-[#FFA14A]">
                {formData.start_time} - {formData.end_time}
              </p>
            </div>
            
            <div className="bg-blue-50 p-3 rounded-lg text-sm">
              <p className="font-medium text-blue-700">Your Credits: {creditsRemaining} min remaining</p>
              <p className="text-blue-600 text-xs mt-1">
                If credits are insufficient, the remaining time will be billed at Rs. {selectedRoom?.hourly_rate}/hour
              </p>
            </div>

            <div className="space-y-2">
              <Label>Purpose (optional)</Label>
              <Input
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                placeholder="Meeting purpose"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button 
              className="bg-[#FFA14A] hover:bg-[#e8893a]"
              onClick={handleBooking}
              disabled={saving}
            >
              {saving ? "Booking..." : "Confirm Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
