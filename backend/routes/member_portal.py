"""
Thryve Coworking - Member Portal Routes
Secure endpoints for members to access their own data
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
import os

# Import models
from models.management import (
    MemberAuth, MemberRegister, MemberLogin, MemberChangePassword,
    Ticket, TicketCreate, Booking, BookingCreate, MemberBookingCreate
)

# Router
router = APIRouter(prefix="/api/member", tags=["Member Portal"])

# Security
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Settings - same secret as main app for consistency
SECRET_KEY = os.environ.get("JWT_SECRET", "thryve-coworking-secret-key-change-in-production")  # Set JWT_SECRET in .env for production
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7  # Longer expiry for member convenience

# Database reference - will be set by init
db = None

def init_router(database):
    """Initialize router with database"""
    global db
    db = database

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_member_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "member"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_member(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT token and return current member"""
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=401,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        member_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if member_id is None or token_type != "member":
            raise credentials_exception
            
    except JWTError:
        raise credentials_exception
    
    # Get member auth record
    member_auth = await db.member_auth.find_one({"member_id": member_id}, {"_id": 0})
    if member_auth is None or not member_auth.get("is_active"):
        raise credentials_exception
    
    # Get full member details
    member = await db.members.find_one({"id": member_id}, {"_id": 0})
    if member is None:
        raise credentials_exception
    
    return member

# ==================== AUTHENTICATION ====================

@router.post("/register")
async def register_member(data: MemberRegister):
    """
    Register for member portal access.
    Email must match an existing member record.
    """
    # Check if member exists with this email
    member = await db.members.find_one({"email": data.email.lower()}, {"_id": 0})
    if not member:
        raise HTTPException(
            status_code=404, 
            detail="No member found with this email. Please contact admin if you're a Thryve member."
        )
    
    # Check if already registered
    existing_auth = await db.member_auth.find_one({"email": data.email.lower()})
    if existing_auth:
        raise HTTPException(status_code=400, detail="Account already exists. Please login.")
    
    # Check member status
    if member.get("status") == "terminated":
        raise HTTPException(status_code=403, detail="Your membership has been terminated. Please contact admin.")
    
    # Validate password
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Create member auth record
    member_auth = MemberAuth(
        member_id=member["id"],
        email=data.email.lower(),
        password_hash=get_password_hash(data.password)
    )
    
    await db.member_auth.insert_one(member_auth.model_dump())
    
    return {
        "message": "Registration successful! You can now login.",
        "member_name": member["name"]
    }

