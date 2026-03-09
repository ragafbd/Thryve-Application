import { useEffect, useState } from "react";
import { Calendar, Clock, Users, Building2, Plus, X, ChevronLeft, ChevronRight } from "lucide-react";
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

export default function Bookings() {
  const [rooms, setRooms] = useState([]);
  const [members, setMembers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    room_id: "",
    member_id: "",
    start_time: "",
    end_time: "",
    purpose: "",
    attendees: ""
  });

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
    try {
      const response = await axios.get(`${API}/management/bookings/availability?room_id=${selectedRoom.id}&date=${selectedDate}`);
      setSlots(response.data.slots);
    } catch (error) {
      console.error("Failed to fetch availability");
    }
  };

  useEffect(() => {
    fetchRooms();
    fetchMembers();
  }, []);

  useEffect(() => {
    fetchBookings();
    fetchAvailability();
  }, [selectedDate, selectedRoom]);

  const changeDate = (days) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const handleSlotClick = (slot) => {
    if (!slot.is_available) return;
    
    setFormData({
      room_id: selectedRoom.id,
      member_id: "",
      start_time: slot.start_time,
      end_time: slot.end_time,
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
      fetchBookings();
      fetchAvailability();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create booking");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm("Are you sure you want to cancel this booking?")) return;
    
    try {
      await axios.delete(`${API}/management/bookings/${bookingId}`);
      toast.success("Booking cancelled");
      fetchBookings();
      fetchAvailability();
    } catch (error) {
      toast.error("Failed to cancel booking");
    }
  };

  const getRoomBookings = (roomId) => {
    return bookings.filter(b => b.room_id === roomId);
  };

  const selectedMember = members.find(m => m.id === formData.member_id);

  return (
    <div className="space-y-6 animate-fade-in" data-testid="bookings-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight font-[Manrope]">
            Meeting Room Bookings
          </h1>
          <p className="text-slate-600 mt-1">
            Book conference and meeting rooms
          </p>
        </div>
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

      {/* Room Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {rooms.map(room => (
          <Button
            key={room.id}
            variant={selectedRoom?.id === room.id ? "default" : "outline"}
            className={selectedRoom?.id === room.id ? "bg-[#2E375B] hover:bg-[#232B47]" : ""}
            onClick={() => setSelectedRoom(room)}
          >
            <Building2 className="w-4 h-4 mr-2" />
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
              <CardTitle className="text-lg font-semibold font-[Manrope]">
                {selectedRoom.display_name}
              </CardTitle>
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
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span>Rs. {selectedRoom.hourly_rate}/hour</span>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs text-slate-500">
                  Click on an available slot to book
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Time Slots */}
          <Card className="border border-slate-200 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg font-semibold font-[Manrope] flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#2E375B]" />
                Available Slots
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
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

      {/* Today's Bookings */}
      <Card className="border border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold font-[Manrope]">
            Bookings for {formatDate(selectedDate)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-slate-500">Loading...</p>
          ) : bookings.length === 0 ? (
            <p className="text-slate-500">No bookings for this date</p>
          ) : (
            <div className="space-y-4">
              {rooms.map(room => {
                const roomBookings = getRoomBookings(room.id);
                if (roomBookings.length === 0) return null;
                
                return (
                  <div key={room.id}>
                    <h4 className="font-semibold text-sm text-slate-700 mb-2">{room.display_name}</h4>
                    <div className="space-y-2">
                      {roomBookings.map(booking => (
                        <div 
                          key={booking.id} 
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                        >
                          <div className="flex items-center gap-4">
                            <div className="text-center">
                              <p className="font-mono font-semibold text-[#2E375B]">
                                {booking.start_time} - {booking.end_time}
                              </p>
                              <p className="text-xs text-slate-500">{booking.duration_minutes} min</p>
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{booking.member_name}</p>
                              <p className="text-xs text-slate-500">{booking.company_name}</p>
                              {booking.purpose && (
                                <p className="text-xs text-slate-600 mt-1">{booking.purpose}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {booking.credits_used > 0 && (
                              <Badge className="bg-blue-100 text-blue-700">
                                {booking.credits_used} min credits
                              </Badge>
                            )}
                            {booking.billable_amount > 0 && (
                              <Badge className="bg-amber-100 text-amber-700">
                                Rs. {booking.billable_amount}
                              </Badge>
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
            <DialogTitle className="font-[Manrope]">Book {selectedRoom?.display_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-sm font-medium">{formatDate(selectedDate)}</p>
              <p className="text-lg font-semibold text-[#2E375B]">
                {formData.start_time} - {formData.end_time}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Member *</Label>
              <Select value={formData.member_id} onValueChange={(value) => setFormData({ ...formData, member_id: value })}>
                <SelectTrigger>
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
              <div className="bg-blue-50 p-3 rounded-lg text-sm">
                <p className="font-medium">Credits Available</p>
                <p className="text-blue-700">
                  {selectedMember.meeting_room_credits - selectedMember.credits_used} min remaining
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Purpose</Label>
              <Input
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                placeholder="Meeting purpose (optional)"
              />
            </div>

            <div className="space-y-2">
              <Label>Number of Attendees</Label>
              <Input
                type="number"
                value={formData.attendees}
                onChange={(e) => setFormData({ ...formData, attendees: e.target.value })}
                placeholder={`Max: ${selectedRoom?.capacity}`}
                max={selectedRoom?.capacity}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
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
