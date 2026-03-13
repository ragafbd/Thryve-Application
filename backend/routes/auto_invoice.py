"""
Auto Invoice Generation Routes
Generate invoices for all active members and store PDFs
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field
from io import BytesIO
import uuid
import base64

# PDF generation imports
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.units import inch

router = APIRouter(prefix="/api/auto-invoice", tags=["Auto Invoice"])
security = HTTPBearer()

# Database reference - will be set by init
db = None
_get_current_user_func = None
_check_permission_func = None

# Company details
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

GST_RATE = 18  # 18% GST (9% CGST + 9% SGST)

def init_router(database, auth_func, perm_func, company_details=None):
    """Initialize router with database and auth functions"""
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


# Models
class AutoInvoiceRequest(BaseModel):
    billing_month: str  # YYYY-MM format
    include_members: Optional[List[str]] = None  # Specific member IDs, or None for all active
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


# Helper functions
async def generate_invoice_number(company_name: str = ""):
    """
    Generate invoice number in format: YY-YY/Mon/NNN/CompanyName
    - YY-YY: Financial year (April to March), e.g., 26-27
    - Mon: Month abbreviation (Apr, May, etc.)
    - NNN: Sequential number, resets each financial year
    - CompanyName: Client company name for easy identification
    """
    now = datetime.now(timezone.utc)
    
    # Determine financial year (April to March)
    if now.month >= 4:  # April onwards
        fy_start_year = now.year
        fy_end_year = now.year + 1
    else:  # Jan-Mar
        fy_start_year = now.year - 1
        fy_end_year = now.year
    
    # Format: 26-27 for FY 2026-2027
    fy_prefix = f"{fy_start_year % 100:02d}-{fy_end_year % 100:02d}"
    
    # Month abbreviation
    month_abbr = now.strftime("%b")  # Apr, May, Jun, etc.
    
    # Find the highest sequence number for this financial year
    fy_pattern = f"^{fy_prefix}/"
    latest = await db.invoices.find_one(
        {"invoice_number": {"$regex": fy_pattern}},
        {"invoice_number": 1},
        sort=[("created_at", -1), ("invoice_number", -1)]
    )
    
    if latest:
        try:
            parts = latest["invoice_number"].split("/")
            if len(parts) >= 3:
                last_num = int(parts[2])
                next_num = last_num + 1
            else:
                next_num = 1
        except:
            next_num = 1
    else:
        next_num = 1
    
    # Clean company name for invoice number
    clean_company = company_name.strip()
    if len(clean_company) > 30:
        clean_company = clean_company[:30].strip()
    
    # Format: 26-27/Apr/001/Company Name
    return f"{fy_prefix}/{month_abbr}/{next_num:03d}/{clean_company}"


def number_to_words(num):
    """Convert number to words (Indian format)"""
    if num == 0:
        return "Zero"
    
    ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
        "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
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
    
    int_part = int(num)
    return "Rupees " + convert(int_part) + " Only"


def generate_pdf_content(invoice: dict) -> bytes:
    """Generate PDF content for an invoice"""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
    
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='InvoiceTitle', fontSize=18, fontName='Helvetica-Bold', alignment=TA_RIGHT))
    styles.add(ParagraphStyle(name='CompanyName', fontSize=14, fontName='Helvetica-Bold', textColor=colors.HexColor('#2E375B')))
    styles.add(ParagraphStyle(name='Normal_Right', fontSize=10, alignment=TA_RIGHT))
    styles.add(ParagraphStyle(name='Normal_Center', fontSize=10, alignment=TA_CENTER))
    styles.add(ParagraphStyle(name='Small', fontSize=8, textColor=colors.grey))
    styles.add(ParagraphStyle(name='SmallBold', fontSize=9, fontName='Helvetica-Bold'))
    styles.add(ParagraphStyle(name='TableHeader', fontSize=9, fontName='Helvetica-Bold', textColor=colors.white))
    styles.add(ParagraphStyle(name='Footer', fontSize=8, alignment=TA_CENTER, textColor=colors.grey))
    styles.add(ParagraphStyle(name='ThankYou', fontSize=10, fontName='Helvetica-Bold', alignment=TA_CENTER, textColor=colors.HexColor('#2E375B')))
    
    elements = []
    thryve_blue = colors.HexColor('#2E375B')
    thryve_orange = colors.HexColor('#FFA14A')
    
    company = invoice.get('company', COMPANY_DETAILS)
    client = invoice.get('client', {})
    
    # Header
    header_data = [
        [Paragraph(f"<b>{company.get('name', 'Thryve Coworking')}</b>", styles['CompanyName']), 
         Paragraph("<b>TAX INVOICE</b>", styles['InvoiceTitle'])]
    ]
    header_table = Table(header_data, colWidths=[350, 180])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 10))
    
    # Format date helper
    def format_date(date_str):
        if not date_str:
            return "-"
        try:
            date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            day = date_obj.day
            months = ["January", "February", "March", "April", "May", "June", 
                "July", "August", "September", "October", "November", "December"]
            def get_ordinal(n):
                if n > 3 and n < 21:
                    return 'th'
                remainder = n % 10
                if remainder == 1:
                    return 'st'
                elif remainder == 2:
                    return 'nd'
                elif remainder == 3:
                    return 'rd'
                else:
                    return 'th'
            return f"{months[date_obj.month - 1]} {day}{get_ordinal(day)}, {date_obj.year}"
        except:
            return date_str
    
    # Invoice info
    invoice_info = f"""
    <b>Invoice No:</b> {invoice.get('invoice_number', '')}<br/>
    <b>Invoice Date:</b> {format_date(invoice.get('invoice_date', ''))}<br/>
    """
    
    due_date_text = ""
    if invoice.get('due_date'):
        due_date_text = f"<b>PAYMENT DUE BY</b><br/><font size='12'><b>{format_date(invoice.get('due_date'))}</b></font>"
    
    info_data = [[Paragraph(invoice_info, styles['Normal']), Paragraph(due_date_text, styles['Normal_Right'])]]
    info_table = Table(info_data, colWidths=[350, 180])
    info_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BACKGROUND', (1, 0), (1, 0), thryve_orange),
        ('TEXTCOLOR', (1, 0), (1, 0), thryve_blue),
        ('ALIGN', (1, 0), (1, 0), 'CENTER'),
        ('TOPPADDING', (1, 0), (1, 0), 8),
        ('BOTTOMPADDING', (1, 0), (1, 0), 8),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 15))
    
    # Bill To / Issued By
    issued_by = f"""
    <b>Issued By:</b><br/>
    {company.get('name', '')}<br/>
    {company.get('address', '')}<br/>
    {company.get('city', '')}, {company.get('state', '')} - {company.get('pincode', '')}<br/>
    <b>GSTIN:</b> {company.get('gstin', '')}<br/>
    <b>PAN:</b> {company.get('pan', '')}
    """
    
    bill_to = f"""
    <b>Bill To:</b><br/>
    {client.get('name', '')}<br/>
    {client.get('company_name', '')}<br/>
    {client.get('company_address', '') or client.get('address', '')}<br/>
    <b>GSTIN:</b> {client.get('gstin', 'N/A')}
    """
    
    party_data = [[Paragraph(issued_by, styles['Normal']), Paragraph(bill_to, styles['Normal'])]]
    party_table = Table(party_data, colWidths=[265, 265])
    party_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.grey),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(party_table)
    elements.append(Spacer(1, 20))
    
    # Line items table
    table_data = [["#", "Description", "HSN/SAC", "Qty", "Rate", "Amount"]]
    
    for idx, item in enumerate(invoice.get('line_items', []), 1):
        table_data.append([
            str(idx),
            item.get('description', ''),
            item.get('hsn_sac', '998311'),
            str(item.get('quantity', 1)),
            f"₹{item.get('rate', 0):,.2f}",
            f"₹{item.get('amount', 0):,.2f}"
        ])
    
    items_table = Table(table_data, colWidths=[30, 220, 60, 40, 80, 100])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), thryve_blue),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('ALIGN', (1, 1), (1, -1), 'LEFT'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8F9FA')]),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 15))
    
    # Totals
    subtotal = invoice.get('subtotal', 0)
    total_cgst = invoice.get('total_cgst', 0)
    total_sgst = invoice.get('total_sgst', 0)
    grand_total = invoice.get('grand_total', 0)
    
    totals_data = [
        ["", "", "", "Subtotal:", f"₹{subtotal:,.2f}"],
        ["", "", "", f"CGST ({GST_RATE//2}%):", f"₹{total_cgst:,.2f}"],
        ["", "", "", f"SGST ({GST_RATE//2}%):", f"₹{total_sgst:,.2f}"],
        ["", "", "", "Grand Total:", f"₹{grand_total:,.2f}"],
    ]
    
    totals_table = Table(totals_data, colWidths=[30, 220, 60, 120, 100])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (3, 0), (3, -1), 'RIGHT'),
        ('ALIGN', (4, 0), (4, -1), 'RIGHT'),
        ('FONTNAME', (3, -1), (4, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LINEABOVE', (3, -1), (4, -1), 1, thryve_blue),
        ('BACKGROUND', (3, -1), (4, -1), thryve_orange),
    ]))
    elements.append(totals_table)
    elements.append(Spacer(1, 10))
    
    # Amount in words
    amount_words = number_to_words(int(grand_total))
    elements.append(Paragraph(f"<b>Amount in Words:</b> {amount_words}", styles['Normal']))
    elements.append(Spacer(1, 20))
    
    # Notes
    if invoice.get('notes'):
        elements.append(Paragraph(f"<b>Notes:</b> {invoice.get('notes')}", styles['Normal']))
        elements.append(Spacer(1, 15))
    
    # Footer
    elements.append(Paragraph("Thank you for your business!", styles['ThankYou']))
    elements.append(Spacer(1, 10))
    elements.append(Paragraph(f"For any queries, please contact {COMPANY_DETAILS.get('email', 'contact@thryvecoworking.in')}", styles['Footer']))
    
    doc.build(elements)
    return buffer.getvalue()


# ==================== API ROUTES ====================

@router.post("/generate")
async def generate_auto_invoices(
    request: AutoInvoiceRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Generate invoices for all active companies for a billing month"""
    check_permission(current_user, "all")
    
    # Parse billing month
    try:
        year, month = map(int, request.billing_month.split('-'))
        billing_date = datetime(year, month, 1, tzinfo=timezone.utc)
    except:
        raise HTTPException(status_code=400, detail="Invalid billing_month format. Use YYYY-MM")
    
    # Get active companies instead of members
    query = {"status": "active"}
    if request.include_members:  # This is now include_companies
        query["id"] = {"$in": request.include_members}
    
    companies = await db.companies.find(query, {"_id": 0}).to_list(1000)
    
    if not companies:
        raise HTTPException(status_code=404, detail="No active companies found")
    
    # Filter companies based on start_date
    # Only include companies whose start_date is on or before the invoice issue date
    eligible_companies = []
    skipped_companies = []
    
    for company in companies:
        start_date_str = company.get("start_date")
        if start_date_str:
            try:
                # Parse start_date (expecting YYYY-MM-DD format)
                start_date = datetime.strptime(start_date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                
                # Check if start_date is after the billing period start
                if start_date > billing_date:
                    skipped_companies.append({
                        "company_id": company["id"],
                        "company_name": company["company_name"],
                        "start_date": start_date_str,
                        "reason": f"Start date ({start_date_str}) is after billing period ({request.billing_month})"
                    })
                    continue
            except ValueError:
                # If date parsing fails, include the company anyway
                pass
        
        eligible_companies.append(company)
    
    if not eligible_companies:
        return {
            "message": "No companies eligible for invoice generation",
            "result": {
                "billing_month": request.billing_month,
                "total_invoices": 0,
                "successful": 0,
                "failed": 0,
                "total_amount": 0,
                "invoices": [],
                "errors": [],
                "skipped_companies": skipped_companies
            }
        }
    
    # Initialize result
    result = AutoInvoiceResult(
        billing_month=request.billing_month,
        total_invoices=len(eligible_companies),
        created_by=current_user.get("id")
    )
    
    # Calculate dates
    invoice_date = billing_date.isoformat()
    
    # Due date: 4 days after invoice issue date
    due_date_obj = billing_date + timedelta(days=4)
    due_date = due_date_obj.isoformat()
    
    # Month name for description
    month_names = ["January", "February", "March", "April", "May", "June",
                   "July", "August", "September", "October", "November", "December"]
    month_name = month_names[month - 1]
    
    for company in eligible_companies:
        try:
            # Check if invoice already exists for this company and month
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
            
            # Generate invoice number with company name
            company_name = company.get("company_name", "")
            invoice_number = await generate_invoice_number(company_name)
            
            # Calculate amounts - use total_rate from company
            rate = company.get("total_rate", 0)
            cgst = round(rate * (GST_RATE / 2) / 100, 2)
            sgst = round(rate * (GST_RATE / 2) / 100, 2)
            total = rate + cgst + sgst
            
            # Generate invoice ID first (needed for booking references)
            invoice_id = str(uuid.uuid4())
            
            # Create line items list - Monthly Plan first (order: 1)
            line_items = []
            
            # 1. Monthly Plan Fee (always first)
            monthly_item = {
                "description": f"{company.get('plan_name', 'Workspace')} - {month_name} {year}",
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
                "total": total,
                "order": 1
            }
            line_items.append(monthly_item)
            
            # Track totals
            total_subtotal = rate
            total_cgst_sum = cgst
            total_sgst_sum = sgst
            
            # 2. CREDIT-BASED MEETING ROOM BILLING
            # 1 Credit = Rs. 50
            # Conference Room: 20 credits/hour
            # Meeting Room: 5 credits/30-min slot
            CREDIT_VALUE = 50
            CREDITS_PER_SEAT = 30
            
            # Get ALL confirmed bookings for this company that haven't been invoiced
            all_bookings = await db.bookings.find({
                "$or": [
                    {"company_id": company["id"]},
                    {"company_name": company["company_name"]}
                ],
                "status": {"$ne": "cancelled"},
                "payment_status": {"$nin": ["paid", "completed", "invoiced"]}
            }, {"_id": 0}).to_list(1000)
            
            if all_bookings:
                # Calculate TOTAL credits used from all bookings
                total_credits_used = 0
                for b in all_bookings:
                    if b.get("credits_required"):
                        total_credits_used += b.get("credits_required", 0)
                    else:
                        # Legacy: Convert from minutes to credits
                        duration = b.get("duration_minutes", 0)
                        room_name = b.get("room_name", "").upper()
                        if "CR" in room_name:  # Conference Room: 20 credits/hour
                            credits = (duration / 60) * 20
                        else:  # Meeting Room: 5 credits/30 min
                            credits = (duration / 30) * 5
                        total_credits_used += int(credits)
                
                # Get TOTAL allocated credits for this company
                total_seats = company.get("total_seats", 0)
                credits_per_seat = company.get("meeting_room_credits", CREDITS_PER_SEAT)
                total_allocated_credits = company.get("total_credits", total_seats * credits_per_seat)
                
                # Calculate billable credits (excess over allocated)
                if total_credits_used <= total_allocated_credits:
                    billable_credits = 0
                    total_meeting_room_amount = 0
                else:
                    billable_credits = total_credits_used - total_allocated_credits
                    total_meeting_room_amount = billable_credits * CREDIT_VALUE
                
                # Only add meeting room line item if there are excess credits
                if billable_credits > 0:
                    meeting_room_cgst = round(total_meeting_room_amount * (GST_RATE / 2) / 100, 2)
                    meeting_room_sgst = round(total_meeting_room_amount * (GST_RATE / 2) / 100, 2)
                    
                    # Create a single bundled meeting room line item (Credit-based)
                    meeting_item = {
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
                        "amount": total_meeting_room_amount,
                        "cgst": meeting_room_cgst,
                        "sgst": meeting_room_sgst,
                        "total": total_meeting_room_amount + meeting_room_cgst + meeting_room_sgst,
                        "booking_ids": [b.get("id") for b in all_bookings],
                        "total_credits_used": total_credits_used,
                        "total_allocated_credits": total_allocated_credits,
                        "billable_credits": billable_credits,
                        "credit_value": CREDIT_VALUE,
                        "order": 99  # Always last
                    }
                    line_items.append(meeting_item)
                    
                    # Add to totals
                    total_subtotal += total_meeting_room_amount
                    total_cgst_sum += meeting_room_cgst
                    total_sgst_sum += meeting_room_sgst
                
                # Mark all bookings as included in invoice (regardless of charges)
                for booking in all_bookings:
                    await db.bookings.update_one(
                        {"id": booking.get("id")},
                        {"$set": {"payment_status": "invoiced", "invoice_id": invoice_id}}
                    )
            
            # Sort line items by order
            line_items.sort(key=lambda x: x.get("order", 50))
            
            # Calculate grand total with GST-compliant rounding
            calculated_total = round(total_subtotal + total_cgst_sum + total_sgst_sum, 2)
            
            # GST-compliant rounding: Round final total to nearest whole rupee
            rounded_total = round(calculated_total)
            round_off_adjustment = round(rounded_total - calculated_total, 2)
            
            # Create client object from company
            client_data = {
                "id": company["id"],
                "name": company.get("signatory_name", company["company_name"]),
                "email": company.get("signatory_email", ""),
                "company_name": company["company_name"],
                "address": company.get("company_address", ""),
                "gstin": company.get("company_gstin", ""),
                "phone": company.get("signatory_phone", "")
            }
            
            # Create invoice
            invoice = {
                "id": invoice_id,
                "invoice_number": invoice_number,
                "invoice_date": invoice_date,
                "due_date": due_date,
                "billing_month": request.billing_month,
                "client": client_data,
                "company": COMPANY_DETAILS,
                "line_items": line_items,
                "subtotal": round(total_subtotal, 2),
                "total_cgst": round(total_cgst_sum, 2),
                "total_sgst": round(total_sgst_sum, 2),
                "total_tax": round(total_cgst_sum + total_sgst_sum, 2),
                "round_off_adjustment": round_off_adjustment,
                "grand_total": rounded_total,
                "notes": request.notes or f"Auto-generated invoice for {month_name} {year}",
                "status": "pending",
                "auto_generated": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Generate PDF
            pdf_content = generate_pdf_content(invoice)
            pdf_base64 = base64.b64encode(pdf_content).decode('utf-8')
            
            # Store PDF reference
            invoice["pdf_generated"] = True
            invoice["pdf_data"] = pdf_base64
            invoice["pdf_filename"] = f"{invoice_number.replace('/', '_')}_{company_name.replace(' ', '_')}.pdf"
            
            # Save invoice
            await db.invoices.insert_one(invoice)
            
            # Add to result
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
    
    # Add skipped companies to the result
    result_dict = result.model_dump()
    result_dict["skipped_companies"] = skipped_companies
    
    # Save generation result
    await db.auto_invoice_runs.insert_one(result_dict)
    
    # Remove MongoDB _id before returning (insert_one adds it in place)
    result_dict.pop("_id", None)
    
    return {
        "message": f"Generated {result.successful} invoices successfully" + (f" ({len(skipped_companies)} companies skipped due to start date)" if skipped_companies else ""),
        "result": result_dict
    }


@router.get("/runs")
async def get_auto_invoice_runs(current_user: dict = Depends(get_current_user)):
    """Get history of auto-invoice generation runs"""
    check_permission(current_user, "view_invoice")
    
    runs = await db.auto_invoice_runs.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return runs


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
    except:
        raise HTTPException(status_code=400, detail="Invalid billing_month format")
    
    month_names = ["January", "February", "March", "April", "May", "June",
                   "July", "August", "September", "October", "November", "December"]
    month_name = month_names[month - 1]
    
    rate = member.get("final_rate", 0)
    cgst = round(rate * (GST_RATE / 2) / 100, 2)
    sgst = round(rate * (GST_RATE / 2) / 100, 2)
    total = rate + cgst + sgst
    
    return {
        "member": {
            "id": member["id"],
            "name": member["name"],
            "company": member.get("company_name", ""),
            "plan": member.get("plan_name", "")
        },
        "billing_month": billing_month,
        "description": f"{member.get('plan_name', 'Workspace')} - {month_name} {year}",
        "rate": rate,
        "cgst": cgst,
        "sgst": sgst,
        "total": total
    }
