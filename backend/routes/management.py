"""
Thryve Coworking Management System Routes
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid

# Import models
from models.management import (
    PlanType, PlanTypeCreate,
    MeetingRoom, MeetingRoomCreate,
    Member, MemberCreate, MemberUpdate, MemberTerminate, BulkTerminate,
    Booking, BookingCreate,
    Ticket, TicketCreate, TicketUpdate,
    Announcement, AnnouncementCreate
)

# Router
router = APIRouter(prefix="/api/management", tags=["Management"])

# Security
security = HTTPBearer()

# These will be set by the main server
db = None
_get_current_user_func = None
_check_permission_func = None

def init_router(database, auth_func, perm_func):
    """Initialize router with database and auth functions"""
    global db, _get_current_user_func, _check_permission_func
    db = database
    _get_current_user_func = auth_func
    _check_permission_func = perm_func

async def calculate_company_credits_from_bookings(company_id: str, company_name: str = None):
    """
    Calculate actual credits used by summing all confirmed bookings for a company
    in the CURRENT MONTH only. Credits reset on the 1st of each month.
    
    Credit rates:
    - Conference Room (CR): 20 credits per hour (60-min slot)
    - Meeting Room (MR): 5 credits per 30-min slot
    """
    # Get current month date range (1st of current month to today)
    now = datetime.now(timezone.utc)
    first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    first_of_month_str = first_of_month.strftime("%Y-%m-%d")
    
    query = {
        "status": {"$ne": "cancelled"},
        "date": {"$gte": first_of_month_str}  # Only bookings from current month
    }
    
    if company_name:
        query["$or"] = [
            {"company_id": company_id},
            {"company_name": company_name}
        ]
    else:
        query["company_id"] = company_id
    
    bookings = await db.bookings.find(query, {"_id": 0}).to_list(1000)
    
    total_credits_used = 0
    for booking in bookings:
        # Use credits_required if available (new bookings), otherwise calculate from duration
        if booking.get("credits_required"):
            total_credits_used += booking.get("credits_required", 0)
        elif booking.get("credits_used"):
            total_credits_used += booking.get("credits_used", 0)
        else:
            # Calculate credits from duration based on room type
            duration = booking.get("duration_minutes", 0)
            room_name = (booking.get("room_name") or "").upper()
            
            if "CR" in room_name:  # Conference Room: 20 credits per hour
                credits = (duration / 60) * 20
            else:  # Meeting Room: 5 credits per 30-min slot
                credits = (duration / 30) * 5
            
            total_credits_used += int(credits)
    
    return total_credits_used

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Wrapper that calls the actual auth function"""
    if _get_current_user_func is None:
        raise HTTPException(status_code=500, detail="Auth not initialized")
    return await _get_current_user_func(credentials)

def check_permission(user: dict, permission: str):
    """Wrapper for permission check"""
    return _check_permission_func(user, permission)

# ==================== PLAN TYPES ====================

@router.get("/plans", response_model=List[PlanType])
async def get_plans():
    """Get all plan types"""
    plans = await db.plan_types.find({}, {"_id": 0}).to_list(100)
    return plans

@router.post("/plans", response_model=PlanType)
async def create_plan(plan_data: PlanTypeCreate, current_user: dict = Depends(get_current_user)):
    check_permission(current_user, "all")
    
    plan = PlanType(**plan_data.model_dump())
    doc = plan.model_dump()
    await db.plan_types.insert_one(doc)
    return plan

