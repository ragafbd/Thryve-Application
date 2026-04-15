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
    name: str  # e.g., "Cabin - 4 Seater", "Open Desk", "Hot Desk", "Day Pass"
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
    hourly_rate: float  # Rate per hour (Rs. 1000 for CR, Rs. 500 for MR)
    slot_duration: int  # Slot duration in minutes (60 for CR, 30 for MR)
    room_type: str = "meeting_room"  # "conference_room" or "meeting_room"
    credit_cost_per_slot: int = 5  # Credits per slot (20 for CR, 5 for MR)
    is_active: bool = True
    # Booking disabled from this date onwards (None = bookings enabled)
    disabled_from: Optional[str] = None  # Format: YYYY-MM-DD
    disabled_reason: Optional[str] = None  # Optional reason for disabling
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class MeetingRoomCreate(BaseModel):
    name: str
    display_name: str
    capacity: int
    hourly_rate: float
    slot_duration: int
    room_type: str = "meeting_room"
    credit_cost_per_slot: int = 5

# ==================== COMPANY SUBSCRIPTIONS ====================

class CompanyCreate(BaseModel):
    """Create a new company subscription"""
    # Company Details
    company_name: str
    company_address: str = ""
    company_gstin: Optional[str] = ""
    company_pan: Optional[str] = ""
    company_email: Optional[str] = ""
    company_website: Optional[str] = ""
    
    # Authorised Signatory Details
    signatory_name: Optional[str] = ""
    signatory_father_name: Optional[str] = ""  # NEW: For LLA
    signatory_designation: Optional[str] = ""  # NEW: For LLA
    signatory_aadhar: Optional[str] = ""
    signatory_pan: Optional[str] = ""
    signatory_phone: Optional[str] = ""
    signatory_email: Optional[str] = ""
    
    # Subscription Details
    plan_type_id: str  # Type of plan (cabin, open desk, etc.)
    space_description: Optional[str] = ""  # NEW: e.g., "Six Seater Cabin", "Open Seat"
    total_seats: int  # Number of seats subscribed
    rate_per_seat: float  # Custom rate per seat (admin-set)
    discount_percent: float = 0  # Any discount
    meeting_room_credits: int = 30  # Meeting room credits per seat (default 30 credits/seat/month)
    
    # LLA Financial Details
    security_deposit: Optional[float] = 0  # NEW: For LLA
    setup_charges: Optional[str] = ""  # NEW: For LLA (can be "Not applicable")
    lock_in_months: Optional[int] = 11  # NEW: For LLA
    
    # Internet/Bandwidth Details
    isp_provider: Optional[str] = ""
    bandwidth_speed: Optional[str] = ""
    isp_account_id: Optional[str] = ""
    
    # Dates
    start_date: str
    end_date: Optional[str] = ""  # NEW: For LLA
    notes: Optional[str] = ""

