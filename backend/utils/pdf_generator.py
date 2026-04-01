"""
PDF Generator for WYSIWYG invoice PDFs.
Uses fpdf2 (pure Python, no system dependencies) for reliable production deployment.
"""

from io import BytesIO
from fpdf import FPDF
import urllib.request
import tempfile
import os

# Company details for invoice
COMPANY_DETAILS = {
    "name": "Thryve Coworking",
    "address": "18/1, Plot no. 3, Azad Colony, Mathura Road, Sector 15 A, Faridabad, Haryana 121007",
    "state": "Haryana",
    "gstin": "06AAYFT8213A1Z2",
    "pan": "AAYFT8213A",
    "phone": "+91 9876543210",
    "email": "info@thryve.in",
    "bank": {
        "name": "HDFC Bank",
        "account_name": "Thryve Coworking",
        "account_no": "50200115952448",
        "branch": "Sector 16, Faridabad",
        "ifsc": "HDFC0000279"
    }
}

LOGO_URL = "https://customer-assets.emergentagent.com/job_683f7dfb-7860-4882-8d93-58ac3f0439b2/artifacts/jqltfue2_Gemini_Generated_Image_xy33ixy33ixy33ix.png"
SIGNATURE_URL = "https://customer-assets.emergentagent.com/job_683f7dfb-7860-4882-8d93-58ac3f0439b2/artifacts/x6h984ax_Untitled%20design.jpg"

# Cache downloaded images
_image_cache = {}


def _download_image(url):
    """Download image to temp file and cache it"""
    if url in _image_cache and os.path.exists(_image_cache[url]):
        return _image_cache[url]
    try:
        suffix = ".png" if url.endswith(".png") else ".jpg"
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        urllib.request.urlretrieve(url, tmp.name)
        _image_cache[url] = tmp.name
        return tmp.name
    except Exception:
        return None


def format_date(date_str):
    """Format date string to display format"""
    if not date_str:
        return "-"
    try:
        from datetime import datetime
        date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        day = date_obj.day
        months = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"]
        
        def get_ordinal(n):
            if 3 < n < 21:
                return 'th'
            remainder = n % 10
            if remainder == 1:
                return 'st'
            elif remainder == 2:
                return 'nd'
            elif remainder == 3:
                return 'rd'
            return 'th'
        
        return f"{months[date_obj.month - 1]} {day}{get_ordinal(day)}, {date_obj.year}"
    except Exception:
        return date_str


