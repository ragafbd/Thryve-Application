import { useEffect, useState } from "react";
import { Calendar, Clock, Users, Building2, X, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
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

// Booking rules
const MAX_ADVANCE_DAYS = 10;
const MIN_CANCEL_DAYS = 2;

// Public holidays (example)
const PUBLIC_HOLIDAYS = [
  "2026-01-26", "2026-03-10", "2026-04-03", "2026-04-14",
  "2026-05-01", "2026-08-15", "2026-10-02", "2026-10-20",
  "2026-11-09", "2026-11-10", "2026-12-25",
];

export default function MemberBookings() {
  const { member, refreshProfile } = useMemberAuth();
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    let date = new Date();
    while (date.getDay() === 0 || PUBLIC_HOLIDAYS.includes(date.toISOString().split('T')[0])) {
      date.setDate(date.getDate() + 1);
    }
    return date.toISOString().split('T')[0];
  });
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [slots, setSlots] = useState([]);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ purpose: "" });

  // Calculate date limits
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + MAX_ADVANCE_DAYS);
  
  const minDateStr = today.toISOString().split('T')[0];
  const maxDateStr = maxDate.toISOString().split('T')[0];

  const isBlockedDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.getDay() === 0 || PUBLIC_HOLIDAYS.includes(dateStr);
  };

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
    if (!selectedRoom || isBlockedDate(selectedDate)) {
      setSlots([]);
      return;
    }
    try {
      const response = await axios.get(`${API}/rooms/${selectedRoom.id}/availability?date=${selectedDate}`);
      setSlots(response.data.slots || []);
      setSelectedSlots([]);
    } catch (error) {
      console.error("Failed to fetch availability:", error);
      setSlots([]);
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
    let date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    let newDateStr = date.toISOString().split('T')[0];
    
    // Skip blocked dates
    while (isBlockedDate(newDateStr) && newDateStr >= minDateStr && newDateStr <= maxDateStr) {
      date.setDate(date.getDate() + (days > 0 ? 1 : -1));
      newDateStr = date.toISOString().split('T')[0];
    }
    
    if (newDateStr >= minDateStr && newDateStr <= maxDateStr && !isBlockedDate(newDateStr)) {
      setSelectedDate(newDateStr);
    }
  };

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    
    if (isBlockedDate(newDate)) {
      toast.error("Bookings are not available on Sundays or public holidays");
      return;
    }
    
    if (newDate < minDateStr) {
      toast.error("Cannot book in the past");
      return;
    }
    
    if (newDate > maxDateStr) {
      toast.error(`Bookings can only be made up to ${MAX_ADVANCE_DAYS} days in advance`);
      return;
    }
    
    setSelectedDate(newDate);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  // Check if slots are consecutive
  const areConsecutive = (slotTimes) => {
    if (slotTimes.length <= 1) return true;
    const sortedSlots = [...slotTimes].sort();
    
    for (let i = 1; i < sortedSlots.length; i++) {
      const prevSlot = slots.find(s => s.start_time === sortedSlots[i - 1]);
      const currSlot = slots.find(s => s.start_time === sortedSlots[i]);
      if (prevSlot && currSlot && prevSlot.end_time !== currSlot.start_time) {
        return false;
      }
    }
    return true;
  };

  const handleSlotClick = (slot) => {
    if (!slot.is_available) return;
    
    const slotTime = slot.start_time;
    const isSelected = selectedSlots.includes(slotTime);
    
    if (isSelected) {
      setSelectedSlots(selectedSlots.filter(t => t !== slotTime));
    } else {
      const newSelection = [...selectedSlots, slotTime];
      if (areConsecutive(newSelection)) {
        setSelectedSlots(newSelection);
      } else {
        toast.error("Please select consecutive time slots");
      }
    }
  };

  const openBookingDialog = () => {
    if (selectedSlots.length === 0) {
      toast.error("Please select at least one time slot");
      return;
    }
    
    setFormData({ purpose: "" });
    setDialogOpen(true);
  };

  const getBookingTimes = () => {
    if (selectedSlots.length === 0) return { start: "", end: "" };
    const sortedSlots = [...selectedSlots].sort();
    const firstSlot = slots.find(s => s.start_time === sortedSlots[0]);
    const lastSlot = slots.find(s => s.start_time === sortedSlots[sortedSlots.length - 1]);
    return { start: firstSlot?.start_time || "", end: lastSlot?.end_time || "" };
  };

  const handleBooking = async () => {
    const times = getBookingTimes();
    if (!times.start || !times.end) return;

    setSaving(true);
    try {
      await axios.post(`${API}/bookings`, {
        room_id: selectedRoom.id,
        date: selectedDate,
        start_time: times.start,
        end_time: times.end,
        purpose: formData.purpose
      });
      toast.success("Room booked successfully!");
      setDialogOpen(false);
      setSelectedSlots([]);
      fetchBookings();
      fetchAvailability();
      refreshProfile();
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

  const canCancelBooking = (booking) => {
    const bookingDate = new Date(booking.date);
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((bookingDate - todayDate) / (1000 * 60 * 60 * 24));
    return diffDays >= MIN_CANCEL_DAYS;
  };

  const handleCancelBooking = async (booking) => {
    if (!canCancelBooking(booking)) {
      toast.error(`Bookings can only be cancelled ${MIN_CANCEL_DAYS} or more days before the event`);
      return;
    }
    
    if (!window.confirm("Are you sure you want to cancel this booking?")) return;
    
    try {
      await axios.delete(`${API}/bookings/${booking.id}`);
      toast.success("Booking cancelled");
      fetchBookings();
      fetchAvailability();
      refreshProfile();
    } catch (error) {
      const errorDetail = error.response?.data?.detail;
      if (typeof errorDetail === 'string') {
        toast.error(errorDetail);
      } else {
        toast.error("Failed to cancel booking");
      }
    }
  };

  const creditsRemaining = (member?.meeting_room_credits || 0) - (member?.credits_used || 0);
  const upcomingBookings = bookings.filter(b => b.date >= minDateStr && b.status !== 'cancelled');
  const totalMinutes = selectedSlots.length * (selectedRoom?.slot_duration || 30);
  const currentDateBlocked = isBlockedDate(selectedDate);
  const times = getBookingTimes();

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
      <div className="bg-[#2E375B]/5 border border-[#2E375B]/10 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#FFA14A] mt-0.5 flex-shrink-0" />
          <div className="text-sm text-[#2E375B]/80 space-y-1">
            <p>• Advance bookings can be done for the next 10 days only</p>
            <p>• Cancellations within 48 hours of the event or No shows will result in credits being used</p>
            <p>• Bookings will not be allowed for Sundays or Public Holidays</p>
          </div>
        </div>
      </div>

      {/* Date Navigation - Single Line */}
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
            
            <div className="flex items-center gap-3 relative">
              <Calendar className="w-5 h-5 text-[#2E375B]" />
              <span className="text-lg font-semibold text-[#2E375B]">
                {formatDate(selectedDate)}
              </span>
              <Input
                type="date"
                value={selectedDate}
                onChange={handleDateChange}
                min={minDateStr}
                max={maxDateStr}
                className="absolute inset-0 opacity-0 cursor-pointer w-full"
              />
            </div>
            
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

      {/* Sunday/Holiday Warning */}
      {currentDateBlocked && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-red-700 font-medium">
            {new Date(selectedDate).getDay() === 0 
              ? "Bookings are not available on Sundays" 
              : "Bookings are not available on this public holiday"}
          </p>
        </div>
      )}

      {/* Room Selection */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {rooms.map(room => (
          <Button
            key={room.id}
            variant={selectedRoom?.id === room.id ? "default" : "outline"}
            className={selectedRoom?.id === room.id 
              ? "bg-[#2E375B] hover:bg-[#232B47]" 
              : "border-[#2E375B]/20 text-[#2E375B] hover:bg-[#2E375B]/10"}
            onClick={() => setSelectedRoom(room)}
          >
            <Building2 className="w-4 h-4 mr-2" />
            {room.name}
            <span className="ml-2 text-xs opacity-70">({room.capacity} seats)</span>
          </Button>
        ))}
      </div>

      {/* Room Info & Slots */}
      {selectedRoom && !currentDateBlocked && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Room Details */}
          <Card className="border border-[#2E375B]/10">
            <CardHeader>
              <CardTitle className="text-lg font-semibold font-[Manrope] text-[#2E375B]">
                {selectedRoom.display_name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-[#2E375B]/70">
                <Users className="w-4 h-4" />
                <span>{selectedRoom.capacity} seats</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#2E375B]/70">
                <Clock className="w-4 h-4" />
                <span>{selectedRoom.slot_duration} min slots</span>
              </div>
              <div className="text-sm font-semibold text-[#2E375B]">
                Rs. {selectedRoom.hourly_rate}/hour
              </div>
              <div className="pt-2 border-t border-[#2E375B]/10">
                <p className="text-xs text-[#2E375B]/60">
                  Select multiple consecutive slots, then click "Book Selected"
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Time Slots */}
          <Card className="border border-[#2E375B]/10 lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold font-[Manrope] flex items-center gap-2 text-[#2E375B]">
                <Clock className="w-5 h-5" />
                Available Slots (10 AM - 7 PM)
              </CardTitle>
              {selectedSlots.length > 0 && (
                <div className="flex items-center gap-2">
                  <Badge className="bg-[#FFA14A] text-white">
                    {selectedSlots.length} slot{selectedSlots.length > 1 ? 's' : ''} ({totalMinutes} min)
                  </Badge>
                  <Button 
                    size="sm" 
                    className="bg-[#2E375B] hover:bg-[#232B47]"
                    onClick={openBookingDialog}
                  >
                    Book Selected
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="border-[#2E375B]/20 text-[#2E375B]"
                    onClick={() => setSelectedSlots([])}
                  >
                    Clear
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {slots.map((slot, idx) => {
                  const isSelected = selectedSlots.includes(slot.start_time);
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSlotClick(slot)}
                      disabled={!slot.is_available}
                      className={`p-2 rounded-lg text-xs font-medium transition-all ${
                        isSelected
                          ? "bg-[#2E375B] text-white ring-2 ring-[#FFA14A]"
                          : slot.is_available
                          ? "bg-[#2E375B]/10 text-[#2E375B] hover:bg-[#2E375B]/20 cursor-pointer"
                          : "bg-[#2E375B]/5 text-[#2E375B]/30 cursor-not-allowed"
                      }`}
                    >
                      {slot.start_time}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-4 text-xs text-[#2E375B]/70">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-[#2E375B]/10"></div>
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-[#2E375B]"></div>
                  <span>Selected</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-[#2E375B]/5"></div>
                  <span>Booked</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* My Upcoming Bookings */}
      <Card className="border border-[#2E375B]/10">
        <CardHeader>
          <CardTitle className="text-lg font-semibold font-[Manrope] text-[#2E375B]">
            My Upcoming Bookings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingBookings.length === 0 ? (
            <p className="text-[#2E375B]/60 text-sm">No upcoming bookings</p>
          ) : (
            <div className="space-y-3">
              {upcomingBookings.map(booking => {
                const canCancel = canCancelBooking(booking);
                return (
                  <div key={booking.id} className="flex items-center justify-between p-3 bg-[#2E375B]/5 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[100px]">
                        <p className="font-semibold text-[#2E375B]">{booking.room_name}</p>
                        <p className="text-xs text-[#2E375B]/60">{booking.date}</p>
                      </div>
                      <div>
                        <p className="font-mono text-sm text-[#2E375B]">{booking.start_time} - {booking.end_time}</p>
                        {booking.purpose && <p className="text-xs text-[#2E375B]/60">{booking.purpose}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {booking.credits_used > 0 && (
                        <Badge className="bg-[#2E375B]/10 text-[#2E375B]">{booking.credits_used} min</Badge>
                      )}
                      {booking.billable_amount > 0 && (
                        <Badge className="bg-[#FFA14A]/10 text-[#FFA14A]">Rs. {booking.billable_amount}</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className={canCancel 
                          ? "text-red-500 hover:text-red-700 hover:bg-red-50" 
                          : "text-[#2E375B]/30 cursor-not-allowed"}
                        onClick={() => canCancel && handleCancelBooking(booking)}
                        disabled={!canCancel}
                        title={canCancel ? 'Cancel booking' : 'Cannot cancel within 48 hours'}
                      >
                        <X className="w-4 h-4 mr-1" />
                        {canCancel ? 'Cancel' : 'Cannot Cancel'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Booking Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#2E375B] font-[Manrope]">Book {selectedRoom?.display_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-[#2E375B]/5 p-3 rounded-lg">
              <p className="text-sm font-medium text-[#2E375B]">{formatDate(selectedDate)}</p>
              <p className="text-lg font-semibold text-[#2E375B]">
                {times.start} - {times.end}
              </p>
              <p className="text-xs text-[#2E375B]/60 mt-1">
                {selectedSlots.length} slot{selectedSlots.length > 1 ? 's' : ''} • {totalMinutes} minutes total
              </p>
            </div>
            
            <div className="bg-[#FFA14A]/10 p-3 rounded-lg text-sm">
              <p className="font-medium text-[#FFA14A]">Your Credits: {creditsRemaining} min remaining</p>
              <p className="text-[#FFA14A]/70 text-xs mt-1">
                If credits are insufficient, the remaining time will be billed at Rs. {selectedRoom?.hourly_rate}/hour
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-[#2E375B]">Purpose (optional)</Label>
              <Input
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                placeholder="Meeting purpose"
                className="border-[#2E375B]/20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-[#2E375B]/20 text-[#2E375B]">
              Cancel
            </Button>
            <Button 
              className="bg-[#2E375B] hover:bg-[#232B47]"
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