@router.post("/login")
async def login_member(data: MemberLogin):
    """Login to member portal"""
    # Find auth record
    member_auth = await db.member_auth.find_one({"email": data.email.lower()}, {"_id": 0})
    if not member_auth:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Verify password
    if not verify_password(data.password, member_auth["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Check if active
    if not member_auth.get("is_active"):
        raise HTTPException(status_code=403, detail="Your account has been disabled. Please contact admin.")
    
    # Get member details
    member = await db.members.find_one({"id": member_auth["member_id"]}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member record not found")
    
    if member.get("status") == "terminated":
        raise HTTPException(status_code=403, detail="Your membership has been terminated.")
    
    # Update last login
    await db.member_auth.update_one(
        {"email": data.email.lower()},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Create token
    token = create_member_token({"sub": member["id"]})
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "member": {
            "id": member["id"],
            "name": member["name"],
            "email": member["email"],
            "company_name": member["company_name"],
            "plan_name": member.get("plan_name", ""),
            "status": member["status"]
        }
    }

@router.get("/me")
async def get_member_profile(current_member: dict = Depends(get_current_member)):
    """Get current member's profile"""
    # Get company credits
    company_id = current_member.get("company_id")
    company_credits = {
        "total_credits": 0,
        "remaining_credits": 0,
        "credits_used": 0
    }
    
    if company_id:
        company = await db.companies.find_one({"id": company_id}, {"_id": 0})
        if company:
            total_credits = company.get("total_credits", company.get("total_seats", 0) * company.get("meeting_room_credits", 0))
            credits_used = company.get("credits_used", 0)
            remaining_credits = company.get("remaining_credits", total_credits - credits_used)
            company_credits = {
                "total_credits": total_credits,
                "remaining_credits": remaining_credits,
                "credits_used": credits_used
            }
    
    return {
        "id": current_member["id"],
        "name": current_member["name"],
        "email": current_member["email"],
        "phone": current_member["phone"],
        "company_name": current_member["company_name"],
        "company_id": company_id,
        "plan_name": current_member.get("plan_name", ""),
        "seat_number": current_member.get("seat_number"),
        "meeting_room_credits": company_credits["total_credits"],
        "credits_used": company_credits["credits_used"],
        "credits_remaining": company_credits["remaining_credits"],
        "start_date": current_member.get("start_date"),
        "status": current_member["status"]
    }


@router.get("/company-credits")
async def get_member_company_credits(current_member: dict = Depends(get_current_member)):
    """Get the company's meeting room credits for the member's company"""
    company_id = current_member.get("company_id")
    
    if not company_id:
        return {
            "company_name": current_member.get("company_name"),
            "total_credits": 0,
            "remaining_credits": 0,
            "credits_used": 0,
            "total_seats": 0,
            "credits_per_seat": 0
        }
    
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        return {
            "company_name": current_member.get("company_name"),
            "total_credits": 0,
            "remaining_credits": 0,
            "credits_used": 0,
            "total_seats": 0,
            "credits_per_seat": 0
        }
    
    total_seats = company.get("total_seats", 0)
    credits_per_seat = company.get("meeting_room_credits", 0)
    total_credits = company.get("total_credits", total_seats * credits_per_seat)
    credits_used = company.get("credits_used", 0)
    remaining_credits = company.get("remaining_credits", total_credits - credits_used)
    
    # Get member's own booking credits usage
    member_bookings = await db.bookings.find(
        {"member_id": current_member["id"], "credits_used": {"$gt": 0}},
        {"_id": 0, "credits_used": 1}
    ).to_list(500)
    member_credits_used = sum(b.get("credits_used", 0) for b in member_bookings)
    
    return {
        "company_name": company.get("company_name"),
        "total_credits": total_credits,
        "remaining_credits": remaining_credits,
        "credits_used": credits_used,
        "total_seats": total_seats,
        "credits_per_seat": credits_per_seat,
        "member_credits_used": member_credits_used
    }

@router.post("/change-password")
async def change_member_password(data: MemberChangePassword, current_member: dict = Depends(get_current_member)):
    """Change member password"""
    # Get auth record
    member_auth = await db.member_auth.find_one({"member_id": current_member["id"]}, {"_id": 0})
    if not member_auth:
        raise HTTPException(status_code=404, detail="Auth record not found")
    
    # Verify current password
    if not verify_password(data.current_password, member_auth["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Validate new password
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    # Update password
    await db.member_auth.update_one(
        {"member_id": current_member["id"]},
        {"$set": {"password_hash": get_password_hash(data.new_password)}}
    )
    
    return {"message": "Password changed successfully"}

# ==================== MEMBER'S INVOICES ====================

@router.get("/invoices")
async def get_member_invoices(current_member: dict = Depends(get_current_member)):
    """Get all invoices for the current member's company"""
    # Find invoices by company name or member ID
    invoices = await db.invoices.find(
        {
            "$or": [
                {"client.company_name": current_member["company_name"]},
                {"member_id": current_member["id"]}
            ]
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    
    return invoices

@router.get("/invoices/{invoice_id}")
async def get_member_invoice(invoice_id: str, current_member: dict = Depends(get_current_member)):
    """Get a specific invoice (only if it belongs to member)"""
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Verify ownership
    if invoice.get("client", {}).get("company_name") != current_member["company_name"] and \
       invoice.get("member_id") != current_member["id"]:
        raise HTTPException(status_code=403, detail="You don't have access to this invoice")
    
    return invoice

# ==================== MEMBER'S PENDING CHARGES ====================

@router.get("/pending-charges")
async def get_member_pending_charges(current_member: dict = Depends(get_current_member)):
    """Get pending meeting room charges for the current member's company"""
    # Get bookings with billable_amount > 0 that aren't paid
    pending_bookings = await db.bookings.find(
        {
            "company_name": current_member["company_name"],
            "billable_amount": {"$gt": 0},
            "payment_status": {"$nin": ["paid", "completed"]},
            "$or": [
                {"status": "confirmed"},
                {"status": "cancelled", "cancellation_charge": True}
            ]
        },
        {"_id": 0}
    ).to_list(100)
    
    charges = []
    total_pending = 0
    
    for booking in pending_bookings:
        charges.append({
            "booking_id": booking.get("id"),
            "member_name": booking.get("member_name"),
            "date": booking.get("date"),
            "room_name": booking.get("room_name"),
            "start_time": booking.get("start_time"),
            "end_time": booking.get("end_time"),
            "amount": booking.get("billable_amount", 0),
            "status": "Late Cancellation" if booking.get("status") == "cancelled" else "Pending"
        })
        total_pending += booking.get("billable_amount", 0)
    
    return charges

# ==================== MEMBER'S SUPPORT TICKETS ====================

@router.get("/tickets")
async def get_member_tickets(current_member: dict = Depends(get_current_member)):
    """Get all support tickets raised by this member"""
    tickets = await db.tickets.find(
        {"member_id": current_member["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return tickets

@router.post("/tickets")
async def create_member_ticket(ticket_data: TicketCreate, current_member: dict = Depends(get_current_member)):
    """Create a new support ticket"""
    # Generate ticket number
    latest = await db.tickets.find_one({}, {"ticket_number": 1}, sort=[("created_at", -1)])
    if latest and latest.get("ticket_number"):
        try:
            num = int(latest["ticket_number"].split("-")[-1])
            ticket_number = f"THR-TKT-{num + 1:04d}"
        except:
            ticket_number = "THR-TKT-0001"
    else:
        ticket_number = "THR-TKT-0001"
    
    ticket = {
        "id": str(__import__('uuid').uuid4()),
        "ticket_number": ticket_number,
        "title": ticket_data.title,
        "description": ticket_data.description,
        "category": ticket_data.category,
        "priority": ticket_data.priority,
        "status": "open",
        "member_id": current_member["id"],
        "member_name": current_member["name"],
        "assigned_to": None,
        "assigned_name": "",
        "resolution": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "resolved_at": None,
        "created_by": current_member["id"]
    }
    
    await db.tickets.insert_one(ticket)
    ticket.pop("_id", None)
    
    return ticket

@router.get("/tickets/{ticket_id}")
async def get_member_ticket(ticket_id: str, current_member: dict = Depends(get_current_member)):
    """Get a specific ticket (only if it belongs to member)"""
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    if ticket.get("member_id") != current_member["id"]:
        raise HTTPException(status_code=403, detail="You don't have access to this ticket")
    
    return ticket

# ==================== MEMBER'S ROOM BOOKINGS ====================

@router.get("/bookings")
async def get_member_bookings(
    current_member: dict = Depends(get_current_member),
    upcoming_only: bool = False
):
    """Get member's room bookings"""
    query = {"member_id": current_member["id"]}
    
    if upcoming_only:
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        query["date"] = {"$gte": today}
        query["status"] = {"$ne": "cancelled"}
    
    bookings = await db.bookings.find(query, {"_id": 0}).sort([("date", -1), ("start_time", -1)]).to_list(100)
    return bookings

@router.post("/bookings")
async def create_member_booking(booking_data: MemberBookingCreate, current_member: dict = Depends(get_current_member)):
    """Create a room booking for the member using CREDIT-BASED system"""
    # Credit system: 1 Credit = Rs. 50
    # Conference Room: 20 credits/hour (1-hour slots)
    # Meeting Room: 5 credits/30-min slot
    CREDIT_VALUE = 50  # Rs. 50 per credit
    
    # Validate booking date
    try:
        booking_date = datetime.strptime(booking_data.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    today = datetime.now(timezone.utc).date()
    max_date = today + timedelta(days=10)
    
    if booking_date < today:
        raise HTTPException(status_code=400, detail="Cannot book in the past")
    if booking_date > max_date:
        raise HTTPException(status_code=400, detail="Bookings can only be made up to 10 days in advance")
    
    # Check if date is a Sunday
    if booking_date.weekday() == 6:
        raise HTTPException(status_code=400, detail="Bookings are not available on Sundays")
    
    # Check if date is a public holiday
    holiday = await db.public_holidays.find_one({"date": booking_data.date, "is_active": True}, {"_id": 0})
    if holiday:
        raise HTTPException(status_code=400, detail=f"Bookings are not available on {holiday['name']}")
    
    # Get room details
    room = await db.meeting_rooms.find_one({"id": booking_data.room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=400, detail="Invalid room")
    
    # Get room type and credit cost
    room_type = room.get("room_type", "meeting_room")
    slot_duration = room.get("slot_duration", 30)  # 60 for CR, 30 for MR
    credit_cost_per_slot = room.get("credit_cost_per_slot", 5 if room_type == "meeting_room" else 20)
    
    # Calculate duration and validate slot rules
    start = datetime.strptime(booking_data.start_time, "%H:%M")
    end = datetime.strptime(booking_data.end_time, "%H:%M")
    duration = int((end - start).total_seconds() / 60)
    
    if duration <= 0:
        raise HTTPException(status_code=400, detail="End time must be after start time")
    
    # Validate slot duration rules
    if room_type == "conference_room" and duration % 60 != 0:
        raise HTTPException(status_code=400, detail="Conference rooms must be booked in 1-hour slots only")
    if room_type == "meeting_room" and duration % 30 != 0:
        raise HTTPException(status_code=400, detail="Meeting rooms must be booked in 30-minute slots")
    
    # Calculate number of slots and credits required
    num_slots = duration // slot_duration
    credits_required = num_slots * credit_cost_per_slot
    
    # Check for conflicts
    conflicts = await db.bookings.find_one({
        "room_id": booking_data.room_id,
        "date": booking_data.date,
        "status": {"$ne": "cancelled"},
        "$or": [
            {"start_time": {"$lt": booking_data.end_time}, "end_time": {"$gt": booking_data.start_time}}
        ]
    })
    
    if conflicts:
        raise HTTPException(status_code=400, detail="Time slot is already booked")
    
    # Get company to check credits at company level
    company_id = current_member.get("company_id")
    company = None
    company_remaining_credits = 0
    
    if company_id:
        company = await db.companies.find_one({"id": company_id}, {"_id": 0})
        if company:
            # Calculate company's total and remaining credits
            total_seats = company.get("total_seats", 0)
            credits_per_seat = company.get("meeting_room_credits", 30)
            total_credits = company.get("total_credits", total_seats * credits_per_seat)
            credits_used = company.get("credits_used", 0)
            company_remaining_credits = company.get("remaining_credits", total_credits - credits_used)
    
    # Calculate credits to use from balance and billable credits
    credits_to_use = min(credits_required, company_remaining_credits) if company_remaining_credits > 0 else 0
    billable_credits = credits_required - credits_to_use
    billable_amount = billable_credits * CREDIT_VALUE  # Rs. 50 per credit
    
    booking = {
        "id": str(__import__('uuid').uuid4()),
        "room_id": booking_data.room_id,
        "room_name": room["name"],
        "room_type": room_type,
        "member_id": current_member["id"],
        "member_name": current_member["name"],
        "company_id": company_id,
        "company_name": current_member["company_name"],
        "date": booking_data.date,
        "start_time": booking_data.start_time,
        "end_time": booking_data.end_time,
        "duration_minutes": duration,
        "num_slots": num_slots,
        "purpose": booking_data.purpose or "",
        "attendees": booking_data.attendees,
        "credit_cost_per_slot": credit_cost_per_slot,
        "credits_required": credits_required,
        "credits_used": credits_to_use,
        "billable_credits": billable_credits,
        "billable_amount": round(billable_amount, 2),
        "status": "confirmed",
        "payment_status": "pending" if billable_amount > 0 else "covered",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_member["id"]
    }
    
    await db.bookings.insert_one(booking)
    
    # Update company's credits used and remaining
    if credits_to_use > 0 and company_id:
        await db.companies.update_one(
            {"id": company_id},
            {
                "$inc": {"credits_used": credits_to_use},
                "$set": {"remaining_credits": company_remaining_credits - credits_to_use}
            }
        )
    
    booking.pop("_id", None)
    return booking

@router.delete("/bookings/{booking_id}")
async def cancel_member_booking(booking_id: str, current_member: dict = Depends(get_current_member)):
    """Cancel a booking (only own bookings)"""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.get("member_id") != current_member["id"]:
        raise HTTPException(status_code=403, detail="You can only cancel your own bookings")
    
    if booking.get("status") == "cancelled":
        raise HTTPException(status_code=400, detail="Booking is already cancelled")
    
    # Check if cancellation is 48 hours before the booking
    booking_datetime = datetime.strptime(f"{booking['date']} {booking['start_time']}", "%Y-%m-%d %H:%M")
    booking_datetime = booking_datetime.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    hours_until_booking = (booking_datetime - now).total_seconds() / 3600
    
    is_late_cancellation = hours_until_booking < 48
    
    credits_used = booking.get("credits_used", 0)
    company_id = booking.get("company_id") or current_member.get("company_id")
    
    # Only restore credits if cancellation is 48+ hours before booking
    if credits_used > 0 and company_id and not is_late_cancellation:
        company = await db.companies.find_one({"id": company_id}, {"_id": 0})
        if company:
            current_remaining = company.get("remaining_credits", 0)
            await db.companies.update_one(
                {"id": company_id},
                {
                    "$inc": {"credits_used": -credits_used},
                    "$set": {"remaining_credits": current_remaining + credits_used}
                }
            )
    
    # Update booking status with late cancellation flag
    update_data = {
        "status": "cancelled",
        "is_late_cancellation": is_late_cancellation,
        "cancelled_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.bookings.update_one({"id": booking_id}, {"$set": update_data})
    
    if is_late_cancellation:
        return {
            "message": "Booking cancelled. Note: Credits not restored due to late cancellation (less than 48 hours before booking).",
            "is_late_cancellation": True,
            "credits_forfeited": credits_used
        }
    
    return {
        "message": "Booking cancelled successfully. Credits have been restored.",
        "is_late_cancellation": False,
        "credits_restored": credits_used
    }

# ==================== ANNOUNCEMENTS (Read Only) ====================

@router.get("/announcements")
async def get_announcements_for_member():
    """Get active announcements for members"""
    now = datetime.now(timezone.utc).isoformat()
    
    announcements = await db.announcements.find(
        {
            "is_active": True,
            "$or": [
                {"expires_at": None},
                {"expires_at": ""},
                {"expires_at": {"$gt": now}}
            ]
        },
        {"_id": 0}
    ).sort([("is_pinned", -1), ("created_at", -1)]).to_list(50)
    
    return announcements

# ==================== MEETING ROOMS INFO ====================

@router.get("/rooms")
async def get_rooms_for_member():
    """Get available meeting rooms"""
    rooms = await db.meeting_rooms.find({"is_active": True}, {"_id": 0}).to_list(20)
    return rooms

@router.get("/rooms/{room_id}/availability")
async def check_room_availability_member(room_id: str, date: str):
    """Check room availability for a specific date"""
    room = await db.meeting_rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Check if date is a Sunday
    date_obj = datetime.strptime(date, "%Y-%m-%d")
    if date_obj.weekday() == 6:
        return {
            "room": room,
            "date": date,
            "slots": [],
            "message": "Bookings not available on Sundays"
        }
    
    # Check if date is a public holiday
    holiday = await db.public_holidays.find_one({"date": date, "is_active": True}, {"_id": 0})
    if holiday:
        return {
            "room": room,
            "date": date,
            "slots": [],
            "message": f"Bookings not available on {holiday['name']}"
        }
    
    # Get existing bookings
    bookings = await db.bookings.find(
        {"room_id": room_id, "date": date, "status": {"$ne": "cancelled"}},
        {"_id": 0}
    ).to_list(100)
    
    # Generate slots (10 AM to 7 PM)
    slot_duration = room["slot_duration"]
    slots = []
    
    current_time = datetime.strptime(f"{date} 10:00", "%Y-%m-%d %H:%M")
    end_time = datetime.strptime(f"{date} 19:00", "%Y-%m-%d %H:%M")
    
    while current_time + timedelta(minutes=slot_duration) <= end_time:
        slot_start = current_time.strftime("%H:%M")
        slot_end = (current_time + timedelta(minutes=slot_duration)).strftime("%H:%M")
        
        is_booked = any(
            b["start_time"] <= slot_start < b["end_time"] or
            b["start_time"] < slot_end <= b["end_time"]
            for b in bookings
        )
        
        slots.append({
            "start_time": slot_start,
            "end_time": slot_end,
            "is_available": not is_booked
        })
        
        current_time += timedelta(minutes=slot_duration)
    
    return {"room": room, "date": date, "slots": slots}
