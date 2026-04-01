"""
PDF Generator for WYSIWYG invoice PDFs.
Uses fpdf2 (pure Python, zero system dependencies) for production deployment.
Layout matches InvoicePreview.jsx exactly.
"""

import urllib.request
import tempfile
import os
from fpdf import FPDF

COMPANY_DETAILS = {
    "name": "Thryve Coworking",
    "address": "18/1, Plot no. 3, Azad Colony, Mathura Road, Sector 15 A, Faridabad, Haryana 121007",
    "state": "Haryana",
    "gstin": "06AAYFT8213A1Z2",
    "pan": "AAYFT8213A",
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

_image_cache = {}

def _download_image(url):
    if url in _image_cache and os.path.exists(_image_cache[url]):
        return _image_cache[url]
    try:
        suffix = ".png" if ".png" in url else ".jpg"
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        urllib.request.urlretrieve(url, tmp.name)
        _image_cache[url] = tmp.name
        return tmp.name
    except Exception:
        return None


def format_date(date_str):
    if not date_str:
        return "-"
    try:
        from datetime import datetime
        d = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        months = ["January","February","March","April","May","June",
                   "July","August","September","October","November","December"]
        day = d.day
        s = 'th' if 4 <= day <= 20 else {1:'st',2:'nd',3:'rd'}.get(day%10,'th')
        return f"{months[d.month-1]} {day}{s}, {d.year}"
    except Exception:
        return date_str


def number_to_words(num):
    ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
            'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen',
            'Seventeen','Eighteen','Nineteen']
    tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
    if num == 0:
        return 'Rupees Zero Only'
    def chunk(n):
        if n < 20: return ones[n]
        if n < 100: return tens[n//10] + (' '+ones[n%10] if n%10 else '')
        return ones[n//100] + ' Hundred' + (' '+chunk(n%100) if n%100 else '')
    def convert(n):
        if n >= 10000000: return chunk(n//10000000)+' Crore '+convert(n%10000000)
        if n >= 100000: return chunk(n//100000)+' Lakh '+convert(n%100000)
        if n >= 1000: return chunk(n//1000)+' Thousand '+convert(n%1000)
        return chunk(n)
    return 'Rupees ' + convert(int(num)).strip() + ' Only'


def fmt_currency(amount):
    """Format as Rs. X,XX,XXX.XX (Indian numbering)"""
    if amount is None:
        return "Rs. 0.00"
    n = float(amount)
    sign = "-" if n < 0 else ""
    n = abs(n)
    integer_part = int(n)
    decimal_part = f"{n - integer_part:.2f}"[1:]  # .XX
    s = str(integer_part)
    if len(s) > 3:
        last3 = s[-3:]
        rest = s[:-3]
        groups = []
        while rest:
            groups.insert(0, rest[-2:])
            rest = rest[:-2]
        result = ','.join(groups) + ',' + last3
    else:
        result = s
    return f"Rs. {sign}{result}{decimal_part}"


# Color tuples
C_DARK_BLUE = (46, 55, 91)
C_SLATE_800 = (30, 41, 59)
C_SLATE_600 = (71, 85, 105)
C_SLATE_500 = (100, 116, 139)
C_SLATE_400 = (148, 163, 184)
C_SLATE_300 = (203, 213, 225)
C_SLATE_200 = (226, 232, 240)
C_SLATE_100 = (241, 245, 249)
C_SLATE_50 = (248, 250, 252)
C_ORANGE = (255, 161, 74)
C_AMBER = (217, 119, 6)
C_WHITE = (255, 255, 255)

# A4 dimensions
PW = 210  # page width mm
PH = 297
M = 15    # margin mm
CW = PW - 2*M  # content width


def generate_pdf_from_html(invoice: dict) -> bytes:
    """Generate a WYSIWYG PDF matching InvoicePreview.jsx"""

    company = invoice.get('company', COMPANY_DETAILS)
    client = invoice.get('client', {})
    items = invoice.get('line_items', [])
    subtotal = invoice.get('subtotal', 0)
    cgst = invoice.get('total_cgst', 0)
    sgst = invoice.get('total_sgst', 0)
    round_off = invoice.get('round_off_adjustment', 0)
    grand_total = invoice.get('grand_total', 0)

    pdf = FPDF(orientation='P', unit='mm', format='A4')
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_margins(M, M, M)

    y = M

    # ────────────────────────────────────────────
    # HEADER: Logo + TAX INVOICE
    # ────────────────────────────────────────────
    logo = _download_image(LOGO_URL)
    if logo:
        try:
            pdf.image(logo, x=M, y=y, h=18)
        except Exception:
            pass

    # TAX INVOICE box
    pdf.set_font("Helvetica", "B", 16)
    tw = pdf.get_string_width("TAX INVOICE") + 10
    th = 10
    tx = PW - M - tw
    pdf.set_draw_color(*C_SLATE_800)
    pdf.set_line_width(0.6)
    pdf.rect(tx, y + 4, tw, th)
    pdf.set_xy(tx, y + 4)
    pdf.set_text_color(*C_SLATE_800)
    pdf.cell(tw, th, "TAX INVOICE", align="C")

    y += 22

    # ────────────────────────────────────────────
    # INVOICE INFO: Number, Date | Due Date Box
    # ────────────────────────────────────────────
    pdf.set_xy(M, y)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*C_SLATE_800)
    pdf.cell(22, 5, "Invoice No: ", ln=0)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(80, 5, invoice.get('invoice_number', ''), ln=1)

    pdf.set_x(M)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(26, 5, "Invoice Date: ", ln=0)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(80, 5, format_date(invoice.get('invoice_date', '')), ln=1)

    # Due date orange box
    if invoice.get('due_date'):
        bw, bh = 50, 16
        bx = PW - M - bw
        by = y
        pdf.set_fill_color(*C_ORANGE)
        # Rounded rectangle
        pdf.set_draw_color(*C_ORANGE)
        r = 2.5
        pdf.rect(bx, by, bw, bh, style='F')

        pdf.set_xy(bx, by + 2)
        pdf.set_font("Helvetica", "B", 7)
        pdf.set_text_color(*C_DARK_BLUE)
        pdf.cell(bw, 4, "PAYMENT DUE BY", align="C", ln=1)
        pdf.set_x(bx)
        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(bw, 7, format_date(invoice.get('due_date', '')), align="C")

    y += 16

    # Separator line (matching border-b-2 border-slate-800)
    pdf.set_draw_color(*C_SLATE_800)
    pdf.set_line_width(0.5)
    pdf.line(M, y, PW - M, y)
    y += 2

    # ────────────────────────────────────────────
    # ISSUED BY / BILL TO (two-column)
    # ────────────────────────────────────────────
    half = CW / 2
    section_h = 32

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
        x0 = M + i * half

        # Gray header
        pdf.set_fill_color(*C_SLATE_100)
        pdf.set_xy(x0, y)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*C_SLATE_800)
        pdf.cell(half, 6, "  " + label, fill=True, ln=0)

        # Company/Client name
        pdf.set_xy(x0 + 3, y + 8)
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*C_SLATE_800)
        pdf.cell(half - 6, 5, data['name'])

        # Address
        pdf.set_xy(x0 + 3, y + 13)
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(*C_SLATE_600)
        # Multi-line address
        pdf.multi_cell(half - 6, 4, data['address'])

        # State | GSTIN
        addr_lines = len(data['address']) // 45 + 1
        gstin_y = y + 13 + addr_lines * 4 + 1
        pdf.set_xy(x0 + 3, gstin_y)
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(*C_SLATE_500)
        pdf.cell(0, 4, f"State: {data['state']} | GSTIN: {data['gstin']}")

    # Vertical divider between columns
    pdf.set_draw_color(*C_SLATE_300)
    pdf.set_line_width(0.2)
    pdf.line(M + half, y, M + half, y + section_h)

    # Bottom border
    pdf.line(M, y + section_h, PW - M, y + section_h)
    y += section_h + 2

    # ────────────────────────────────────────────
    # ITEMS TABLE
    # ────────────────────────────────────────────
    # Column widths matching web: S.No(10), Particulars(flex), HSN(17), Qty(14), Rate(22), Per(14), Amount(25)
    c = [10, CW - 10 - 17 - 14 - 22 - 14 - 25, 17, 14, 22, 14, 25]  # total = CW
    headers = ["S.No.", "Particulars", "HSN/SAC", "Qty", "Rate", "Per", "Amount (Rs.)"]
    aligns = ["C", "L", "C", "C", "R", "C", "R"]

    rh = 7  # row height

    # Header row
    pdf.set_fill_color(*C_SLATE_100)
    pdf.set_draw_color(*C_SLATE_300)
    pdf.set_line_width(0.2)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(*C_SLATE_800)

    x = M
    for j in range(7):
        pdf.set_xy(x, y)
        pdf.cell(c[j], rh, headers[j], border=1, align=aligns[j], fill=True)
        x += c[j]
    y += rh

    # Data rows
    for idx, item in enumerate(items, 1):
        amount = item.get('amount', item.get('quantity', 1) * item.get('rate', 0))
        stype = item.get('service_type', '')
        desc = item.get('description', '')
        sub = ""
        sub_color = C_SLATE_500
        if stype == 'monthly_rental':
            sub = "Workspace subscription"
        elif stype == 'security_deposit':
            sub = "No GST Applicable"
        elif item.get('is_prorated') and item.get('prorate_days'):
            sub = f"Prorated: {item['prorate_days']} of {item.get('prorate_total_days',30)} days"
            sub_color = C_AMBER

        drh = 10 if sub else rh  # taller row when sub-description exists

        vals = [
            str(idx),
            None,  # special handling
            item.get('hsn_sac', '997212') if item.get('is_taxable', True) else '',
            str(item.get('quantity', 1)),
            fmt_currency(item.get('rate', 0)),
            item.get('unit', 'Month'),
            fmt_currency(amount)
        ]

        x = M
        for j in range(7):
            pdf.set_xy(x, y)
            if j == 1:
                # Particulars column with sub-description
                pdf.rect(x, y, c[j], drh)
                pdf.set_xy(x + 1.5, y + 1)
                pdf.set_font("Helvetica", "B", 9)
                pdf.set_text_color(*C_SLATE_800)
                pdf.cell(c[j] - 3, 4, desc[:55])
                if sub:
                    pdf.set_xy(x + 1.5, y + 5.5)
                    pdf.set_font("Helvetica", "", 7)
                    pdf.set_text_color(*sub_color)
                    pdf.cell(c[j] - 3, 3.5, sub)
            else:
                pdf.set_font("Helvetica", "", 9)
                pdf.set_text_color(*C_SLATE_800)
                pdf.cell(c[j], drh, vals[j], border=1, align=aligns[j])
            x += c[j]
        y += drh

    # Empty rows for visual consistency (like web preview shows up to 3 minimum)
    empty_needed = max(0, 3 - len(items))
    for _ in range(empty_needed):
        x = M
        pdf.set_font("Helvetica", "", 9)
        for j in range(7):
            pdf.set_xy(x, y)
            pdf.cell(c[j], rh, "", border=1)
            x += c[j]
        y += rh

    # ────────────────────────────────────────────
    # TOTALS TABLE (right-aligned, matching web w-80 = ~70mm)
    # ────────────────────────────────────────────
    tw_total = 70
    tx_start = PW - M - tw_total
    c1 = tw_total * 0.57
    c2 = tw_total * 0.43
    trh = 6

    rows = [
        ("Sub Total", fmt_currency(subtotal), False, True),
        ("CGST (9%) on Plan fee", fmt_currency(cgst), False, False),
        ("SGST (9%) on Plan fee", fmt_currency(sgst), False, False),
    ]
    if round_off is not None:
        ro_str = fmt_currency(round_off) if round_off >= 0 else fmt_currency(round_off)
        if round_off > 0:
            ro_str = "+" + fmt_currency(round_off)
        rows.append(("Round-Off Adjustment", ro_str, False, False))
    rows.append(("Total Amount", f"Rs. {int(grand_total):,}", True, False))

    for label, value, is_total, is_sub in rows:
        if is_total:
            pdf.set_fill_color(*C_DARK_BLUE)
            pdf.set_text_color(*C_WHITE)
            pdf.set_font("Helvetica", "B", 10)
            h = 7
        elif is_sub:
            pdf.set_fill_color(*C_SLATE_50)
            pdf.set_text_color(*C_SLATE_800)
            pdf.set_font("Helvetica", "B", 9)
            h = trh
        else:
            pdf.set_fill_color(*C_WHITE)
            pdf.set_text_color(*C_SLATE_600)
            pdf.set_font("Helvetica", "", 9)
            h = trh

        pdf.set_xy(tx_start, y)
        pdf.cell(c1, h, " " + label, border=1, fill=is_total or is_sub)

        if is_total:
            pdf.set_font("Helvetica", "B", 10)
        else:
            pdf.set_font("Helvetica", "" if not is_sub else "B", 9)
        pdf.cell(c2, h, value + " ", border=1, align="R", fill=is_total or is_sub)
        y += h

    y += 4

    # ────────────────────────────────────────────
    # AMOUNT IN WORDS
    # ────────────────────────────────────────────
    pdf.set_fill_color(*C_SLATE_50)
    pdf.set_draw_color(*C_SLATE_200)
    pdf.set_xy(M, y)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(*C_SLATE_800)
    pdf.cell(CW, 5, "  Amount Chargeable (in words):", fill=True, border="LTR", ln=1)
    pdf.set_x(M)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*C_DARK_BLUE)
    pdf.cell(CW, 6, "  " + number_to_words(int(grand_total)), fill=True, border="LBR", ln=1)
    y = pdf.get_y() + 5

    # ────────────────────────────────────────────
    # BANK DETAILS + SIGNATURE
    # ────────────────────────────────────────────
    pdf.set_draw_color(*C_SLATE_300)
    pdf.set_line_width(0.2)
    pdf.line(M, y, PW - M, y)
    y += 3

    bank = company.get('bank', COMPANY_DETAILS['bank'])

    # Bank Details (left half)
    pdf.set_xy(M, y)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*C_SLATE_800)
    pdf.cell(half, 5, "Company's Bank Details", ln=1)

    pdf.set_x(M)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*C_SLATE_500)
    line = f"A/c Name: {bank.get('account_name', company.get('name',''))}"
    pdf.cell(half, 4.5, line, ln=1)

    pdf.set_x(M)
    line = f"Bank: {bank.get('name','')} | A/c No.: {bank.get('account_no','')}"
    pdf.cell(half, 4.5, line, ln=1)

    pdf.set_x(M)
    line = f"Branch: {bank.get('branch','')} | IFSC: {bank.get('ifsc','')}"
    pdf.cell(half, 4.5, line, ln=1)

    # Signature (right half)
    sig_x = M + half + 5
    pdf.set_xy(sig_x, y)
    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(*C_SLATE_400)
    pdf.cell(half - 5, 4, "E. & O.E.", align="R", ln=1)

    sig = _download_image(SIGNATURE_URL)
    if sig:
        try:
            pdf.image(sig, x=PW - M - 30, y=y + 5, h=10)
        except Exception:
            pass

    pdf.set_xy(sig_x, y + 16)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*C_SLATE_800)
    pdf.cell(half - 5, 4, f"for {company.get('name','Thryve Coworking')}", align="R", ln=1)
    pdf.set_x(sig_x)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*C_SLATE_500)
    pdf.cell(half - 5, 4, "Authorised Signatory", align="R")

    # Vertical divider
    pdf.set_draw_color(*C_SLATE_300)
    pdf.line(M + half, y, M + half, y + 22)

    y = max(pdf.get_y() + 6, y + 24)

    # ────────────────────────────────────────────
    # DECLARATION
    # ────────────────────────────────────────────
    pdf.set_draw_color(*C_SLATE_300)
    pdf.line(M, y, PW - M, y)
    y += 2
    pdf.set_xy(M, y)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(*C_SLATE_600)
    pdf.cell(18, 4, "Declaration: ", ln=0)
    pdf.set_font("Helvetica", "", 8)
    pdf.cell(0, 4, "We declare that this invoice shows the actual price of the Services described and that all particulars are true and correct.", ln=1)

    y = pdf.get_y() + 3

    # ────────────────────────────────────────────
    # FOOTER
    # ────────────────────────────────────────────
    pdf.set_draw_color(*C_SLATE_200)
    pdf.line(M, y, PW - M, y)
    pdf.set_fill_color(*C_SLATE_50)
    pdf.rect(M, y, CW, 12, style='F')
    y += 2
    pdf.set_xy(M, y)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*C_DARK_BLUE)
    pdf.cell(CW, 5, "Thank you for choosing Thryve Coworking!", align="C", ln=1)
    pdf.set_x(M)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*C_SLATE_400)
    pdf.cell(CW, 4, "This is a Computer Generated Invoice", align="C")

    return bytes(pdf.output())