@router.put("/plans/{plan_id}", response_model=PlanType)
async def update_plan(plan_id: str, plan_data: PlanTypeCreate, current_user: dict = Depends(get_current_user)):
    check_permission(current_user, "all")
    
    existing = await db.plan_types.find_one({"id": plan_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    update_data = plan_data.model_dump()
    await db.plan_types.update_one({"id": plan_id}, {"$set": update_data})
    
    updated = await db.plan_types.find_one({"id": plan_id}, {"_id": 0})
    return updated

@router.delete("/plans/{plan_id}")
async def delete_plan(plan_id: str, current_user: dict = Depends(get_current_user)):
    check_permission(current_user, "all")
    
    # Check if any members use this plan
    member_count = await db.members.count_documents({"plan_type_id": plan_id})
    if member_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete plan: {member_count} members are using it")
    
    result = await db.plan_types.delete_one({"id": plan_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    return {"message": "Plan deleted successfully"}

# ==================== MEETING ROOMS ====================

@router.get("/rooms", response_model=List[MeetingRoom])
async def get_rooms():
    """Get all meeting rooms"""
    rooms = await db.meeting_rooms.find({}, {"_id": 0}).to_list(100)
    return rooms

@router.post("/rooms", response_model=MeetingRoom)
async def create_room(room_data: MeetingRoomCreate, current_user: dict = Depends(get_current_user)):
    check_permission(current_user, "all")
    
    room = MeetingRoom(**room_data.model_dump())
    doc = room.model_dump()
    await db.meeting_rooms.insert_one(doc)
    return room

@router.put("/rooms/{room_id}", response_model=MeetingRoom)
async def update_room(room_id: str, room_data: MeetingRoomCreate, current_user: dict = Depends(get_current_user)):
    check_permission(current_user, "all")
    
    existing = await db.meeting_rooms.find_one({"id": room_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Room not found")
    
    update_data = room_data.model_dump()
    await db.meeting_rooms.update_one({"id": room_id}, {"$set": update_data})
    
    updated = await db.meeting_rooms.find_one({"id": room_id}, {"_id": 0})
    return updated

# ==================== MEMBERS ====================

@router.get("/members", response_model=List[Member])
async def get_members(status: Optional[str] = None):
    """Get all members, optionally filtered by status"""
    query = {}
    if status:
        query["status"] = status
    
    members = await db.members.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return members

@router.get("/members/companies")
async def get_companies():
    """Get list of unique companies with member counts"""
    pipeline = [
        {"$group": {
            "_id": "$company_name",
            "total_members": {"$sum": 1},
            "active_members": {"$sum": {"$cond": [{"$eq": ["$status", "active"]}, 1, 0]}},
            "terminated_members": {"$sum": {"$cond": [{"$eq": ["$status", "terminated"]}, 1, 0]}},
            "has_outstanding_dues": {"$sum": {"$cond": ["$has_outstanding_dues", 1, 0]}}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    companies = await db.members.aggregate(pipeline).to_list(500)
    
    return [{
        "company_name": c["_id"],
        "total_members": c["total_members"],
        "active_members": c["active_members"],
        "terminated_members": c["terminated_members"],
        "has_outstanding_dues": c["has_outstanding_dues"]
    } for c in companies]

@router.get("/members/with-outstanding-dues")
async def get_members_with_outstanding_dues():
    """Get all terminated members with outstanding dues"""
    members = await db.members.find({
        "has_outstanding_dues": True
    }, {"_id": 0}).to_list(500)
    return members

@router.get("/members/{member_id}", response_model=Member)
async def get_member(member_id: str):
    """Get a specific member"""
    member = await db.members.find_one({"id": member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member

@router.post("/members", response_model=Member)
async def create_member(member_data: MemberCreate, current_user: dict = Depends(get_current_user)):
    check_permission(current_user, "all")
    
    # Get plan details
    plan = await db.plan_types.find_one({"id": member_data.plan_type_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=400, detail="Invalid plan type")
    
    # Calculate final rate
    base_rate = member_data.custom_rate if member_data.custom_rate else plan["default_rate"]
    discount = member_data.discount_percent or 0
    final_rate = base_rate * (1 - discount / 100)
    
    # Determine meeting room credits
    credits = member_data.meeting_room_credits if member_data.meeting_room_credits is not None else plan["meeting_room_credits"]
    
    member = Member(
        name=member_data.name,
        email=member_data.email,
        phone=member_data.phone,
        company_name=member_data.company_name,
        company_address=member_data.company_address or "",
        gstin=member_data.gstin or "",
        plan_type_id=member_data.plan_type_id,
        plan_name=plan["name"],
        seat_number=member_data.seat_number,
        custom_rate=member_data.custom_rate,
        discount_percent=discount,
        final_rate=round(final_rate, 2),
        meeting_room_credits=credits,
        credits_used=0,
        credits_reset_date=datetime.now(timezone.utc).strftime('%Y-%m-01'),  # First of current month
        start_date=member_data.start_date,
        notes=member_data.notes or "",
        created_by=current_user.get("id")
    )
    
    doc = member.model_dump()
    await db.members.insert_one(doc)
    
    # Also create/update client record for invoicing
    client_doc = {
        "id": member.id,
        "company_name": member.company_name,
        "address": member.company_address,
        "gstin": member.gstin,
        "created_at": member.created_at
    }
    await db.clients.update_one(
        {"id": member.id},
        {"$set": client_doc},
        upsert=True
    )
    
    return member

@router.put("/members/{member_id}", response_model=Member)
async def update_member(member_id: str, member_data: MemberUpdate, current_user: dict = Depends(get_current_user)):
    check_permission(current_user, "all")
    
    existing = await db.members.find_one({"id": member_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Member not found")
    
    update_dict = {k: v for k, v in member_data.model_dump().items() if v is not None}
    
    # If plan changed, update plan name and recalculate rate
    if "plan_type_id" in update_dict:
        plan = await db.plan_types.find_one({"id": update_dict["plan_type_id"]}, {"_id": 0})
        if plan:
            update_dict["plan_name"] = plan["name"]
    
    # Recalculate final rate if rate or discount changed
    if "custom_rate" in update_dict or "discount_percent" in update_dict:
        plan_id = update_dict.get("plan_type_id", existing["plan_type_id"])
        plan = await db.plan_types.find_one({"id": plan_id}, {"_id": 0})
        
        base_rate = update_dict.get("custom_rate", existing.get("custom_rate"))
        if not base_rate:
            base_rate = plan["default_rate"] if plan else existing.get("final_rate", 0)
        
        discount = update_dict.get("discount_percent", existing.get("discount_percent", 0))
        update_dict["final_rate"] = round(base_rate * (1 - discount / 100), 2)
    
    if update_dict:
        await db.members.update_one({"id": member_id}, {"$set": update_dict})
    
    # Update client record too
    if any(k in update_dict for k in ["company_name", "company_address", "gstin"]):
        client_update = {}
        if "company_name" in update_dict:
            client_update["company_name"] = update_dict["company_name"]
        if "company_address" in update_dict:
            client_update["address"] = update_dict["company_address"]
        if "gstin" in update_dict:
            client_update["gstin"] = update_dict["gstin"]
        if client_update:
            await db.clients.update_one({"id": member_id}, {"$set": client_update})
    
    updated = await db.members.find_one({"id": member_id}, {"_id": 0})
    return updated

@router.delete("/members/{member_id}")
async def delete_member(member_id: str, current_user: dict = Depends(get_current_user)):
    check_permission(current_user, "all")
    
    result = await db.members.delete_one({"id": member_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Member not found")
    
    return {"message": "Member deleted successfully"}

@router.post("/members/{member_id}/terminate", response_model=Member)
async def terminate_member(member_id: str, data: MemberTerminate, current_user: dict = Depends(get_current_user)):
    """Terminate a member (preserves history)"""
    check_permission(current_user, "all")
    
    existing = await db.members.find_one({"id": member_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Member not found")
    
    if existing.get("status") == "terminated":
        raise HTTPException(status_code=400, detail="Member is already terminated")
    
    update_data = {
        "status": "terminated",
        "end_date": data.end_date,
        "termination_reason": data.termination_reason,
        "has_outstanding_dues": data.has_outstanding_dues,
        "terminated_at": datetime.now(timezone.utc).isoformat(),
        "terminated_by": current_user.get("id")
    }
    
    await db.members.update_one({"id": member_id}, {"$set": update_data})
    
    updated = await db.members.find_one({"id": member_id}, {"_id": 0})
    return updated

@router.post("/members/{member_id}/reactivate", response_model=Member)
async def reactivate_member(member_id: str, current_user: dict = Depends(get_current_user)):
    """Reactivate a terminated member"""
    check_permission(current_user, "all")
    
    existing = await db.members.find_one({"id": member_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Member not found")
    
    if existing.get("status") != "terminated":
        raise HTTPException(status_code=400, detail="Member is not terminated")
    
    update_data = {
        "status": "active",
        "end_date": None,
        "termination_reason": None,
        "has_outstanding_dues": False,
        "terminated_at": None,
        "terminated_by": None
    }
    
    await db.members.update_one({"id": member_id}, {"$set": update_data})
    
    updated = await db.members.find_one({"id": member_id}, {"_id": 0})
    return updated

@router.post("/members/bulk-terminate")
async def bulk_terminate_members(data: BulkTerminate, current_user: dict = Depends(get_current_user)):
    """Terminate all members from a company"""
    check_permission(current_user, "all")
    
    # Find all active members from the company
    members = await db.members.find({
        "company_name": data.company_name,
        "status": {"$ne": "terminated"}
    }, {"_id": 0}).to_list(1000)
    
    if not members:
        raise HTTPException(status_code=404, detail="No active members found for this company")
    
    update_data = {
        "status": "terminated",
        "end_date": data.end_date,
        "termination_reason": data.termination_reason,
        "has_outstanding_dues": data.has_outstanding_dues,
        "terminated_at": datetime.now(timezone.utc).isoformat(),
        "terminated_by": current_user.get("id")
    }
    
    result = await db.members.update_many(
        {"company_name": data.company_name, "status": {"$ne": "terminated"}},
        {"$set": update_data}
    )
    
    return {
        "message": f"Successfully terminated {result.modified_count} members from {data.company_name}",
        "terminated_count": result.modified_count,
        "members": [m["name"] for m in members]
    }

# ==================== BOOKINGS ====================

@router.get("/bookings")
async def get_bookings(
    date: Optional[str] = None,
    room_id: Optional[str] = None,
    member_id: Optional[str] = None
):
    """Get bookings with optional filters"""
    query = {"status": {"$ne": "cancelled"}}
    if date:
        query["date"] = date
    if room_id:
        query["room_id"] = room_id
    if member_id:
        query["member_id"] = member_id
    
    bookings = await db.bookings.find(query, {"_id": 0}).sort([("date", 1), ("start_time", 1)]).to_list(500)
    return bookings

@router.get("/bookings/availability")
async def check_availability(room_id: str, date: str):
    """Get available slots for a room on a specific date"""
    room = await db.meeting_rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Check if date is a Sunday
    date_obj = datetime.strptime(date, "%Y-%m-%d")
    if date_obj.weekday() == 6:  # Sunday
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
    
    # Get existing bookings for this room and date
    bookings = await db.bookings.find(
        {"room_id": room_id, "date": date, "status": {"$ne": "cancelled"}},
        {"_id": 0}
    ).to_list(100)
    
    # Generate all possible slots (10 AM to 7 PM)
    # The last slot should END at 7 PM, so we need slots that start early enough
    slot_duration = room["slot_duration"]
    slots = []
    
    start_hour = 10
    end_hour = 19  # 7 PM - last slot ends here
    
    current_time = datetime.strptime(f"{date} {start_hour:02d}:00", "%Y-%m-%d %H:%M")
    end_time = datetime.strptime(f"{date} {end_hour:02d}:00", "%Y-%m-%d %H:%M")
    
    while current_time + timedelta(minutes=slot_duration) <= end_time:
        slot_start = current_time.strftime("%H:%M")
        slot_end = (current_time + timedelta(minutes=slot_duration)).strftime("%H:%M")
        
        # Check if slot is booked
        is_booked = any(
            b["start_time"] <= slot_start < b["end_time"] or
            b["start_time"] < slot_end <= b["end_time"] or
            (slot_start <= b["start_time"] and slot_end >= b["end_time"])
            for b in bookings
        )
        
        slots.append({
            "start_time": slot_start,
            "end_time": slot_end,
            "is_available": not is_booked
        })
        
        current_time += timedelta(minutes=slot_duration)
    
    return {
        "room": room,
        "date": date,
        "slots": slots
    }

# Booking rules
MAX_ADVANCE_DAYS = 10
MIN_CANCEL_DAYS = 2

@router.post("/bookings", response_model=Booking)
async def create_booking(booking_data: BookingCreate, current_user: dict = Depends(get_current_user)):
    # Validate booking date (max 10 days in advance)
    booking_date = datetime.strptime(booking_data.date, "%Y-%m-%d").date()
    today = datetime.now(timezone.utc).date()
    max_date = today + timedelta(days=MAX_ADVANCE_DAYS)
    
    if booking_date < today:
        raise HTTPException(status_code=400, detail="Cannot book in the past")
    if booking_date > max_date:
        raise HTTPException(status_code=400, detail=f"Bookings can only be made up to {MAX_ADVANCE_DAYS} days in advance")
    
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
    
    # Calculate duration in minutes
    start = datetime.strptime(booking_data.start_time, "%H:%M")
    end = datetime.strptime(booking_data.end_time, "%H:%M")
    duration = int((end - start).total_seconds() / 60)
    
    if duration <= 0:
        raise HTTPException(status_code=400, detail="End time must be after start time")
    
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
    
    # Handle guest booking
    if booking_data.is_guest:
        if not booking_data.guest_name or not booking_data.guest_phone or not booking_data.guest_id_number:
            raise HTTPException(status_code=400, detail="Guest name, phone and ID number are required")
        
        # Calculate payment for guest (no credits)
        hourly_rate = room.get("hourly_rate", 500)
        payment_amount = booking_data.payment_amount or (duration / 60) * hourly_rate
        
        booking = Booking(
            room_id=booking_data.room_id,
            room_name=room["name"],
            member_id=None,
            member_name=booking_data.guest_name,
            company_name=booking_data.guest_company or "Guest",
            date=booking_data.date,
            start_time=booking_data.start_time,
            end_time=booking_data.end_time,
            duration_minutes=duration,
            purpose=booking_data.purpose or "",
            attendees=booking_data.attendees,
            credits_used=0,
            billable_amount=round(payment_amount, 2),
            is_guest=True,
            guest_name=booking_data.guest_name,
            guest_phone=booking_data.guest_phone,
            guest_email=booking_data.guest_email,
            guest_company=booking_data.guest_company,
            guest_id_type=booking_data.guest_id_type,
            guest_id_number=booking_data.guest_id_number,
            payment_amount=round(payment_amount, 2),
            payment_status=booking_data.payment_status or "pending",
            created_by=current_user.get("id")
        )
        
        doc = booking.model_dump()
        await db.bookings.insert_one(doc)
        return booking
    
    # Handle member booking
    if not booking_data.member_id:
        raise HTTPException(status_code=400, detail="Member ID is required for member bookings")
    
    # Get member details
    member = await db.members.find_one({"id": booking_data.member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=400, detail="Invalid member")
    
    # Calculate credits and billing
    member_credits = member.get("meeting_room_credits", 0) - member.get("credits_used", 0)
    credits_to_use = min(duration, member_credits) if member_credits > 0 else 0
    billable_minutes = duration - credits_to_use
    billable_amount = (billable_minutes / 60) * room["hourly_rate"] if billable_minutes > 0 else 0
    
    booking = Booking(
        room_id=booking_data.room_id,
        room_name=room["name"],
        member_id=booking_data.member_id,
        member_name=member["name"],
        company_name=member["company_name"],
        date=booking_data.date,
        start_time=booking_data.start_time,
        end_time=booking_data.end_time,
        duration_minutes=duration,
        purpose=booking_data.purpose or "",
        attendees=booking_data.attendees,
        credits_used=credits_to_use,
        billable_amount=round(billable_amount, 2),
        created_by=current_user.get("id")
    )
    
    doc = booking.model_dump()
    await db.bookings.insert_one(doc)
    
    # Update member's credits used
    if credits_to_use > 0:
        await db.members.update_one(
            {"id": booking_data.member_id},
            {"$inc": {"credits_used": credits_to_use}}
        )
    
    return booking

@router.delete("/bookings/{booking_id}")
async def cancel_booking(booking_id: str, current_user: dict = Depends(get_current_user)):
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Calculate hours until booking
    booking_date = datetime.strptime(booking["date"], "%Y-%m-%d")
    booking_time = booking.get("start_time", "09:00")
    booking_hour, booking_min = map(int, booking_time.split(":"))
    booking_datetime = booking_date.replace(hour=booking_hour, minute=booking_min, tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    hours_until = (booking_datetime - now).total_seconds() / 3600
    
    # 48-hour cancellation policy
    # If cancelled 48+ hours before: no charge, restore credits
    # If cancelled within 48 hours: charge applies, billable amount retained
    
    update_data = {"status": "cancelled", "cancelled_at": now.isoformat()}
    
    if hours_until >= 48:
        # Free cancellation - remove billable amount and restore credits
        update_data["billable_amount"] = 0
        update_data["cancellation_charge"] = False
        
        # Restore credits if applicable
        if booking.get("credits_used", 0) > 0:
            await db.members.update_one(
                {"id": booking["member_id"]},
                {"$inc": {"credits_used": -booking["credits_used"]}}
            )
    else:
        # Late cancellation - charge applies
        update_data["cancellation_charge"] = True
        # Don't restore credits and keep billable amount
    
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": update_data}
    )
    
    message = "Booking cancelled successfully"
    if hours_until < 48:
        message += " (Late cancellation - charges apply)"
    
    return {"message": message, "charges_apply": hours_until < 48}

# ==================== SUPPORT TICKETS ====================

async def generate_ticket_number():
    """Generate sequential ticket number"""
    latest = await db.tickets.find_one(
        {},
        {"ticket_number": 1},
        sort=[("created_at", -1)]
    )
    
    if latest and latest.get("ticket_number"):
        try:
            num = int(latest["ticket_number"].split("-")[-1])
            return f"THR-TKT-{num + 1:04d}"
        except:
            pass
    
    return "THR-TKT-0001"

@router.get("/tickets", response_model=List[Ticket])
async def get_tickets(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    category: Optional[str] = None
):
    """Get all tickets with optional filters"""
    query = {}
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    if category:
        query["category"] = category
    
    tickets = await db.tickets.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return tickets

@router.post("/tickets", response_model=Ticket)
async def create_ticket(ticket_data: TicketCreate, current_user: dict = Depends(get_current_user)):
    ticket_number = await generate_ticket_number()
    
    member_name = ""
    if ticket_data.member_id:
        member = await db.members.find_one({"id": ticket_data.member_id}, {"_id": 0})
        if member:
            member_name = member["name"]
    
    ticket = Ticket(
        ticket_number=ticket_number,
        title=ticket_data.title,
        description=ticket_data.description,
        category=ticket_data.category,
        priority=ticket_data.priority,
        member_id=ticket_data.member_id,
        member_name=member_name,
        created_by=current_user.get("id")
    )
    
    doc = ticket.model_dump()
    await db.tickets.insert_one(doc)
    return ticket

@router.put("/tickets/{ticket_id}", response_model=Ticket)
async def update_ticket(ticket_id: str, ticket_data: TicketUpdate, current_user: dict = Depends(get_current_user)):
    existing = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    update_dict = {k: v for k, v in ticket_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # If assigning to someone, get their name
    if "assigned_to" in update_dict:
        user = await db.users.find_one({"id": update_dict["assigned_to"]}, {"_id": 0})
        if user:
            update_dict["assigned_name"] = user["name"]
    
    # If resolving, set resolved timestamp
    if update_dict.get("status") == "resolved":
        update_dict["resolved_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.tickets.update_one({"id": ticket_id}, {"$set": update_dict})
    
    updated = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    return updated

# ==================== ANNOUNCEMENTS ====================

@router.get("/announcements", response_model=List[Announcement])
async def get_announcements(active_only: bool = True):
    """Get announcements"""
    query = {}
    if active_only:
        query["is_active"] = True
        # Exclude expired
        now = datetime.now(timezone.utc).isoformat()
        query["$or"] = [
            {"expires_at": None},
            {"expires_at": ""},
            {"expires_at": {"$gt": now}}
        ]
    
    announcements = await db.announcements.find(query, {"_id": 0}).sort([("is_pinned", -1), ("created_at", -1)]).to_list(100)
    return announcements

@router.post("/announcements", response_model=Announcement)
async def create_announcement(ann_data: AnnouncementCreate, current_user: dict = Depends(get_current_user)):
    check_permission(current_user, "all")
    
    announcement = Announcement(
        title=ann_data.title,
        content=ann_data.content,
        category=ann_data.category,
        is_pinned=ann_data.is_pinned,
        expires_at=ann_data.expires_at,
        created_by=current_user.get("id"),
        author_name=current_user.get("name", "Admin")
    )
    
    doc = announcement.model_dump()
    await db.announcements.insert_one(doc)
    return announcement

@router.put("/announcements/{ann_id}", response_model=Announcement)
async def update_announcement(ann_id: str, ann_data: AnnouncementCreate, current_user: dict = Depends(get_current_user)):
    check_permission(current_user, "all")
    
    existing = await db.announcements.find_one({"id": ann_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Announcement not found")
    
    update_data = ann_data.model_dump()
    await db.announcements.update_one({"id": ann_id}, {"$set": update_data})
    
    updated = await db.announcements.find_one({"id": ann_id}, {"_id": 0})
    return updated

@router.delete("/announcements/{ann_id}")
async def delete_announcement(ann_id: str, current_user: dict = Depends(get_current_user)):
    check_permission(current_user, "all")
    
    result = await db.announcements.delete_one({"id": ann_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Announcement not found")
    
    return {"message": "Announcement deleted successfully"}

# ==================== DASHBOARD STATS ====================

@router.get("/stats")
async def get_management_stats():
    """Get management dashboard statistics"""
    now = datetime.now(timezone.utc)
    current_month = now.strftime('%Y-%m')
    today = now.strftime('%Y-%m-%d')
    
    # Company counts (primary entity)
    total_companies = await db.companies.count_documents({})
    active_companies = await db.companies.count_documents({"status": "active"})
    
    # Calculate total seats and revenue from companies
    companies = await db.companies.find({"status": "active"}, {"total_seats": 1, "total_rate": 1, "rate_per_seat": 1}).to_list(1000)
    total_seats = sum(c.get("total_seats", 0) for c in companies)
    monthly_revenue = sum(c.get("total_rate", 0) or (c.get("total_seats", 0) * c.get("rate_per_seat", 0)) for c in companies)
    
    # Member counts (individual users under companies)
    total_members = await db.members.count_documents({})
    active_members = await db.members.count_documents({"status": "active"})
    
    # Plan distribution from companies
    plan_distribution = {}
    async for company in db.companies.find({"status": "active"}, {"plan_name": 1, "total_seats": 1}):
        plan = company.get("plan_name", "Unknown")
        seats = company.get("total_seats", 1)
        plan_distribution[plan] = plan_distribution.get(plan, 0) + seats
    
    # Today's bookings
    todays_bookings = await db.bookings.count_documents({
        "date": today,
        "status": {"$ne": "cancelled"}
    })
    
    # Open tickets
    open_tickets = await db.tickets.count_documents({"status": {"$in": ["open", "in_progress"]}})
    
    # Recent announcements count
    active_announcements = await db.announcements.count_documents({"is_active": True})
    
    return {
        "total_companies": total_companies,
        "active_companies": active_companies,
        "total_seats": total_seats,
        "total_members": total_members,
        "active_members": active_members,
        "plan_distribution": plan_distribution,
        "todays_bookings": todays_bookings,
        "monthly_revenue": round(monthly_revenue, 2),
        "open_tickets": open_tickets,
        "active_announcements": active_announcements
    }

# ==================== UPCOMING BIRTHDAYS ====================

@router.get("/birthdays/upcoming")
async def get_upcoming_birthdays(days: int = 30):
    """Get members with upcoming birthdays in the next N days"""
    now = datetime.now()
    current_year = now.year
    current_month = now.month
    current_day = now.day
    
    # Get all active members with date_of_birth
    members = await db.members.find(
        {"status": "active", "date_of_birth": {"$ne": None, "$exists": True}},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1, "company_name": 1, "date_of_birth": 1}
    ).to_list(1000)
    
    upcoming_birthdays = []
    
    for member in members:
        dob_str = member.get("date_of_birth")
        if not dob_str:
            continue
        
        try:
            # Parse date of birth
            dob = datetime.fromisoformat(dob_str.replace('Z', '+00:00')).replace(tzinfo=None)
            
            # Calculate this year's birthday
            this_year_birthday = dob.replace(year=current_year)
            
            # If birthday already passed this year, check next year's
            if this_year_birthday.date() < now.date():
                this_year_birthday = dob.replace(year=current_year + 1)
            
            # Calculate days until birthday
            days_until = (this_year_birthday.date() - now.date()).days
            
            if 0 <= days_until <= days:
                # Calculate age they will turn
                age = this_year_birthday.year - dob.year
                
                upcoming_birthdays.append({
                    "id": member.get("id"),
                    "name": member.get("name"),
                    "email": member.get("email"),
                    "phone": member.get("phone"),
                    "company_name": member.get("company_name"),
                    "date_of_birth": dob_str,
                    "birthday_date": this_year_birthday.strftime("%Y-%m-%d"),
                    "days_until": days_until,
                    "turning_age": age,
                    "is_today": days_until == 0
                })
        except (ValueError, AttributeError):
            continue
    
    # Sort by days until birthday (closest first)
    upcoming_birthdays.sort(key=lambda x: x["days_until"])
    
    return upcoming_birthdays

# ==================== PENDING MEETING ROOM CHARGES ====================

@router.get("/pending-charges")
async def get_pending_meeting_charges():
    """Get all pending meeting room charges grouped by company - CREDIT-BASED SYSTEM
    
    Credit System:
    - 1 Credit = Rs. 50
    - Credits per seat per month = 30
    - Conference Room: 20 credits/hour
    - Meeting Room: 5 credits/30-min slot
    
    Billing Logic (Monthly Reset):
    - Credits reset on the 1st of each month
    - Only current month's bookings are counted
    - If credits_used <= credits_allocated: No charge
    - If credits_used > credits_allocated: Charge for excess credits at Rs. 50/credit
    """
    CREDIT_VALUE = 50  # Rs. 50 per credit
    CREDITS_PER_SEAT = 30  # Default credits per seat per month
    
    # Get all active companies
    companies = await db.companies.find({"status": "active"}, {"_id": 0}).to_list(1000)
    
    company_charges = []
    guest_charges = []
    
    for company in companies:
        company_id = company.get("id")
        company_name = company.get("company_name")
        
        # Get TOTAL allocated credits for this company
        total_seats = company.get("total_seats", 0)
        credits_per_seat = company.get("meeting_room_credits", CREDITS_PER_SEAT)
        total_allocated_credits = company.get("total_credits", total_seats * credits_per_seat)
        
        # Calculate credits used from bookings THIS MONTH using the shared function
        total_credits_used = await calculate_company_credits_from_bookings(company_id, company_name)
        
        # Get bookings for details (current month only)
        now = datetime.now(timezone.utc)
        first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        first_of_month_str = first_of_month.strftime("%Y-%m-%d")
        
        bookings = await db.bookings.find({
            "$or": [
                {"company_id": company_id},
                {"company_name": company_name}
            ],
            "status": {"$ne": "cancelled"},
            "date": {"$gte": first_of_month_str}
        }, {"_id": 0}).to_list(1000)
        
        if not bookings:
            continue
        
        # Calculate billable credits (excess over allocated)
        if total_credits_used <= total_allocated_credits:
            # No charge - all usage is covered by allocated credits
            billable_credits = 0
            billable_amount = 0
        else:
            # Charge for excess credits
            billable_credits = total_credits_used - total_allocated_credits
            billable_amount = billable_credits * CREDIT_VALUE  # Rs. 50 per credit
        
        # Only add to charges if there are excess credits to bill
        if billable_credits > 0:
            company_charges.append({
                "company_id": company_id,
                "company_name": company_name,
                "total_allocated_credits": total_allocated_credits,
                "total_credits_used": total_credits_used,
                "billable_credits": billable_credits,
                "credit_value": CREDIT_VALUE,
                "total_amount": billable_amount,
                "booking_count": len(bookings),
                "bookings": [{
                    "booking_id": b.get("id"),
                    "member_name": b.get("member_name"),
                    "date": b.get("date"),
                    "room_name": b.get("room_name"),
                    "duration_minutes": b.get("duration_minutes", 0),
                    "start_time": b.get("start_time"),
                    "end_time": b.get("end_time"),
                    "credits_required": b.get("credits_required", 0),
                } for b in bookings]
            })
    
    # Handle guest bookings separately (no credit system - direct billing)
    guest_bookings = await db.bookings.find({
        "is_guest": True,
        "billable_amount": {"$gt": 0},
        "payment_status": {"$nin": ["paid", "completed", "invoiced"]},
        "status": {"$ne": "cancelled"}
    }, {"_id": 0}).to_list(1000)
    
    for booking in guest_bookings:
        guest_charges.append({
            "booking_id": booking.get("id"),
            "guest_name": booking.get("guest_name"),
            "guest_company": booking.get("guest_company"),
            "date": booking.get("date"),
            "room_name": booking.get("room_name"),
            "amount": booking.get("billable_amount", 0),
            "payment_status": booking.get("payment_status", "pending")
        })
    
    return {
        "company_charges": company_charges,
        "guest_charges": guest_charges,
        "total_pending": sum(c["total_amount"] for c in company_charges) + sum(g["amount"] for g in guest_charges),
        "credit_value": CREDIT_VALUE
    }

# ==================== SEED DEFAULT DATA ====================

async def seed_default_data(database=None):
    """Seed default plans and meeting rooms if not exist"""
    _db = database if database is not None else db
    
    # Default plan types
    default_plans = [
        {"name": "Private Cabin - 4 Seater", "category": "cabin", "capacity": 4, "default_rate": 40000, "meeting_room_credits": 480},
        {"name": "Private Cabin - 6 Seater", "category": "cabin", "capacity": 6, "default_rate": 55000, "meeting_room_credits": 600},
        {"name": "Open Desk", "category": "open_desk", "capacity": 1, "default_rate": 8000, "meeting_room_credits": 120},
        {"name": "Hot Desk", "category": "hot_desk", "capacity": 1, "default_rate": 6000, "meeting_room_credits": 60},
        {"name": "Day Pass", "category": "day_pass", "capacity": 1, "default_rate": 500, "meeting_room_credits": 0},
    ]
    
    for plan in default_plans:
        existing = await _db.plan_types.find_one({"name": plan["name"]})
        if not existing:
            plan_obj = PlanType(**plan)
            await _db.plan_types.insert_one(plan_obj.model_dump())
    
    # Default meeting rooms with correct credit costs
    # Conference Room: 20 credits per hour (60-min slot)
    # Meeting Room: 5 credits per 30-min slot
    default_rooms = [
        {"name": "CR-1", "display_name": "Conference Room 1", "capacity": 10, "hourly_rate": 1000, "slot_duration": 60, "room_type": "conference_room", "credit_cost_per_slot": 20},
        {"name": "MR-1", "display_name": "Meeting Room 1", "capacity": 5, "hourly_rate": 500, "slot_duration": 30, "room_type": "meeting_room", "credit_cost_per_slot": 5},
        {"name": "MR-2", "display_name": "Meeting Room 2", "capacity": 5, "hourly_rate": 500, "slot_duration": 30, "room_type": "meeting_room", "credit_cost_per_slot": 5},
    ]
    
    for room in default_rooms:
        existing = await _db.meeting_rooms.find_one({"name": room["name"]})
        if not existing:
            room_obj = MeetingRoom(**room)
            await _db.meeting_rooms.insert_one(room_obj.model_dump())
