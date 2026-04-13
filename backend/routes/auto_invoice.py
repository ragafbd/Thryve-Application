"""
Auto Invoice Generation Routes
Generate invoices for all active members and store PDFs
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field
import uuid
import base64

from utils.pdf_generator import generate_pdf_from_html

router = APIRouter(prefix="/api/auto-invoice", tags=["Auto Invoice"])
security = HTTPBearer()

db = None
_get_current_user_func = None
_check_permission_func = None

COMPANY_DETAILS = {
    "name": "Thryve Coworking",
    "address": "123 Business Park, Tech Hub",
    "city": "Bangalore",
    "state": "Karnataka",
    "pincode": "560001",
    "gstin": "29XXXXX1234X1ZX",
    "pan": "XXXXX1234X",
    "email": "contact@thryvecoworking.in",
    "phone": "+91 98765 43210"
}

GST_RATE = 18
CREDIT_VALUE = 50
CREDITS_PER_SEAT_DEFAULT = 30

MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]


def init_router(database, auth_func, perm_func, company_details=None):
    global db, _get_current_user_func, _check_permission_func, COMPANY_DETAILS
    db = database
    _get_current_user_func = auth_func
    _check_permission_func = perm_func
    if company_details:
        COMPANY_DETAILS = company_details


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if _get_current_user_func is None:
        raise HTTPException(status_code=500, detail="Auth not initialized")
    return await _get_current_user_func(credentials)


def check_permission(user: dict, permission: str):
    return _check_permission_func(user, permission)


# ─── Pydantic Models ───

class AutoInvoiceRequest(BaseModel):
    billing_month: str
    include_members: Optional[List[str]] = None
    notes: Optional[str] = ""


class AutoInvoiceResult(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    billing_month: str
    total_invoices: int = 0
    successful: int = 0
    failed: int = 0
    total_amount: float = 0
    invoices: List[dict] = []
    errors: List[dict] = []
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    created_by: Optional[str] = None


# ─── Pure Helper Functions ───

def number_to_words(num):
    """Convert number to words (Indian format)"""
    if num == 0:
        return "Zero"
    ones = [
        "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
        "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
        "Eighteen", "Nineteen"
    ]
    tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

    def convert_less_than_thousand(n):
        if n == 0:
            return ""
        if n < 20:
            return ones[n]
        if n < 100:
            return tens[n // 10] + (" " + ones[n % 10] if n % 10 != 0 else "")
        return ones[n // 100] + " Hundred" + (" " + convert_less_than_thousand(n % 100) if n % 100 != 0 else "")

    def convert(n):
        if n == 0:
            return ""
        result = ""
        if n >= 10000000:
            result += convert_less_than_thousand(n // 10000000) + " Crore "
            n %= 10000000
        if n >= 100000:
            result += convert_less_than_thousand(n // 100000) + " Lakh "
            n %= 100000
        if n >= 1000:
            result += convert_less_than_thousand(n // 1000) + " Thousand "
            n %= 1000
        if n > 0:
            result += convert_less_than_thousand(n)
        return result.strip()

    return "Rupees " + convert(int(num)) + " Only"


async def generate_invoice_number(company_name: str = "", invoice_date: str = None):
    """Generate invoice number in format: YYYY-YYYY/MM/NNN/CompanyName"""
    if invoice_date:
        try:
            date_obj = datetime.strptime(invoice_date.split('T')[0], "%Y-%m-%d")
        except (ValueError, AttributeError):
            date_obj = datetime.now(timezone.utc)
    else:
        date_obj = datetime.now(timezone.utc)

    if date_obj.month >= 4:
        fy_start_year = date_obj.year
        fy_end_year = date_obj.year + 1
    else:
        fy_start_year = date_obj.year - 1
        fy_end_year = date_obj.year

    fy_prefix = f"{fy_start_year}-{fy_end_year}"
    month_num = f"{date_obj.month:02d}"

    fy_pattern = f"^{fy_prefix}/"
    latest = await db.invoices.find_one(
        {"invoice_number": {"$regex": fy_pattern}},
        {"invoice_number": 1},
        sort=[("created_at", -1), ("invoice_number", -1)]
    )

    next_num = 1
    if latest:
        try:
            parts = latest["invoice_number"].split("/")
            if len(parts) >= 3:
                next_num = int(parts[2]) + 1
        except (ValueError, IndexError):
            pass

    clean_company = company_name.strip()[:30].strip()
    return f"{fy_prefix}/{month_num}/{next_num:03d}/{clean_company}"


# ─── Extracted Sub-functions for generate_auto_invoices ───

async def _filter_eligible_companies(companies, billing_date, billing_month):
    """Filter companies by start_date eligibility and skip those with existing invoices."""
    eligible = []
    skipped = []
    for company in companies:
        start_date_str = company.get("start_date")
        if start_date_str:
            try:
                start_date = datetime.strptime(start_date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                if start_date > billing_date:
                    skipped.append({
                        "company_id": company["id"],
                        "company_name": company["company_name"],
                        "start_date": start_date_str,
                        "reason": f"Start date ({start_date_str}) is after billing period ({billing_month})"
                    })
                    continue
            except ValueError:
                pass
        eligible.append(company)
    return eligible, skipped


async def _calculate_meeting_room_charges(company, invoice_id):
    """Calculate meeting room charges from un-invoiced bookings. Returns (line_item_or_None, bookings_list)."""
    all_bookings = await db.bookings.find({
        "$or": [
            {"company_id": company["id"]},
            {"company_name": company["company_name"]}
        ],
        "status": {"$ne": "cancelled"},
        "payment_status": {"$nin": ["paid", "completed", "invoiced"]}
    }, {"_id": 0}).to_list(1000)

    if not all_bookings:
        return None, []

    total_credits_used = 0
    for b in all_bookings:
        if b.get("credits_required"):
            total_credits_used += b["credits_required"]
        else:
            duration = b.get("duration_minutes", 0)
            room_name = (b.get("room_name") or "").upper()
            if "CR" in room_name:
                total_credits_used += int((duration / 60) * 20)
            else:
                total_credits_used += int((duration / 30) * 5)

    total_seats = company.get("total_seats", 0)
    credits_per_seat = company.get("meeting_room_credits", CREDITS_PER_SEAT_DEFAULT)
    total_allocated = company.get("total_credits", total_seats * credits_per_seat)

    billable_credits = max(0, total_credits_used - total_allocated)
    if billable_credits == 0:
        # Mark bookings as invoiced even if no excess charges
        for booking in all_bookings:
            await db.bookings.update_one(
                {"id": booking.get("id")},
                {"$set": {"payment_status": "invoiced", "invoice_id": invoice_id}}
            )
        return None, all_bookings

    amount = billable_credits * CREDIT_VALUE
    mr_cgst = round(amount * (GST_RATE / 2) / 100, 2)
    mr_sgst = round(amount * (GST_RATE / 2) / 100, 2)

    line_item = {
        "description": f"Meeting Room Usage Charges ({billable_credits} excess credits @ Rs.{CREDIT_VALUE}/credit)",
        "service_type": "meeting_room",
        "quantity": billable_credits,
        "rate": CREDIT_VALUE,
        "is_taxable": True,
        "hsn_sac": "997212",
        "unit": "Credits",
        "is_prorated": False,
        "prorate_days": 0,
        "prorate_total_days": 0,
        "amount": amount,
        "cgst": mr_cgst,
        "sgst": mr_sgst,
        "total": amount + mr_cgst + mr_sgst,
        "booking_ids": [b.get("id") for b in all_bookings],
        "total_credits_used": total_credits_used,
        "total_allocated_credits": total_allocated,
        "billable_credits": billable_credits,
        "credit_value": CREDIT_VALUE,
        "order": 99
    }

    for booking in all_bookings:
        await db.bookings.update_one(
            {"id": booking.get("id")},
            {"$set": {"payment_status": "invoiced", "invoice_id": invoice_id}}
        )

    return line_item, all_bookings


def _build_monthly_line_item(company, year, month):
    """Build the monthly plan fee line item."""
    rate = company.get("total_rate", 0)
    cgst = round(rate * (GST_RATE / 2) / 100, 2)
    sgst = round(rate * (GST_RATE / 2) / 100, 2)
    return {
        "description": f"{company.get('plan_name', 'Workspace')} - {MONTH_NAMES[month - 1]} {year}",
        "service_type": "monthly_rental",
        "quantity": company.get("total_seats", 1),
        "rate": company.get("rate_per_seat", rate),
        "is_taxable": True,
        "hsn_sac": "997212",
        "unit": "month",
        "is_prorated": False,
        "prorate_days": 0,
        "prorate_total_days": 0,
        "amount": rate,
        "cgst": cgst,
        "sgst": sgst,
        "total": rate + cgst + sgst,
        "order": 1
    }, rate, cgst, sgst


def _build_invoice_document(invoice_id, invoice_number, invoice_date, due_date, billing_month,
                            company, line_items, totals, notes):
    """Assemble the final invoice dict ready for DB insertion."""
    subtotal, total_cgst, total_sgst = totals
    calculated_total = round(subtotal + total_cgst + total_sgst, 2)
    rounded_total = round(calculated_total)
    round_off = round(rounded_total - calculated_total, 2)

    client_data = {
        "id": company["id"],
        "name": company.get("signatory_name", company["company_name"]),
        "email": company.get("signatory_email", ""),
        "company_name": company["company_name"],
        "address": company.get("company_address", ""),
        "gstin": company.get("company_gstin", ""),
        "phone": company.get("signatory_phone", "")
    }

    line_items.sort(key=lambda x: x.get("order", 50))

    return {
        "id": invoice_id,
        "invoice_number": invoice_number,
        "invoice_date": invoice_date,
        "due_date": due_date,
        "billing_month": billing_month,
        "client": client_data,
        "company": COMPANY_DETAILS,
        "line_items": line_items,
        "subtotal": round(subtotal, 2),
        "total_cgst": round(total_cgst, 2),
        "total_sgst": round(total_sgst, 2),
        "total_tax": round(total_cgst + total_sgst, 2),
        "round_off_adjustment": round_off,
        "grand_total": rounded_total,
        "notes": notes,
        "status": "pending",
        "auto_generated": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }, rounded_total


def _attach_pdf(invoice, company_name):
    """Generate PDF and attach base64 data to invoice dict."""
    pdf_content = generate_pdf_from_html(invoice)
    pdf_base64 = base64.b64encode(pdf_content).decode('utf-8')
    invoice["pdf_generated"] = True
    invoice["pdf_data"] = pdf_base64
    invoice["pdf_filename"] = f"{invoice['invoice_number'].replace('/', '_')}_{company_name.replace(' ', '_')}.pdf"
    return pdf_content


# ─── Main Route Handler ───

@router.post("/generate")
async def generate_auto_invoices(
    request: AutoInvoiceRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Generate invoices for all active companies for a billing month."""
    check_permission(current_user, "all")

    try:
        year, month = map(int, request.billing_month.split('-'))
        billing_date = datetime(year, month, 1, tzinfo=timezone.utc)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid billing_month format. Use YYYY-MM")

    query = {"status": "active"}
    if request.include_members:
        query["id"] = {"$in": request.include_members}

    companies = await db.companies.find(query, {"_id": 0}).to_list(1000)
    if not companies:
        raise HTTPException(status_code=404, detail="No active companies found")

    eligible_companies, skipped_companies = await _filter_eligible_companies(
        companies, billing_date, request.billing_month
    )

    if not eligible_companies:
        return {
            "message": "No companies eligible for invoice generation",
            "result": {
                "billing_month": request.billing_month,
                "total_invoices": 0, "successful": 0, "failed": 0,
                "total_amount": 0, "invoices": [], "errors": [],
                "skipped_companies": skipped_companies
            }
        }

    result = AutoInvoiceResult(
        billing_month=request.billing_month,
        total_invoices=len(eligible_companies),
        created_by=current_user.get("id")
    )

    invoice_date = billing_date.isoformat()
    due_date = (billing_date + timedelta(days=4)).isoformat()

    for company in eligible_companies:
        try:
            existing = await db.invoices.find_one({
                "client.id": company["id"],
                "billing_month": request.billing_month
            })
            if existing:
                result.errors.append({
                    "company_id": company["id"],
                    "company_name": company["company_name"],
                    "error": f"Invoice already exists for {request.billing_month}"
                })
                result.failed += 1
                continue

            invoice_id = str(uuid.uuid4())
            company_name = company.get("company_name", "")
            invoice_number = await generate_invoice_number(company_name, invoice_date)

            # Build line items
            monthly_item, base_subtotal, base_cgst, base_sgst = _build_monthly_line_item(company, year, month)
            line_items = [monthly_item]
            total_subtotal, total_cgst, total_sgst = base_subtotal, base_cgst, base_sgst

            # Meeting room charges
            mr_item, all_bookings = await _calculate_meeting_room_charges(company, invoice_id)
            if mr_item:
                line_items.append(mr_item)
                total_subtotal += mr_item["amount"]
                total_cgst += mr_item["cgst"]
                total_sgst += mr_item["sgst"]

            notes = request.notes or f"Auto-generated invoice for {MONTH_NAMES[month - 1]} {year}"
            invoice, rounded_total = _build_invoice_document(
                invoice_id, invoice_number, invoice_date, due_date, request.billing_month,
                company, line_items, (total_subtotal, total_cgst, total_sgst), notes
            )

            _attach_pdf(invoice, company_name)
            await db.invoices.insert_one(invoice)

            result.successful += 1
            result.total_amount += rounded_total
            result.invoices.append({
                "invoice_id": invoice_id,
                "invoice_number": invoice_number,
                "company_id": company["id"],
                "company_name": company_name,
                "amount": rounded_total,
                "meeting_room_charges": len(all_bookings) if all_bookings else 0,
                "pdf_filename": invoice["pdf_filename"]
            })

        except Exception as e:
            result.errors.append({
                "company_id": company.get("id", "unknown"),
                "company_name": company.get("company_name", "unknown"),
                "error": str(e)
            })
            result.failed += 1

    result_dict = result.model_dump()
    result_dict["skipped_companies"] = skipped_companies
    await db.auto_invoice_runs.insert_one(result_dict)
    result_dict.pop("_id", None)

    skip_msg = f" ({len(skipped_companies)} companies skipped due to start date)" if skipped_companies else ""
    return {
        "message": f"Generated {result.successful} invoices successfully{skip_msg}",
        "result": result_dict
    }


