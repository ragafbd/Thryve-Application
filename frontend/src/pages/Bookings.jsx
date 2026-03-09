import { useEffect, useState } from "react";
import { Calendar, Clock, Users, Building2, X, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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

// Booking rules
const MAX_ADVANCE_DAYS = 10;
const MIN_CANCEL_DAYS = 2;

export default function Bookings() {
  const [rooms, setRooms] = useState([]);
  const [members, setMembers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [publicHolidays, setPublicHolidays] = useState([]); // Full holiday objects with names
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [slots, setSlots] = useState([]);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    room_id: "",
    member_id: "",
    purpose: "",
    attendees: ""
  });

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
    }
  };

  const fetchMembers = async () => {
    try {
      const response = await axios.get(`${API}/management/members?status=active`);
      setMembers(response.data);
    } catch (error) {
      toast.error("Failed to fetch members");
    }
  };

  const fetchBookings = async () => {
    try {
      const response = await axios.get(`${API}/management/bookings?date=${selectedDate}`);
      setBookings(response.data);
    } catch (error) {
      toast.error("Failed to fetch bookings");
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailability = async () => {
    if (!selectedRoom) return;
    
    // Don't fetch slots for blocked dates
    if (isBlockedDate(selectedDate)) {
      setSlots([]);
      return;
    }
    
    try {
      const response = await axios.get(`${API}/management/bookings/availability?room_id=${selectedRoom.id}&date=${selectedDate}`);
      setSlots(response.data.slots);
      setSelectedSlots([]); // Reset selection on date/room change
    } catch (error) {
      console.error("Failed to fetch availability");
    }
  };

  useEffect(() => {
    fetchPublicHolidays();
    fetchRooms();
    fetchMembers();
  }, []);

  useEffect(() => {
    fetchBookings();
    fetchAvailability();
  }, [selectedDate, selectedRoom]);

  const changeDate = (days) => {
    let date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    let newDateStr = date.toISOString().split('T')[0];
    
    // Skip Sundays and holidays when navigating
    while (isBlockedDate(newDateStr) && newDateStr >= minDateStr && newDateStr <= maxDateStr) {
      date.setDate(date.getDate() + (days > 0 ? 1 : -1));
      newDateStr = date.toISOString().split('T')[0];
    }
    
    // Enforce date limits
    if (newDateStr >= minDateStr && newDateStr <= maxDateStr && !isBlockedDate(newDateStr)) {
      setSelectedDate(newDateStr);
    }
  };

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    
    if (isBlockedDate(newDate)) {
      const date = new Date(newDate);
      const dayName = date.getDay() === 0 ? 'Sunday' : 'public holiday';
      toast.error(`Bookings are not available on ${dayName}s`);
      return;
    }
    
    if (newDate >= minDateStr && newDate <= maxDateStr) {
      setSelectedDate(newDate);
    } else {
      toast.error(`Bookings can only be made up to ${MAX_ADVANCE_DAYS} days in advance`);
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
    const weekday = date.toLocaleDateString('en-IN', { weekday: 'long' });
    const month = date.toLocaleDateString('en-IN', { month: 'long' });
    const year = date.getFullYear();
    return `${weekday}, ${day}${ordinal(day)} ${month}, ${year}`;
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
      // Deselect
      setSelectedSlots(selectedSlots.filter(t => t !== slotTime));
    } else {
      // Select - check if it would be consecutive
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
    
    const sortedSlots = [...selectedSlots].sort();
    const firstSlot = slots.find(s => s.start_time === sortedSlots[0]);
    const lastSlot = slots.find(s => s.start_time === sortedSlots[sortedSlots.length - 1]);
    
    setFormData({
      room_id: selectedRoom.id,
      member_id: "",
      start_time: firstSlot.start_time,
      end_time: lastSlot.end_time,
      purpose: "",
      attendees: ""
    });
    setDialogOpen(true);
  };

  const handleBooking = async () => {
    if (!formData.member_id) {
      toast.error("Please select a member");
      return;
    }

    setSaving(true);
    try {
      await axios.post(`${API}/management/bookings`, {
        ...formData,
        date: selectedDate,
        attendees: formData.attendees ? parseInt(formData.attendees) : null
      });
      toast.success("Booking created successfully");
      setDialogOpen(false);
      setSelectedSlots([]);
      fetchBookings();
      fetchAvailability();
    } catch (error) {
      const errorDetail = error.response?.data?.detail;
      if (typeof errorDetail === 'string') {
        toast.error(errorDetail);
      } else if (Array.isArray(errorDetail)) {
        toast.error(errorDetail[0]?.msg || "Validation error");
      } else {
        toast.error("Failed to create booking");
      }
    } finally {
      setSaving(false);
    }
  };

  const canCancelBooking = (booking) => {
    const bookingDate = new Date(booking.date);
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const diffTime = bookingDate - todayDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= MIN_CANCEL_DAYS;
  };

  const handleCancelBooking = async (booking) => {
    if (!canCancelBooking(booking)) {
      toast.error(`Bookings can only be cancelled ${MIN_CANCEL_DAYS} or more days before the event`);
      return;
    }
    
    if (!window.confirm("Are you sure you want to cancel this booking?")) return;
    
    try {
      await axios.delete(`${API}/management/bookings/${booking.id}`);
      toast.success("Booking cancelled");
      fetchBookings();
      fetchAvailability();
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

  const getRoomBookings = (roomId) => {
    return bookings.filter(b => b.room_id === roomId);
  };

  const selectedMember = members.find(m => m.id === formData.member_id);
  
  // Calculate total duration for selected slots
  const totalMinutes = selectedSlots.length * (selectedRoom?.slot_duration || 30);
  
  // Check if current date is blocked
  const currentDateBlocked = isBlockedDate(selectedDate);

  return (
    <div className="space-y-6 animate-fade-in" data-testid="bookings-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#2E375B] tracking-tight font-[Manrope]">
            Meeting Room Booking
          </h1>
          <p className="text-[#2E375B]/60 mt-1">
            Book meeting rooms (10 AM - 7 PM, Mon-Sat)
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

      {/* Date Navigation - Simplified */}
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
            
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-[#2E375B]">
                {formatDate(selectedDate)}
              </span>
              <Input
                type="date"
                value={selectedDate}
                onChange={handleDateChange}
                min={minDateStr}
                max={maxDateStr}
                className="w-auto border-[#2E375B]/20"
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
          <p className="text-red-600 text-sm mt-1">Please select a different date</p>
        </div>
      )}

      {/* Room Tabs */}
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
              <div className="flex items-center gap-2 text-sm font-semibold text-[#2E375B]">
                <span>Rs. {selectedRoom.hourly_rate}/hour</span>
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

      {/* Today's Bookings */}
      <Card className="border border-[#2E375B]/10">
        <CardHeader>
          <CardTitle className="text-lg font-semibold font-[Manrope] text-[#2E375B]">
            Bookings for {formatDate(selectedDate)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-[#2E375B]/60">Loading...</p>
          ) : bookings.length === 0 ? (
            <p className="text-[#2E375B]/60">No bookings for this date</p>
          ) : (
            <div className="space-y-4">
              {rooms.map(room => {
                const roomBookings = getRoomBookings(room.id);
                if (roomBookings.length === 0) return null;
                
                return (
                  <div key={room.id}>
                    <h4 className="font-semibold text-sm text-[#2E375B]/70 mb-2">{room.display_name}</h4>
                    <div className="space-y-2">
                      {roomBookings.map(booking => {
                        const canCancel = canCancelBooking(booking);
                        return (
                          <div 
                            key={booking.id} 
                            className="flex items-center justify-between p-3 bg-[#2E375B]/5 rounded-lg"
                          >
                            <div className="flex items-center gap-4">
                              <div className="text-center">
                                <p className="font-mono font-semibold text-[#2E375B]">
                                  {booking.start_time} - {booking.end_time}
                                </p>
                                <p className="text-xs text-[#2E375B]/60">{booking.duration_minutes} min</p>
                              </div>
                              <div>
                                <p className="font-medium text-[#2E375B]">{booking.member_name}</p>
                                <p className="text-xs text-[#2E375B]/60">{booking.company_name}</p>
                                {booking.purpose && (
                                  <p className="text-xs text-[#2E375B]/70 mt-1">{booking.purpose}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {booking.credits_used > 0 && (
                                <Badge className="bg-[#2E375B]/10 text-[#2E375B]">
                                  {booking.credits_used} min credits
                                </Badge>
                              )}
                              {booking.billable_amount > 0 && (
                                <Badge className="bg-[#FFA14A]/10 text-[#FFA14A]">
                                  Rs. {booking.billable_amount}
                                </Badge>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className={`h-8 w-8 ${canCancel ? 'text-red-500 hover:text-red-700' : 'text-[#2E375B]/20 cursor-not-allowed'}`}
                                onClick={() => handleCancelBooking(booking)}
                                disabled={!canCancel}
                                title={canCancel ? 'Cancel booking' : `Can only cancel ${MIN_CANCEL_DAYS}+ days before`}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
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
            <DialogTitle className="font-[Manrope] text-[#2E375B]">Book {selectedRoom?.display_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-[#2E375B]/5 p-3 rounded-lg">
              <p className="text-sm font-medium text-[#2E375B]">{formatDate(selectedDate)}</p>
              <p className="text-lg font-semibold text-[#2E375B]">
                {formData.start_time} - {formData.end_time}
              </p>
              <p className="text-xs text-[#2E375B]/60 mt-1">
                {selectedSlots.length} slot{selectedSlots.length > 1 ? 's' : ''} • {totalMinutes} minutes total
              </p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-[#2E375B]">Member *</Label>
              <Select value={formData.member_id} onValueChange={(value) => setFormData({ ...formData, member_id: value })}>
                <SelectTrigger className="border-[#2E375B]/20">
                  <SelectValue placeholder="Select member" />
                </SelectTrigger>
                <SelectContent>
                  {members.map(member => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name} ({member.company_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedMember && (
              <div className="bg-[#2E375B]/5 p-3 rounded-lg text-sm">
                <p className="font-medium text-[#2E375B]">Credits Available</p>
                <p className="text-[#2E375B]/70">
                  {selectedMember.meeting_room_credits - selectedMember.credits_used} min remaining
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-[#2E375B]">Purpose</Label>
              <Input
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                placeholder="Meeting purpose (optional)"
                className="border-[#2E375B]/20"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[#2E375B]">Number of Attendees</Label>
              <Input
                type="number"
                value={formData.attendees}
                onChange={(e) => setFormData({ ...formData, attendees: e.target.value })}
                placeholder={`Max: ${selectedRoom?.capacity}`}
                max={selectedRoom?.capacity}
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
