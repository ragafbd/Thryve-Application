"""
Company Subscription Management Routes
Companies are the main entity, members are added under companies
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from datetime import datetime, timezone

from models.management import (
    Company, CompanyCreate, CompanyUpdate, CompanyTerminate,
    Member, CompanyMemberCreate, MemberUpdate, CompanyMemberUpdate
)

router = APIRouter(prefix="/api/companies", tags=["Companies"])
security = HTTPBearer()

# Database reference - will be set by init
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
    if _get_current_user_func is None:
        raise HTTPException(status_code=500, detail="Auth not initialized")
    return await _get_current_user_func(credentials)

def check_permission(user: dict, permission: str):
    return _check_permission_func(user, permission)


# ==================== COMPANY ROUTES ====================

@router.get("")
async def get_companies(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all companies with dynamically calculated credits from bookings"""
    check_permission(current_user, "view_invoice")
    
    query = {}
    if status and status != "all":
        query["status"] = status
    
    companies = await db.companies.find(query, {"_id": 0}).sort("company_name", 1).to_list(1000)
    
    # Get member counts and calculate actual credits for each company
    for company in companies:
        member_count = await db.members.count_documents({"company_id": company["id"], "status": "active"})
        company["members_count"] = member_count
        
        # Calculate credits from actual bookings (not cached values)
        total_seats = company.get("total_seats", 0)
        credits_per_seat = company.get("meeting_room_credits", 30)
        total_credits = company.get("total_credits", total_seats * credits_per_seat)
        
        # Dynamic calculation from bookings
        credits_used = await calculate_company_credits_from_bookings(
            company["id"], 
            company.get("company_name")
        )
        remaining_credits = max(0, total_credits - credits_used)
        
        # Override stored values with calculated values
        company["total_credits"] = total_credits
        company["credits_used"] = credits_used
        company["remaining_credits"] = remaining_credits
    
    return companies