# ─── Other Routes ───

@router.get("/runs")
async def get_auto_invoice_runs(current_user: dict = Depends(get_current_user)):
    """Get history of auto-invoice generation runs"""
    check_permission(current_user, "view_invoice")
    runs = await db.auto_invoice_runs.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return runs


@router.delete("/runs/{run_id}")
async def delete_auto_invoice_run(run_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an auto-invoice generation run and optionally its associated invoices"""
    check_permission(current_user, "all")
    run = await db.auto_invoice_runs.find_one({"id": run_id}, {"_id": 0})
    if not run:
        raise HTTPException(status_code=404, detail="Auto-invoice run not found")

    invoice_ids = run.get("invoice_ids", [])
    deleted_invoices = 0
    if invoice_ids:
        result = await db.invoices.delete_many({"id": {"$in": invoice_ids}})
        deleted_invoices = result.deleted_count

    await db.auto_invoice_runs.delete_one({"id": run_id})
    return {"message": "Auto-invoice run deleted successfully", "run_id": run_id, "deleted_invoices": deleted_invoices}


@router.delete("/runs")
async def delete_all_auto_invoice_runs(current_user: dict = Depends(get_current_user)):
    """Delete all auto-invoice generation runs and their associated invoices"""
    check_permission(current_user, "all")
    runs = await db.auto_invoice_runs.find({}, {"_id": 0}).to_list(1000)

    all_invoice_ids = []
    for run in runs:
        all_invoice_ids.extend(run.get("invoice_ids", []))

    deleted_invoices = 0
    if all_invoice_ids:
        result = await db.invoices.delete_many({"id": {"$in": all_invoice_ids}})
        deleted_invoices = result.deleted_count

    result = await db.auto_invoice_runs.delete_many({})
    return {"message": "All auto-invoice runs deleted successfully", "deleted_runs": result.deleted_count, "deleted_invoices": deleted_invoices}


@router.get("/invoice/{invoice_id}/pdf")
async def download_auto_generated_pdf(invoice_id: str):
    """Download PDF for an auto-generated invoice"""
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if not invoice.get("pdf_data"):
        raise HTTPException(status_code=404, detail="PDF not found for this invoice")

    pdf_content = base64.b64decode(invoice["pdf_data"])
    filename = invoice.get("pdf_filename", f"invoice_{invoice_id}.pdf")

    from fastapi.responses import Response
    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Content-Length": str(len(pdf_content))
        }
    )


@router.get("/preview/{member_id}")
async def preview_member_invoice(
    member_id: str,
    billing_month: str,
    current_user: dict = Depends(get_current_user)
):
    """Preview what an invoice would look like for a member"""
    check_permission(current_user, "view_invoice")
    member = await db.members.find_one({"id": member_id}, {"_id": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    try:
        year, month = map(int, billing_month.split('-'))
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid billing_month format")

    rate = member.get("final_rate", 0)
    cgst = round(rate * (GST_RATE / 2) / 100, 2)
    sgst = round(rate * (GST_RATE / 2) / 100, 2)

    return {
        "member": {
            "id": member["id"],
            "name": member["name"],
            "company": member.get("company_name", ""),
            "plan": member.get("plan_name", "")
        },
        "billing_month": billing_month,
        "description": f"{member.get('plan_name', 'Workspace')} - {MONTH_NAMES[month - 1]} {year}",
        "rate": rate,
        "cgst": cgst,
        "sgst": sgst,
        "total": rate + cgst + sgst
    }
