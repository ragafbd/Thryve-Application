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
async def generate_invoice_number(company_name: str = "", invoice_date: str = None):
    """
    Generate invoice number in format: YYYY-YYYY/MM/NNN/CompanyName
    - YYYY-YYYY: Financial year (April to March), e.g., 2026-2027
    - MM: Two-digit month (01-12)
    - NNN: Sequential number, resets each financial year
    - CompanyName: Client company name for easy identification
    
    Financial year is derived from the invoice date:
    - April to December: Current Year - Next Year (e.g., May 2026 → 2026-2027)
    - January to March: Previous Year - Current Year (e.g., March 2026 → 2025-2026)
    """
    # Use invoice date if provided, otherwise use current date
    if invoice_date:
        try:
            date_obj = datetime.strptime(invoice_date.split('T')[0], "%Y-%m-%d")
        except:
            date_obj = datetime.now(timezone.utc)
    else:
        date_obj = datetime.now(timezone.utc)
    
    # Determine financial year (April to March) from invoice date
    if date_obj.month >= 4:  # April onwards
        fy_start_year = date_obj.year
        fy_end_year = date_obj.year + 1
    else:  # Jan-Mar
        fy_start_year = date_obj.year - 1
        fy_end_year = date_obj.year
    
    # Format: 2026-2027 for FY 2026-2027
    fy_prefix = f"{fy_start_year}-{fy_end_year}"
    
    # Two-digit month from invoice date
    month_num = f"{date_obj.month:02d}"
    
    # Query for invoices in this financial year using the new format
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
    
    # Format: 2026-2027/04/001/Company Name
    return f"{fy_prefix}/{month_num}/{next_num:03d}/{clean_company}"


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
    """Generate PDF content for an invoice - WYSIWYG matching web preview"""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=25, leftMargin=25, topMargin=20, bottomMargin=15)
    
    # Styles - optimized for single page, matching web preview
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='CompanyName', fontSize=11, fontName='Helvetica-Bold', textColor=colors.HexColor('#2E375B')))
    styles.add(ParagraphStyle(name='Normal_Right', fontSize=9, alignment=TA_RIGHT))
    styles.add(ParagraphStyle(name='Normal_Center', fontSize=9, alignment=TA_CENTER))
    styles.add(ParagraphStyle(name='Small', fontSize=7, textColor=colors.grey))
    styles.add(ParagraphStyle(name='Footer', fontSize=7, alignment=TA_CENTER, textColor=colors.grey))
    styles.add(ParagraphStyle(name='ThankYou', fontSize=9, fontName='Helvetica-Bold', alignment=TA_CENTER, textColor=colors.HexColor('#2E375B')))
    
    elements = []
    
    # Colors - matching web preview
    thryve_blue = colors.HexColor('#2E375B')
    thryve_orange = colors.HexColor('#FFA14A')
    slate_800 = colors.HexColor('#1e293b')
    slate_300 = colors.HexColor('#cbd5e1')
    slate_100 = colors.HexColor('#f1f5f9')
    
    company = invoice.get('company', COMPANY_DETAILS)
    client = invoice.get('client', {})
    
    # Try to load logo image
    logo_url = "https://customer-assets.emergentagent.com/job_683f7dfb-7860-4882-8d93-58ac3f0439b2/artifacts/jqltfue2_Gemini_Generated_Image_xy33ixy33ixy33ix.png"
    logo_image = None
    try:
        import requests
        from reportlab.platypus import Image as RLImage
        response = requests.get(logo_url, timeout=5)
        if response.status_code == 200:
            img_buffer = BytesIO(response.content)
            logo_image = RLImage(img_buffer, width=60, height=60)
    except Exception as e:
        print(f"Could not load logo: {e}")
    
    # Helper function for date formatting
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
    
    # ===== HEADER: Logo + TAX INVOICE Box =====
    invoice_title_table = Table([["TAX INVOICE"]], colWidths=[100])
    invoice_title_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1.5, slate_800),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    
    if logo_image:
        header_data = [[logo_image, "", invoice_title_table]]
        header_table = Table(header_data, colWidths=[70, 360, 110])
    else:
        header_data = [[Paragraph(f"<b>{company.get('name', 'Thryve Coworking')}</b>", styles['CompanyName']), "", invoice_title_table]]
        header_table = Table(header_data, colWidths=[200, 230, 110])
    
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (-1, 0), (-1, 0), 'RIGHT'),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 6))
    
    # ===== Invoice Info Row with Due Date Box =====
    invoice_info = f"<b>Invoice No:</b> {invoice.get('invoice_number', '')}<br/><b>Invoice Date:</b> {format_date(invoice.get('invoice_date', ''))}"
    
    if invoice.get('due_date'):
        due_date_content = f"<b>PAYMENT DUE BY</b><br/><font size='11'><b>{format_date(invoice.get('due_date'))}</b></font>"
        info_data = [[Paragraph(invoice_info, styles['Normal']), Paragraph(due_date_content, styles['Normal_Center'])]]
        info_table = Table(info_data, colWidths=[380, 160])
        info_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (1, 0), (1, 0), thryve_orange),
            ('TEXTCOLOR', (1, 0), (1, 0), thryve_blue),
            ('TOPPADDING', (1, 0), (1, 0), 6),
            ('BOTTOMPADDING', (1, 0), (1, 0), 6),
        ]))
    else:
        info_data = [[Paragraph(invoice_info, styles['Normal'])]]
        info_table = Table(info_data, colWidths=[540])
    
    elements.append(info_table)
    elements.append(Spacer(1, 8))
    
    # Separator line
    sep_table = Table([[""]], colWidths=[540])
    sep_table.setStyle(TableStyle([('LINEBELOW', (0, 0), (-1, -1), 1.5, slate_800)]))
    elements.append(sep_table)
    elements.append(Spacer(1, 6))
    
    # ===== Issued By / Bill To Section =====
    company_state = company.get('state', 'Haryana')
    issued_by_text = f"""<b>{company.get('name', '')}</b><br/>
{company.get('address', '')}<br/>
<font color='#6b7280'>State Name:</font> {company_state}<br/>
<font color='#6b7280'>GSTIN:</font> {company.get('gstin', '')}"""
    
    client_state = client.get('state', 'Haryana')
    bill_to_text = f"""<b>{client.get('company_name', '')}</b><br/>
{client.get('address', '')}<br/>
<font color='#6b7280'>State Name:</font> {client_state}<br/>
<font color='#6b7280'>GSTIN:</font> {client.get('gstin', '')}"""
    
    # Create Issued By cell
    issued_header = Table([["Issued By"]], colWidths=[260])
    issued_header.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), slate_100),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    
    bill_header = Table([["Bill To"]], colWidths=[260])
    bill_header.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), slate_100),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    
    issued_cell = Table([[issued_header], [Paragraph(issued_by_text, styles['Normal'])]], colWidths=[260])
    issued_cell.setStyle(TableStyle([('LEFTPADDING', (0, 1), (-1, -1), 6), ('TOPPADDING', (0, 1), (-1, -1), 4)]))
    
    bill_cell = Table([[bill_header], [Paragraph(bill_to_text, styles['Normal'])]], colWidths=[260])
    bill_cell.setStyle(TableStyle([('LEFTPADDING', (0, 1), (-1, -1), 6), ('TOPPADDING', (0, 1), (-1, -1), 4)]))
    
    party_table = Table([[issued_cell, bill_cell]], colWidths=[270, 270])
    party_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LINEAFTER', (0, 0), (0, 0), 0.5, slate_300),
        ('LINEBELOW', (0, 0), (-1, -1), 0.5, slate_300),
    ]))
    elements.append(party_table)
    elements.append(Spacer(1, 8))
    
    # ===== Line Items Table (Matching Web: 7 columns) =====
    line_items = invoice.get('line_items', [])
    
    # Table header - matching web preview columns
    table_data = [['S.No.', 'Particulars', 'HSN/SAC', 'Qty', 'Rate', 'Per', 'Amount (Rs.)']]
    
    for idx, item in enumerate(line_items, 1):
        amount = item.get('amount', item.get('quantity', 1) * item.get('rate', 0))
        table_data.append([
            str(idx),
            item.get('description', ''),
            item.get('hsn_sac', '997212') if item.get('is_taxable', True) else '',
            str(item.get('quantity', 1)),
            f"{item.get('rate', 0):,.2f}",
            item.get('unit', 'Units'),
            f"{amount:,.2f}"
        ])
    
    # Add empty rows if needed for visual consistency
    if len(line_items) < 2:
        for _ in range(2 - len(line_items)):
            table_data.append(['', '', '', '', '', '', ''])
    
    items_table = Table(table_data, colWidths=[35, 195, 55, 40, 70, 45, 100])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), slate_100),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('ALIGN', (0, 1), (0, -1), 'CENTER'),
        ('ALIGN', (1, 1), (1, -1), 'LEFT'),
        ('ALIGN', (2, 1), (5, -1), 'CENTER'),
        ('ALIGN', (6, 1), (6, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, slate_300),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(items_table)
    
    # ===== Totals Table (Right-aligned) =====
    round_off = invoice.get('round_off_adjustment', 0)
    grand_total = invoice.get('grand_total', 0)
    
    totals_rows = [
        ['Sub Total', f"Rs. {invoice.get('subtotal', 0):,.2f}"],
        ['CGST (9%)', f"Rs. {invoice.get('total_cgst', 0):,.2f}"],
        ['SGST (9%)', f"Rs. {invoice.get('total_sgst', 0):,.2f}"],
    ]
    
    if round_off != 0:
        round_off_str = f"+Rs. {round_off:,.2f}" if round_off >= 0 else f"-Rs. {abs(round_off):,.2f}"
        totals_rows.append(['Round-Off Adj.', round_off_str])
    
    totals_rows.append(['Total Amount', f"Rs. {int(grand_total):,}"])
    
    totals_table = Table(totals_rows, colWidths=[90, 100])
    
    # Style for totals - last row is highlighted
    totals_style = [
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, slate_300),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('BACKGROUND', (0, 0), (-1, -2), colors.white),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('BACKGROUND', (0, -1), (-1, -1), thryve_blue),
        ('TEXTCOLOR', (0, -1), (-1, -1), colors.white),
    ]
    totals_table.setStyle(TableStyle(totals_style))
    
    # Right-align totals
    totals_wrapper = Table([[None, totals_table]], colWidths=[350, 190])
    elements.append(totals_wrapper)
    elements.append(Spacer(1, 4))
    
    # ===== Amount in Words =====
    amount_words = number_to_words(int(grand_total))
    amount_box = Table([[Paragraph(f"<b>Amount Chargeable (in words):</b><br/><b><font color='#2E375B'>{amount_words}</font></b>", styles['Normal'])]], colWidths=[540])
    amount_box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), slate_100),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(amount_box)
    elements.append(Spacer(1, 8))
    
    # ===== Bank Details & Signature Section =====
    bank = COMPANY_DETAILS.get('bank', {
        'name': 'HDFC Bank',
        'account_name': COMPANY_DETAILS.get('name', 'Thryve Coworking'),
        'account_no': '50200115952448',
        'branch': 'Sector 16, Faridabad',
        'ifsc': 'HDFC0000279'
    })
    
    bank_text = f"""<b>Company's Bank Details</b><br/>
<font color='#6b7280'>A/c Name:</font> {bank.get('account_name', COMPANY_DETAILS.get('name', ''))}<br/>
<font color='#6b7280'>Bank Name:</font> {bank.get('name', '')}<br/>
<font color='#6b7280'>Current A/c No.:</font> {bank.get('account_no', '')}<br/>
<font color='#6b7280'>Branch:</font> {bank.get('branch', '')}<br/>
<font color='#6b7280'>IFSC:</font> {bank.get('ifsc', '')}"""
    
    # Try to load signature image
    signature_image_url = "https://customer-assets.emergentagent.com/job_683f7dfb-7860-4882-8d93-58ac3f0439b2/artifacts/x6h984ax_Untitled%20design.jpg"
    signature_image = None
    try:
        import requests
        from reportlab.platypus import Image as RLImage
        response = requests.get(signature_image_url, timeout=5)
        if response.status_code == 200:
            img_buffer = BytesIO(response.content)
            signature_image = RLImage(img_buffer, width=70, height=35)
    except Exception as e:
        print(f"Could not load signature image: {e}")
    
    # Create signature section
    if signature_image:
        sig_content = [
            [Paragraph("<font size='7' color='#9ca3af'>E. &amp; O.E.</font>", styles['Normal_Right'])],
            [signature_image],
            [Paragraph(f"<b>for {COMPANY_DETAILS.get('name', 'Thryve Coworking')}</b>", styles['Normal_Right'])],
            [Paragraph("<font size='8' color='#6b7280'>Authorised Signatory</font>", styles['Normal_Right'])],
        ]
        sig_table = Table(sig_content, colWidths=[200])
        sig_table.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'RIGHT'), ('VALIGN', (0, 0), (-1, -1), 'TOP')]))
    else:
        sig_text = f"""<para align='right'><font size='7' color='#9ca3af'>E. &amp; O.E.</font><br/><br/><br/><br/>
<b>for {COMPANY_DETAILS.get('name', 'Thryve Coworking')}</b><br/><br/>
<font size='8' color='#6b7280'>Authorised Signatory</font></para>"""
        sig_table = Paragraph(sig_text, styles['Normal_Right'])
    
    footer_table = Table([[Paragraph(bank_text, styles['Normal']), sig_table]], colWidths=[290, 250])
    footer_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LINEABOVE', (0, 0), (-1, 0), 0.5, slate_300),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(footer_table)
    elements.append(Spacer(1, 6))
    
    # ===== Declaration =====
    declaration = Paragraph("<font size='7' color='#6b7280'><b>Declaration:</b> We declare that this invoice shows the actual price of the Services described and that all particulars are true and correct.</font>", styles['Normal'])
    elements.append(declaration)
    elements.append(Spacer(1, 6))
    
    # ===== Footer =====
    elements.append(Paragraph("<b>Thank you for choosing Thryve Coworking!</b>", styles['ThankYou']))
    elements.append(Spacer(1, 2))
    elements.append(Paragraph("This is a Computer Generated Invoice", styles['Footer']))
    
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
            
            # Generate invoice number with company name and invoice date
            company_name = company.get("company_name", "")
            invoice_number = await generate_invoice_number(company_name, invoice_date)
            
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