class Company(BaseModel):
    """Company subscription at Thryve Coworking"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Company Details
    company_name: str
    company_address: str = ""
    company_gstin: str = ""
    company_pan: str = ""
    company_email: str = ""
    company_website: str = ""
    
    # Authorised Signatory Details
    signatory_name: str = ""
    signatory_father_name: str = ""  # NEW: For LLA (e.g., "S/o Sh. Satish K. Kukreja")
    signatory_designation: str = ""  # NEW: For LLA (e.g., "Partner", "Director")
    signatory_aadhar: str = ""
    signatory_pan: str = ""
    signatory_phone: str = ""
    signatory_email: str = ""
    
    # Subscription Details
    plan_type_id: str
    plan_name: str = ""  # Denormalized for easy access
    space_description: str = ""  # NEW: e.g., "Six Seater Cabin", "Open Seat"
    total_seats: int  # Number of seats subscribed
    seats_occupied: int = 0  # Number of members added
    rate_per_seat: float  # Custom rate per seat
    discount_percent: float = 0
    total_rate: float = 0  # Calculated: total_seats * rate_per_seat * (1 - discount/100)
    
    # LLA Financial Details
    security_deposit: float = 0  # NEW: For LLA
    setup_charges: str = ""  # NEW: For LLA (can be "Not applicable")
    lock_in_months: int = 11  # NEW: For LLA (default 11 months)
    
    # Meeting Room Credits (CREDIT-BASED SYSTEM)
    # 1 Credit = Rs. 50
    # Credits per seat = 30 credits/month
    # Conference Room: 20 credits/hour (1-hour slots only)
    # Meeting Room: 5 credits/30-min slot
    meeting_room_credits: int = 30  # Credits per seat per month (default 30)
    total_credits: int = 0  # Total credits = total_seats × meeting_room_credits
    credits_used: int = 0  # Total credits used by all members
    remaining_credits: int = 0  # Total credits - credits_used
    credits_reset_date: str = ""
    
    # Internet/Bandwidth Details
    isp_provider: str = ""
    bandwidth_speed: str = ""
    isp_account_id: str = ""
    
    # Status
    start_date: str
    end_date: Optional[str] = None
    status: str = "active"  # active, inactive, suspended, terminated
    termination_reason: Optional[str] = None
    has_outstanding_dues: bool = False
    
    # Metadata
    notes: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    terminated_at: Optional[str] = None
    created_by: Optional[str] = None

class CompanyUpdate(BaseModel):
    """Update company subscription"""
    company_name: Optional[str] = None
    company_address: Optional[str] = None
    company_gstin: Optional[str] = None
    company_pan: Optional[str] = None
    company_email: Optional[str] = None
    company_website: Optional[str] = None
    signatory_name: Optional[str] = None
    signatory_father_name: Optional[str] = None  # NEW
    signatory_designation: Optional[str] = None  # NEW
    signatory_aadhar: Optional[str] = None
    signatory_pan: Optional[str] = None
    signatory_phone: Optional[str] = None
    signatory_email: Optional[str] = None
    plan_type_id: Optional[str] = None
    space_description: Optional[str] = None  # NEW
    total_seats: Optional[int] = None
    rate_per_seat: Optional[float] = None
    discount_percent: Optional[float] = None
    meeting_room_credits: Optional[int] = None
    security_deposit: Optional[float] = None  # NEW
    setup_charges: Optional[str] = None  # NEW
    lock_in_months: Optional[int] = None  # NEW
    isp_provider: Optional[str] = None
    bandwidth_speed: Optional[str] = None
    isp_account_id: Optional[str] = None
    start_date: Optional[str] = None  # NEW
    end_date: Optional[str] = None  # NEW
    status: Optional[str] = None
    notes: Optional[str] = None

# ==================== MEMBERS (Under Company) ====================

class MemberCreate(BaseModel):
    """Create a new member under a company"""
    company_id: str  # Required: must belong to a company
    
    # Person Details
    name: str
    email: str
    phone: str
    aadhar_number: Optional[str] = ""
    pan_number: Optional[str] = ""
    date_of_birth: Optional[str] = None  # Birthday field for member
    
    # Seat Assignment
    seat_number: Optional[str] = None  # e.g., "A-12", "Cabin-3"
    is_primary_contact: bool = False  # Primary contact for the company
    notes: Optional[str] = ""
    
    # Company Details
    company_name: str
    company_address: Optional[str] = ""
    company_gstin: Optional[str] = ""  # Company GSTIN
    company_pan: Optional[str] = ""  # Company PAN
    
    # Legacy field mapping
    gstin: Optional[str] = ""  # Kept for backward compatibility
    
    # Plan Details
    plan_type_id: str
    seat_number: Optional[str] = None  # e.g., "A-12", "Cabin-3"
    custom_rate: Optional[float] = None  # Override default plan rate
    discount_percent: Optional[float] = 0  # Discount on rate
    meeting_room_credits: Optional[int] = None  # Override plan's default credits
    start_date: str  # Membership start date
    notes: Optional[str] = ""

class Member(BaseModel):
    """Member/Person under a Company subscription"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Company Reference (optional for backward compatibility)
    company_id: Optional[str] = None  # Reference to Company
    company_name: str = ""  # Denormalized for easy access
    
    # Person Details
    name: str
    email: str
    phone: str
    aadhar_number: str = ""
    pan_number: str = ""
    date_of_birth: Optional[str] = None  # Birthday field for member
    
    # Seat Assignment
    seat_number: Optional[str] = None
    is_primary_contact: bool = False
    
    # Status
    status: str = "active"  # active, inactive
    notes: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    created_by: Optional[str] = None
    
    # Legacy fields for backward compatibility
    plan_type_id: str = ""
    plan_name: str = ""
    company_address: str = ""
    company_gstin: str = ""
    company_pan: str = ""
    gstin: str = ""
    custom_rate: Optional[float] = None
    discount_percent: float = 0
    final_rate: float = 0
    meeting_room_credits: int = 0
    credits_used: int = 0
    credits_reset_date: str = ""
    start_date: str = ""
    end_date: Optional[str] = None
    termination_reason: Optional[str] = None
    has_outstanding_dues: bool = False
    terminated_at: Optional[str] = None
    terminated_by: Optional[str] = None

