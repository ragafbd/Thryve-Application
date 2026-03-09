"""
Thryve Coworking Management System Models
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone
import uuid

# ==================== PLAN/SERVICE TYPES ====================

class PlanType(BaseModel):
    """Defines available workspace plans"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # e.g., "Private Cabin - 4 Seater", "Open Desk", "Hot Desk", "Day Pass"
    category: str  # cabin, open_desk, hot_desk, day_pass
    capacity: Optional[int] = None  # For cabins: 4, 6, 1 (boss cabin)
    default_rate: float  # Default monthly rate
    meeting_room_credits: int = 0  # Monthly meeting room credits (in minutes)
    is_active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PlanTypeCreate(BaseModel):
    name: str
    category: str
    capacity: Optional[int] = None
    default_rate: float
    meeting_room_credits: int = 0

# ==================== MEETING ROOMS ====================

class MeetingRoom(BaseModel):
    """Meeting room configuration"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # e.g., "CR-1", "MR-1", "MR-2"
    display_name: str  # e.g., "Conference Room 1", "Meeting Room 1"
    capacity: int  # Number of seats
    hourly_rate: float  # Rate per hour
    slot_duration: int  # Slot duration in minutes (60 for hourly, 30 for half-hourly)
    is_active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class MeetingRoomCreate(BaseModel):
    name: str
    display_name: str
    capacity: int
    hourly_rate: float
    slot_duration: int

# ==================== MEMBERS ====================

class MemberCreate(BaseModel):
    """Create a new member"""
    name: str
    email: str
    phone: str
    company_name: str
    company_address: Optional[str] = ""
    gstin: Optional[str] = ""
    plan_type_id: str
    seat_number: Optional[str] = None  # e.g., "A-12", "Cabin-3"
    custom_rate: Optional[float] = None  # Override default plan rate
    discount_percent: Optional[float] = 0  # Discount on rate
    meeting_room_credits: Optional[int] = None  # Override plan's default credits
    start_date: str  # Membership start date
    notes: Optional[str] = ""

class Member(BaseModel):
    """Member/Client at Thryve Coworking"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    phone: str
    company_name: str
    company_address: str = ""
    gstin: str = ""
    plan_type_id: str
    plan_name: str = ""  # Denormalized for easy access
    seat_number: Optional[str] = None
    custom_rate: Optional[float] = None
    discount_percent: float = 0
    final_rate: float = 0  # Calculated: (custom_rate or default_rate) * (1 - discount/100)
    meeting_room_credits: int = 0  # Monthly credits in minutes
    credits_used: int = 0  # Credits used this month
    credits_reset_date: str = ""  # When credits were last reset
    start_date: str
    end_date: Optional[str] = None  # Termination date
    status: str = "active"  # active, inactive, suspended, terminated
    termination_reason: Optional[str] = None  # Reason for leaving
    has_outstanding_dues: bool = False  # Flag for unpaid invoices
    notes: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    terminated_at: Optional[str] = None  # When termination was processed
    terminated_by: Optional[str] = None  # Who processed termination
    created_by: Optional[str] = None

class MemberUpdate(BaseModel):
    """Update member details"""
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None
    company_address: Optional[str] = None
    gstin: Optional[str] = None
    plan_type_id: Optional[str] = None
    seat_number: Optional[str] = None
    custom_rate: Optional[float] = None
    discount_percent: Optional[float] = None
    meeting_room_credits: Optional[int] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class MemberTerminate(BaseModel):
    """Terminate a member"""
    end_date: str  # Last working day
    termination_reason: str  # Reason for termination
    has_outstanding_dues: bool = False  # Flag for unpaid invoices

class BulkTerminate(BaseModel):
    """Terminate all members from a company"""
    company_name: str
    end_date: str
    termination_reason: str
    has_outstanding_dues: bool = False

# ==================== MEETING ROOM BOOKINGS ====================

class BookingCreate(BaseModel):
    """Create a meeting room booking (admin)"""
    room_id: str
    member_id: str
    date: str  # YYYY-MM-DD
    start_time: str  # HH:MM (24h format)
    end_time: str  # HH:MM (24h format)
    purpose: Optional[str] = ""
    attendees: Optional[int] = None

class MemberBookingCreate(BaseModel):
    """Create a meeting room booking (member portal - no member_id needed)"""
    room_id: str
    date: str  # YYYY-MM-DD
    start_time: str  # HH:MM (24h format)
    end_time: str  # HH:MM (24h format)
    purpose: Optional[str] = ""
    attendees: Optional[int] = None

class Booking(BaseModel):
    """Meeting room booking"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room_id: str
    room_name: str = ""
    member_id: str
    member_name: str = ""
    company_name: str = ""
    date: str
    start_time: str
    end_time: str
    duration_minutes: int = 0
    purpose: str = ""
    attendees: Optional[int] = None
    credits_used: int = 0  # Credits deducted for this booking
    billable_amount: float = 0  # Amount to bill (if credits exhausted)
    status: str = "confirmed"  # confirmed, cancelled, completed
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    created_by: Optional[str] = None

# ==================== SUPPORT TICKETS ====================

class TicketCreate(BaseModel):
    """Create a support ticket"""
    title: str
    description: str
    category: str  # maintenance, it_support, admin, facilities, other
    priority: str = "medium"  # low, medium, high, urgent
    member_id: Optional[str] = None

class Ticket(BaseModel):
    """Support ticket"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ticket_number: str = ""  # THR-TKT-XXXX
    title: str
    description: str
    category: str
    priority: str = "medium"
    status: str = "open"  # open, in_progress, resolved, closed
    member_id: Optional[str] = None
    member_name: str = ""
    assigned_to: Optional[str] = None
    assigned_name: str = ""
    resolution: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    resolved_at: Optional[str] = None
    created_by: Optional[str] = None

class TicketUpdate(BaseModel):
    """Update ticket"""
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[str] = None
    resolution: Optional[str] = None

# ==================== ANNOUNCEMENTS ====================

class AnnouncementCreate(BaseModel):
    """Create an announcement"""
    title: str
    content: str
    category: str = "general"  # general, event, maintenance, important
    is_pinned: bool = False
    expires_at: Optional[str] = None  # Optional expiry date

class Announcement(BaseModel):
    """Community announcement"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    content: str
    category: str = "general"
    is_pinned: bool = False
    is_active: bool = True
    expires_at: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    created_by: Optional[str] = None
    author_name: str = ""


# ==================== MEMBER PORTAL AUTH ====================

class MemberAuth(BaseModel):
    """Member portal authentication record"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    member_id: str  # Links to Member record
    email: str
    password_hash: str
    is_active: bool = True
    last_login: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class MemberRegister(BaseModel):
    """Member registration request"""
    email: str
    password: str

class MemberLogin(BaseModel):
    """Member login request"""
    email: str
    password: str

class MemberChangePassword(BaseModel):
    """Member change password request"""
    current_password: str
    new_password: str