def number_to_words(num):
    """Convert number to words for invoice amount"""
    ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
            'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
            'Seventeen', 'Eighteen', 'Nineteen']
    tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
    
    if num == 0:
        return 'Zero Rupees Only'
    
    def convert_chunk(n):
        if n < 20:
            return ones[n]
        elif n < 100:
            return tens[n // 10] + (' ' + ones[n % 10] if n % 10 else '')
        else:
            return ones[n // 100] + ' Hundred' + (' ' + convert_chunk(n % 100) if n % 100 else '')
    
    if num >= 10000000:
        return convert_chunk(num // 10000000) + ' Crore ' + number_to_words(num % 10000000).replace(' Only', '') + ' Only'
    elif num >= 100000:
        return convert_chunk(num // 100000) + ' Lakh ' + number_to_words(num % 100000).replace(' Only', '') + ' Only'
    elif num >= 1000:
        return convert_chunk(num // 1000) + ' Thousand ' + number_to_words(num % 1000).replace(' Only', '') + ' Only'
    else:
        return convert_chunk(num) + ' Rupees Only'


class InvoicePDF(FPDF):
    """Custom FPDF class for invoice generation"""
    
    # Color constants
    DARK_BLUE = (46, 55, 91)       # #2E375B
    SLATE_800 = (30, 41, 59)       # #1e293b
    SLATE_500 = (100, 116, 139)    # #64748b
    SLATE_400 = (148, 163, 184)    # #94a3b8
    SLATE_200 = (203, 213, 225)    # #cbd5e1
    SLATE_100 = (241, 245, 249)    # #f1f5f9
    ORANGE = (255, 161, 74)        # #FFA14A
    AMBER = (217, 119, 6)          # #d97706
    WHITE = (255, 255, 255)
    
    def __init__(self):
        super().__init__(orientation='P', unit='mm', format='A4')
        self.set_auto_page_break(auto=True, margin=12)
        self.add_page()
        self.set_margins(12, 12, 12)
        self.set_x(12)
        self.set_y(12)


def generate_pdf_from_html(invoice: dict) -> bytes:
    """Generate PDF from invoice data using fpdf2"""
    
    company = invoice.get('company', COMPANY_DETAILS)
    client = invoice.get('client', {})
    line_items = invoice.get('line_items', [])
    
    subtotal = invoice.get('subtotal', 0)
    total_cgst = invoice.get('total_cgst', 0)
    total_sgst = invoice.get('total_sgst', 0)
    round_off = invoice.get('round_off_adjustment', 0)
    grand_total = invoice.get('grand_total', 0)
    
    pdf = InvoicePDF()
    page_w = 210 - 24  # A4 width minus margins
    
    # === HEADER: Logo + TAX INVOICE ===
    y_start = pdf.get_y()
    logo_path = _download_image(LOGO_URL)
    if logo_path:
        try:
            pdf.image(logo_path, x=12, y=y_start, h=14)
        except Exception:
            pass
    
    # TAX INVOICE box (right side)
    box_w = 38
    box_h = 9
    box_x = 210 - 12 - box_w
    pdf.set_xy(box_x, y_start + 2)
    pdf.set_draw_color(*InvoicePDF.SLATE_800)
    pdf.set_line_width(0.6)
    pdf.rect(box_x, y_start + 2, box_w, box_h)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(*InvoicePDF.SLATE_800)
    pdf.cell(box_w, box_h, "TAX INVOICE", align="C")
    
    pdf.set_y(y_start + 18)
    
    # === INVOICE INFO ROW ===
    y_info = pdf.get_y()
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*InvoicePDF.SLATE_800)
    
    # Left: Invoice No & Date
    pdf.set_xy(12, y_info)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(20, 5, "Invoice No:", ln=0)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(60, 5, f" {invoice.get('invoice_number', '')}", ln=1)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(23, 5, "Invoice Date:", ln=0)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(60, 5, f" {format_date(invoice.get('invoice_date', ''))}", ln=1)
    
    # Right: Due date orange box
    due_box_w = 52
    due_box_h = 14
    due_box_x = 210 - 12 - due_box_w
    pdf.set_fill_color(*InvoicePDF.ORANGE)
    pdf.rect(due_box_x, y_info, due_box_w, due_box_h, style="F")
    
    pdf.set_xy(due_box_x, y_info + 1)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(*InvoicePDF.DARK_BLUE)
    pdf.cell(due_box_w, 5, "PAYMENT DUE BY", align="C", ln=1)
    pdf.set_x(due_box_x)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(due_box_w, 5, format_date(invoice.get('due_date', '')), align="C")
    
    pdf.set_y(y_info + due_box_h + 4)
    
    # === SEPARATOR ===
    pdf.set_draw_color(*InvoicePDF.SLATE_800)
    pdf.set_line_width(0.5)
    sep_y = pdf.get_y()
    pdf.line(12, sep_y, 198, sep_y)
    pdf.set_y(sep_y + 3)
    
    # === ISSUED BY / BILL TO ===
    y_parties = pdf.get_y()
    half_w = page_w / 2
    
    for i, (label, data) in enumerate([
        ("Issued By", {
            "name": company.get('name', ''),
            "address": company.get('address', ''),
            "state": company.get('state', 'Haryana'),
            "gstin": company.get('gstin', '')
        }),
        ("Bill To", {
            "name": client.get('company_name', ''),
            "address": client.get('address', ''),
            "state": "Haryana",
            "gstin": client.get('gstin', '-')
        })
    ]):
        x_start = 12 + i * half_w
        
        # Header background
        pdf.set_fill_color(*InvoicePDF.SLATE_100)
        pdf.set_xy(x_start, y_parties)
        pdf.cell(half_w - (2 if i == 0 else 0), 5.5, "", fill=True)
        pdf.set_xy(x_start + 2, y_parties + 0.5)
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(*InvoicePDF.SLATE_800)
        pdf.cell(half_w - 4, 4.5, label)
        
        # Content
        content_y = y_parties + 7
        pdf.set_xy(x_start + 2, content_y)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*InvoicePDF.SLATE_800)
        pdf.cell(half_w - 4, 4.5, data["name"], ln=1)
        
        pdf.set_x(x_start + 2)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*InvoicePDF.SLATE_500)
        pdf.multi_cell(half_w - 4, 3.5, data["address"])
        
        pdf.set_x(x_start + 2)
        pdf.set_text_color(*InvoicePDF.SLATE_500)
        pdf.set_font("Helvetica", "", 8)
        pdf.cell(0, 4, f"State: ", ln=0)
        pdf.set_text_color(*InvoicePDF.SLATE_800)
        pdf.cell(0, 4, f"{data['state']}", ln=0)
        pdf.set_text_color(*InvoicePDF.SLATE_500)
        pdf.cell(0, 4, f" | GSTIN: ", ln=0)
        pdf.set_font("Courier", "", 8)
        pdf.set_text_color(*InvoicePDF.SLATE_800)
        # Compute remaining space — just print on same line
        gstin_text = data['gstin']
        pdf.set_xy(x_start + 2, pdf.get_y())
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*InvoicePDF.SLATE_500)
        state_gstin = f"State: {data['state']} | GSTIN: {gstin_text}"
        pdf.cell(half_w - 4, 4, state_gstin)
    
    # Vertical separator between parties
    party_bottom = y_parties + 30
    pdf.set_draw_color(*InvoicePDF.SLATE_200)
    pdf.set_line_width(0.2)
    pdf.line(12 + half_w, y_parties, 12 + half_w, party_bottom)
    # Bottom separator
    pdf.line(12, party_bottom, 198, party_bottom)
    
    pdf.set_y(party_bottom + 3)
    
    # === ITEMS TABLE ===
    col_widths = [10, page_w - 10 - 15 - 12 - 20 - 12 - 24, 15, 12, 20, 12, 24]
    headers = ["S.No.", "Particulars", "HSN/SAC", "Qty", "Rate", "Per", "Amount"]
    aligns = ["C", "L", "C", "C", "R", "C", "R"]
    
    y_table = pdf.get_y()
    
    # Table header
    pdf.set_fill_color(*InvoicePDF.SLATE_100)
    pdf.set_draw_color(*InvoicePDF.SLATE_200)
    pdf.set_line_width(0.2)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(*InvoicePDF.SLATE_800)
    
    x = 12
    for j, (w, h_text, align) in enumerate(zip(col_widths, headers, aligns)):
        pdf.set_xy(x, y_table)
        pdf.cell(w, 6, h_text, border=1, align=align, fill=True)
        x += w
    
    pdf.set_y(y_table + 6)
    
    # Table rows
    for idx, item in enumerate(line_items, 1):
        amount = item.get('amount', item.get('quantity', 1) * item.get('rate', 0))
        service_type = item.get('service_type', '')
        
        # Calculate row height based on description length
        desc = item.get('description', '')
        sub_desc = ""
        if service_type == 'monthly_rental':
            sub_desc = "Workspace subscription"
        elif service_type == 'security_deposit':
            sub_desc = "No GST Applicable"
        elif item.get('is_prorated') and item.get('prorate_days'):
            sub_desc = f"Prorated: {item.get('prorate_days')} of {item.get('prorate_total_days')} days"
        
        row_h = 7 if not sub_desc else 10
        y_row = pdf.get_y()
        
        row_data = [
            str(idx),
            "",  # handled separately
            item.get('hsn_sac', '997212') if item.get('is_taxable', True) else "",
            str(item.get('quantity', 1)),
            f"Rs. {item.get('rate', 0):,.2f}",
            item.get('unit', 'Month'),
            f"Rs. {amount:,.2f}"
        ]
        
        x = 12
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*InvoicePDF.SLATE_800)
        
        for j, (w, val, align) in enumerate(zip(col_widths, row_data, aligns)):
            pdf.set_xy(x, y_row)
            if j == 1:
                # Description column: multi-line
                pdf.rect(x, y_row, w, row_h)
                pdf.set_xy(x + 1, y_row + 1)
                pdf.set_font("Helvetica", "B", 8)
                pdf.cell(w - 2, 3.5, desc[:60], ln=1)
                if sub_desc:
                    pdf.set_x(x + 1)
                    if "Prorated" in sub_desc:
                        pdf.set_text_color(*InvoicePDF.AMBER)
                    else:
                        pdf.set_text_color(*InvoicePDF.SLATE_500)
                    pdf.set_font("Helvetica", "", 7)
                    pdf.cell(w - 2, 3, sub_desc)
                    pdf.set_text_color(*InvoicePDF.SLATE_800)
            else:
                font_name = "Courier" if j in [4, 6] else "Helvetica"
                pdf.set_font(font_name, "", 8)
                pdf.cell(w, row_h, val, border=1, align=align)
            x += w
        
        pdf.set_y(y_row + row_h)
    
    pdf.set_y(pdf.get_y() + 3)
    
    # === TOTALS TABLE (right-aligned) ===
    totals_w = 60
    totals_x = 210 - 12 - totals_w
    col1_w = totals_w * 0.55
    col2_w = totals_w * 0.45
    
    y_totals = pdf.get_y()
    pdf.set_draw_color(*InvoicePDF.SLATE_200)
    
    totals_rows = [
        ("Sub Total", f"Rs. {subtotal:,.2f}", False),
        ("CGST (9%)", f"Rs. {total_cgst:,.2f}", False),
        ("SGST (9%)", f"Rs. {total_sgst:,.2f}", False),
    ]
    
    if round_off != 0:
        round_off_str = f"+Rs. {round_off:,.2f}" if round_off >= 0 else f"-Rs. {abs(round_off):,.2f}"
        totals_rows.append(("Round-Off", round_off_str, False))
    
    totals_rows.append(("Total Amount", f"Rs. {int(grand_total):,}", True))
    
    for label, value, is_total in totals_rows:
        if is_total:
            pdf.set_fill_color(*InvoicePDF.DARK_BLUE)
            pdf.set_text_color(*InvoicePDF.WHITE)
            pdf.set_font("Helvetica", "B", 9)
        else:
            pdf.set_fill_color(*InvoicePDF.WHITE)
            pdf.set_text_color(*InvoicePDF.SLATE_800)
            pdf.set_font("Helvetica", "", 8)
        
        pdf.set_xy(totals_x, y_totals)
        pdf.cell(col1_w, 6, label, border=1, fill=is_total)
        pdf.set_font("Courier" if not is_total else "Helvetica", "B" if is_total else "", 8 if not is_total else 9)
        pdf.cell(col2_w, 6, value, border=1, align="R", fill=is_total)
        y_totals += 6
    
    pdf.set_text_color(*InvoicePDF.SLATE_800)
    pdf.set_y(y_totals + 3)
    
    # === AMOUNT IN WORDS ===
    y_words = pdf.get_y()
    pdf.set_fill_color(*InvoicePDF.SLATE_100)
    pdf.set_xy(12, y_words)
    pdf.set_font("Helvetica", "B", 8)
    words_text = f"Amount Chargeable (in words): {number_to_words(int(grand_total))}"
    pdf.cell(page_w, 7, words_text, fill=True, ln=1)
    
    pdf.set_y(pdf.get_y() + 4)
    
    # === FOOTER: Bank Details + Signature ===
    y_footer = pdf.get_y()
    
    # Top border
    pdf.set_draw_color(*InvoicePDF.SLATE_200)
    pdf.line(12, y_footer, 198, y_footer)
    y_footer += 3
    
    bank = company.get('bank', COMPANY_DETAILS['bank'])
    
    # Bank Details (left)
    pdf.set_xy(12, y_footer)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(*InvoicePDF.SLATE_800)
    pdf.cell(half_w, 4, "Company's Bank Details", ln=1)
    
    pdf.set_x(12)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*InvoicePDF.SLATE_500)
    pdf.cell(14, 3.5, "A/c Name: ", ln=0)
    pdf.set_text_color(*InvoicePDF.SLATE_800)
    pdf.cell(60, 3.5, bank.get('account_name', company.get('name', '')), ln=1)
    
    pdf.set_x(12)
    pdf.set_text_color(*InvoicePDF.SLATE_500)
    pdf.cell(half_w - 2, 3.5, f"Bank: {bank.get('name', '')} | A/c No.: {bank.get('account_no', '')}", ln=1)
    
    pdf.set_x(12)
    pdf.cell(half_w - 2, 3.5, f"Branch: {bank.get('branch', '')} | IFSC: {bank.get('ifsc', '')}", ln=1)
    
    # Signature (right)
    sig_x = 12 + half_w + 5
    pdf.set_xy(sig_x, y_footer)
    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(*InvoicePDF.SLATE_400)
    pdf.cell(half_w - 5, 4, "E. & O.E.", align="R", ln=1)
    
    # Signature image
    sig_path = _download_image(SIGNATURE_URL)
    if sig_path:
        try:
            pdf.image(sig_path, x=210 - 12 - 25, y=y_footer + 4, h=9)
        except Exception:
            pass
    
    pdf.set_xy(sig_x, y_footer + 14)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(*InvoicePDF.SLATE_800)
    pdf.cell(half_w - 5, 4, f"for {company.get('name', 'Thryve Coworking')}", align="R", ln=1)
    pdf.set_x(sig_x)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*InvoicePDF.SLATE_500)
    pdf.cell(half_w - 5, 4, "Authorised Signatory", align="R")
    
    # Vertical separator
    pdf.set_draw_color(*InvoicePDF.SLATE_200)
    pdf.line(12 + half_w, y_footer, 12 + half_w, y_footer + 22)
    
    pdf.set_y(max(pdf.get_y() + 6, y_footer + 24))
    
    # === DECLARATION ===
    pdf.set_font("Helvetica", "B", 7)
    pdf.set_text_color(*InvoicePDF.SLATE_500)
    pdf.set_x(12)
    pdf.cell(14, 3.5, "Declaration: ", ln=0)
    pdf.set_font("Helvetica", "", 7)
    pdf.cell(0, 3.5, "We declare that this invoice shows the actual price of the Services described and that all particulars are true and correct.", ln=1)
    
    pdf.set_y(pdf.get_y() + 5)
    
    # === THANK YOU ===
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(*InvoicePDF.DARK_BLUE)
    pdf.cell(page_w, 5, "Thank you for choosing Thryve Coworking!", align="C", ln=1)
    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(*InvoicePDF.SLATE_400)
    pdf.cell(page_w, 4, "This is a Computer Generated Invoice", align="C")
    
    # Return PDF bytes
    return bytes(pdf.output())