@router.get("/{company_id}")
async def get_company(company_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific company with its members and dynamically calculated credits"""
    check_permission(current_user, "view_invoice")
    
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Get members under this company
    members = await db.members.find({"company_id": company_id}, {"_id": 0}).to_list(100)
    company["members"] = members
    
    # Calculate credits from actual bookings (not cached values)
    total_seats = company.get("total_seats", 0)
    credits_per_seat = company.get("meeting_room_credits", 30)
    total_credits = company.get("total_credits", total_seats * credits_per_seat)
    
    # Dynamic calculation from bookings
    credits_used = await calculate_company_credits_from_bookings(
        company_id, 
        company.get("company_name")
    )
    remaining_credits = max(0, total_credits - credits_used)
    
    # Override stored values with calculated values
    company["total_credits"] = total_credits
    company["credits_used"] = credits_used
    company["remaining_credits"] = remaining_credits
    
    return company


@router.get("/{company_id}/credits")
async def get_company_credits(company_id: str, current_user: dict = Depends(get_current_user)):
    """Get meeting room credits information for a company - calculated from actual bookings"""
    check_permission(current_user, "view_invoice")
    
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Calculate credits from actual bookings
    total_seats = company.get("total_seats", 0)
    credits_per_seat = company.get("meeting_room_credits", 30)
    total_credits = company.get("total_credits", total_seats * credits_per_seat)
    
    # Dynamic calculation from bookings
    credits_used = await calculate_company_credits_from_bookings(
        company_id, 
        company.get("company_name")
    )
    remaining_credits = max(0, total_credits - credits_used)
    
    # Get recent bookings with calculated credits
    recent_bookings = await db.bookings.find(
        {
            "$or": [
                {"company_id": company_id},
                {"company_name": company.get("company_name")}
            ],
            "status": {"$ne": "cancelled"}
        },
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    # Calculate credits for each booking in case they don't have it stored
    for booking in recent_bookings:
        if not booking.get("credits_required") and not booking.get("credits_used"):
            duration = booking.get("duration_minutes", 0)
            room_name = (booking.get("room_name") or "").upper()
            if "CR" in room_name:
                booking["credits_calculated"] = int((duration / 60) * 20)
            else:
                booking["credits_calculated"] = int((duration / 30) * 5)
        else:
            booking["credits_calculated"] = booking.get("credits_required") or booking.get("credits_used", 0)
    
    return {
        "company_id": company_id,
        "company_name": company.get("company_name"),
        "total_seats": total_seats,
        "credits_per_seat": credits_per_seat,
        "total_credits": total_credits,
        "credits_used": credits_used,
        "remaining_credits": remaining_credits,
        "credits_reset_date": company.get("credits_reset_date"),
        "recent_bookings": recent_bookings
    }


@router.post("")
async def create_company(
    company_data: CompanyCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new company subscription"""
    check_permission(current_user, "create_invoice")
    
    # Check if company name already exists
    existing = await db.companies.find_one({"company_name": company_data.company_name})
    if existing:
        raise HTTPException(status_code=400, detail="Company with this name already exists")
    
    # Get plan details
    plan = await db.plan_types.find_one({"id": company_data.plan_type_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=400, detail="Invalid plan type")
    
    # Calculate totals
    total_rate = company_data.total_seats * company_data.rate_per_seat * (1 - company_data.discount_percent / 100)
    
    # Calculate total meeting room credits: total_seats × meeting_room_credits_per_seat
    total_credits = company_data.total_seats * company_data.meeting_room_credits
    
    company = Company(
        **company_data.model_dump(),
        plan_name=plan["name"],
        total_rate=total_rate,
        total_credits=total_credits,
        remaining_credits=total_credits,  # Initially, remaining = total
        credits_reset_date=datetime.now(timezone.utc).isoformat(),
        created_by=current_user.get("id")
    )
    
    await db.companies.insert_one(company.model_dump())
    return company.model_dump()


@router.put("/{company_id}")
async def update_company(
    company_id: str,
    company_data: CompanyUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update company subscription details"""
    check_permission(current_user, "create_invoice")
    
    existing = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Company not found")
    
    update_dict = {k: v for k, v in company_data.model_dump().items() if v is not None}
    
    # If plan, seats, or rate changed, recalculate totals
    if any(k in update_dict for k in ['plan_type_id', 'total_seats', 'rate_per_seat', 'discount_percent']):
        plan_id = update_dict.get('plan_type_id', existing['plan_type_id'])
        total_seats = update_dict.get('total_seats', existing['total_seats'])
        rate_per_seat = update_dict.get('rate_per_seat', existing['rate_per_seat'])
        discount = update_dict.get('discount_percent', existing['discount_percent'])
        
        # Get plan name if plan changed
        if 'plan_type_id' in update_dict:
            plan = await db.plan_types.find_one({"id": plan_id}, {"_id": 0})
            if plan:
                update_dict['plan_name'] = plan['name']
        
        update_dict['total_rate'] = total_seats * rate_per_seat * (1 - discount / 100)
    
    # If seats or meeting_room_credits changed, recalculate total_credits
    if any(k in update_dict for k in ['total_seats', 'meeting_room_credits']):
        total_seats = update_dict.get('total_seats', existing['total_seats'])
        credits_per_seat = update_dict.get('meeting_room_credits', existing.get('meeting_room_credits', 0))
        new_total_credits = total_seats * credits_per_seat
        
        # Calculate new remaining credits (adjust for any change in total)
        old_total_credits = existing.get('total_credits', 0)
        credits_used = existing.get('credits_used', 0)
        
        # If total credits increased, add the difference to remaining
        # If decreased, reduce remaining but not below 0
        credits_diff = new_total_credits - old_total_credits
        new_remaining = max(0, existing.get('remaining_credits', old_total_credits - credits_used) + credits_diff)
        
        update_dict['total_credits'] = new_total_credits
        update_dict['remaining_credits'] = new_remaining
    
    if update_dict:
        await db.companies.update_one({"id": company_id}, {"$set": update_dict})
    
    updated = await db.companies.find_one({"id": company_id}, {"_id": 0})
    return updated


@router.post("/{company_id}/terminate")
async def terminate_company(
    company_id: str,
    terminate_data: CompanyTerminate,
    current_user: dict = Depends(get_current_user)
):
    """Terminate a company subscription and all its members"""
    check_permission(current_user, "all")
    
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    if company["status"] == "terminated":
        raise HTTPException(status_code=400, detail="Company already terminated")
    
    # Update company status
    await db.companies.update_one(
        {"id": company_id},
        {"$set": {
            "status": "terminated",
            "end_date": terminate_data.end_date,
            "termination_reason": terminate_data.termination_reason,
            "has_outstanding_dues": terminate_data.has_outstanding_dues,
            "terminated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Deactivate all members under this company
    await db.members.update_many(
        {"company_id": company_id},
        {"$set": {"status": "inactive"}}
    )
    
    return {"message": f"Company '{company['company_name']}' terminated successfully"}


@router.post("/{company_id}/reactivate")
async def reactivate_company(company_id: str, current_user: dict = Depends(get_current_user)):
    """Reactivate a terminated company"""
    check_permission(current_user, "all")
    
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    if company["status"] != "terminated":
        raise HTTPException(status_code=400, detail="Company is not terminated")
    
    await db.companies.update_one(
        {"id": company_id},
        {"$set": {
            "status": "active",
            "end_date": None,
            "termination_reason": None,
            "has_outstanding_dues": False,
            "terminated_at": None
        }}
    )
    
    return {"message": f"Company '{company['company_name']}' reactivated"}


@router.delete("/{company_id}")
async def delete_company(company_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a company and all its members (permanent)"""
    check_permission(current_user, "all")
    
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Delete all members
    await db.members.delete_many({"company_id": company_id})
    
    # Delete company
    await db.companies.delete_one({"id": company_id})
    
    return {"message": f"Company '{company['company_name']}' deleted permanently"}


# ==================== MEMBER ROUTES (Under Company) ====================

@router.get("/{company_id}/members")
async def get_company_members(company_id: str, current_user: dict = Depends(get_current_user)):
    """Get all members under a company"""
    check_permission(current_user, "view_invoice")
    
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    members = await db.members.find({"company_id": company_id}, {"_id": 0}).to_list(100)
    return members


@router.post("/{company_id}/members")
async def add_member_to_company(
    company_id: str,
    member_data: CompanyMemberCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add a member to a company"""
    check_permission(current_user, "create_invoice")
    
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Check if email already exists
    existing = await db.members.find_one({"email": member_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Member with this email already exists")
    
    # Check seat availability
    current_members = await db.members.count_documents({"company_id": company_id, "status": "active"})
    if current_members >= company["total_seats"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Company has {company['total_seats']} seats, all occupied. Increase seats first."
        )
    
    # Check primary contact constraint
    if member_data.is_primary_contact:
        existing_primary = await db.members.find_one({
            "company_id": company_id, 
            "is_primary_contact": True,
            "status": "active"
        }, {"_id": 0})
        
        if existing_primary:
            if not member_data.replace_primary:
                # Return conflict response with existing primary info
                raise HTTPException(
                    status_code=409,
                    detail={
                        "message": "There is already a Primary Contact for this company.",
                        "existing_primary": {
                            "id": existing_primary["id"],
                            "name": existing_primary["name"],
                            "email": existing_primary["email"]
                        },
                        "options": ["skip", "replace"]
                    }
                )
            else:
                # Replace primary contact - remove primary status from existing
                await db.members.update_one(
                    {"id": existing_primary["id"]},
                    {"$set": {"is_primary_contact": False}}
                )
    
    # Create member with company reference
    member = Member(
        company_id=company_id,
        company_name=company["company_name"],
        name=member_data.name,
        email=member_data.email,
        phone=member_data.phone,
        aadhar_number=member_data.aadhar_number or "",
        pan_number=member_data.pan_number or "",
        date_of_birth=member_data.date_of_birth,
        seat_number=member_data.seat_number,
        is_primary_contact=member_data.is_primary_contact,
        notes=member_data.notes or "",
        # Legacy fields from company
        plan_type_id=company["plan_type_id"],
        plan_name=company["plan_name"],
        company_address=company["company_address"],
        company_gstin=company["company_gstin"],
        company_pan=company["company_pan"],
        gstin=company["company_gstin"],
        final_rate=company["total_rate"] / company["total_seats"],
        meeting_room_credits=company["meeting_room_credits"],
        start_date=company["start_date"],
        created_by=current_user.get("id")
    )
    
    await db.members.insert_one(member.model_dump())
    
    # Update company's seats_occupied count
    await db.companies.update_one(
        {"id": company_id},
        {"$set": {"seats_occupied": current_members + 1}}
    )
    
    return member.model_dump()


@router.put("/{company_id}/members/{member_id}")
async def update_member(
    company_id: str,
    member_id: str,
    member_data: CompanyMemberUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a member's details"""
    check_permission(current_user, "create_invoice")
    
    member = await db.members.find_one({"id": member_id, "company_id": company_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found in this company")
    
    update_dict = {k: v for k, v in member_data.model_dump().items() if v is not None and k != "replace_primary"}
    
    # Check if email is being changed and already exists
    if "email" in update_dict and update_dict["email"] != member["email"]:
        existing = await db.members.find_one({"email": update_dict["email"]})
        if existing:
            raise HTTPException(status_code=400, detail="Member with this email already exists")
    
    # Check primary contact constraint when setting is_primary_contact to True
    if update_dict.get("is_primary_contact") == True and not member.get("is_primary_contact"):
        existing_primary = await db.members.find_one({
            "company_id": company_id, 
            "is_primary_contact": True,
            "status": "active",
            "id": {"$ne": member_id}  # Exclude current member
        }, {"_id": 0})
        
        if existing_primary:
            if not member_data.replace_primary:
                # Return conflict response with existing primary info
                raise HTTPException(
                    status_code=409,
                    detail={
                        "message": "There is already a Primary Contact for this company.",
                        "existing_primary": {
                            "id": existing_primary["id"],
                            "name": existing_primary["name"],
                            "email": existing_primary["email"]
                        },
                        "options": ["skip", "replace"]
                    }
                )
            else:
                # Replace primary contact - remove primary status from existing
                await db.members.update_one(
                    {"id": existing_primary["id"]},
                    {"$set": {"is_primary_contact": False}}
                )
    
    if update_dict:
        await db.members.update_one({"id": member_id}, {"$set": update_dict})
    
    updated = await db.members.find_one({"id": member_id}, {"_id": 0})
    return updated


@router.delete("/{company_id}/members/{member_id}")
async def remove_member(
    company_id: str,
    member_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove a member from a company"""
    check_permission(current_user, "all")
    
    member = await db.members.find_one({"id": member_id, "company_id": company_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found in this company")
    
    # Delete member
    await db.members.delete_one({"id": member_id})
    
    # Update company's seats_occupied count
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if company:
        new_count = max(0, company.get("seats_occupied", 1) - 1)
        await db.companies.update_one({"id": company_id}, {"$set": {"seats_occupied": new_count}})
    
    # Remove member auth if exists
    await db.member_auth.delete_one({"member_id": member_id})
    
    return {"message": f"Member '{member['name']}' removed"}


# ==================== STATS ====================

@router.get("/stats/summary")
async def get_company_stats(current_user: dict = Depends(get_current_user)):
    """Get company subscription stats"""
    check_permission(current_user, "view_invoice")
    
    total_companies = await db.companies.count_documents({})
    active_companies = await db.companies.count_documents({"status": "active"})
    total_seats = 0
    occupied_seats = 0
    total_revenue = 0
    total_credits = 0
    
    async for company in db.companies.find({"status": "active"}, {"_id": 0}):
        total_seats += company.get("total_seats", 0)
        occupied_seats += company.get("seats_occupied", 0)
        total_revenue += company.get("total_rate", 0)
        total_credits += company.get("meeting_room_credits", 0)
    
    return {
        "total_companies": total_companies,
        "active_companies": active_companies,
        "total_seats": total_seats,
        "occupied_seats": occupied_seats,
        "available_seats": total_seats - occupied_seats,
        "monthly_revenue": total_revenue,
        "total_credits": total_credits
    }