class MemberUpdate(BaseModel):
    """Update member details"""
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    aadhar_number: Optional[str] = None
    pan_number: Optional[str] = None
    date_of_birth: Optional[str] = None  # Birthday field
    seat_number: Optional[str] = None
    is_primary_contact: Optional[bool] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class CompanyMemberCreate(BaseModel):
    """Simple model for adding a member to an existing company"""
    name: str
    email: str
    phone: str
    aadhar_number: Optional[str] = ""
    pan_number: Optional[str] = ""
    date_of_birth: Optional[str] = None  # Birthday field
    seat_number: Optional[str] = None
    is_primary_contact: bool = False
    notes: Optional[str] = ""
    replace_primary: bool = False  # Flag to replace existing primary contact


class CompanyMemberUpdate(BaseModel):
    """Update member details within a company"""
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    aadhar_number: Optional[str] = None
    pan_number: Optional[str] = None
    date_of_birth: Optional[str] = None
    seat_number: Optional[str] = None
    is_primary_contact: Optional[bool] = None
    notes: Optional[str] = None
    replace_primary: bool = False  # Flag to replace existing primary contact

class CompanyTerminate(BaseModel):
    """Terminate a company subscription"""
    end_date: str  # Last working day
    termination_reason: str  # Reason for termination
    has_outstanding_dues: bool = False  # Flag for unpaid invoices

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
    member_id: Optional[str] = None  # Optional for guest bookings
    date: str  # YYYY-MM-DD
    start_time: str  # HH:MM (24h format)
    end_time: str  # HH:MM (24h format)
    purpose: Optional[str] = ""
    attendees: Optional[int] = None
    
    # Guest booking fields
    is_guest: bool = False
    guest_name: Optional[str] = None
    guest_phone: Optional[str] = None
    guest_email: Optional[str] = None
    guest_company: Optional[str] = None
    guest_id_type: Optional[str] = None  # aadhar, pan, driving_license, passport
    guest_id_number: Optional[str] = None
    payment_amount: Optional[float] = 0
    payment_status: Optional[str] = "pending"  # paid, pending

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
    room_type: str = "meeting_room"  # "conference_room" or "meeting_room"
    member_id: Optional[str] = None  # Optional for guest bookings
    member_name: str = ""
    company_id: Optional[str] = None  # Reference to company for credit deduction
    company_name: str = ""
    date: str
    start_time: str
    end_time: str
    duration_minutes: int = 0
    num_slots: int = 1  # Number of slots booked
    purpose: str = ""
    attendees: Optional[int] = None
    
    # Credit-based billing (1 Credit = Rs. 50)
    credit_cost_per_slot: int = 5  # Credits per slot (20 for CR, 5 for MR)
    credits_required: int = 0  # Total credits required for this booking
    credits_used: int = 0  # Credits deducted from company balance
    billable_credits: int = 0  # Credits that exceeded company balance
    billable_amount: float = 0  # Amount to bill = billable_credits × Rs. 50
    
    status: str = "confirmed"  # confirmed, cancelled, completed
    
    # Cancellation tracking
    is_late_cancellation: bool = False
    cancelled_at: Optional[str] = None
    
    # Guest booking fields
    is_guest: bool = False
    guest_name: Optional[str] = None
    guest_phone: Optional[str] = None
    guest_email: Optional[str] = None
    guest_company: Optional[str] = None
    guest_id_type: Optional[str] = None
    guest_id_number: Optional[str] = None
    payment_amount: float = 0
    payment_status: str = "pending"
    
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
