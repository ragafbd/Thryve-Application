"""
PDF Generator for true WYSIWYG invoice PDFs.
Uses WeasyPrint (pure Python, no browser needed) for reliable production deployment.
"""

from io import BytesIO
from weasyprint import HTML, CSS
from weasyprint.text.fonts import FontConfiguration

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


def generate_invoice_html(invoice: dict) -> str:
    """Generate HTML that matches the React InvoicePreview component"""
    
    company = invoice.get('company', COMPANY_DETAILS)
    client = invoice.get('client', {})
    line_items = invoice.get('line_items', [])
    
    subtotal = invoice.get('subtotal', 0)
    total_cgst = invoice.get('total_cgst', 0)
    total_sgst = invoice.get('total_sgst', 0)
    round_off = invoice.get('round_off_adjustment', 0)
    grand_total = invoice.get('grand_total', 0)
    
    # Generate line items HTML
    items_html = ""
    for idx, item in enumerate(line_items, 1):
        amount = item.get('amount', item.get('quantity', 1) * item.get('rate', 0))
        service_type = item.get('service_type', '')
        
        sub_desc = ""
        if service_type == 'monthly_rental':
            sub_desc = '<p style="font-size: 10px; color: #64748b; margin: 2px 0 0 0;">Workspace subscription</p>'
        elif service_type == 'security_deposit':
            sub_desc = '<p style="font-size: 10px; color: #64748b; margin: 2px 0 0 0;">No GST Applicable</p>'
        elif item.get('is_prorated') and item.get('prorate_days'):
            sub_desc = f'<p style="font-size: 10px; color: #d97706; margin: 2px 0 0 0;">Prorated: {item.get("prorate_days")} of {item.get("prorate_total_days")} days</p>'
        
        items_html += f'''
        <tr>
            <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center;">{idx}</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 8px;">
                <p style="font-weight: 500; margin: 0;">{item.get('description', '')}</p>
                {sub_desc}
            </td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; font-family: monospace; font-size: 11px;">{item.get('hsn_sac', '997212') if item.get('is_taxable', True) else ''}</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center;">{item.get('quantity', 1)}</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; font-family: monospace;">Rs. {item.get('rate', 0):,.2f}</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center;">{item.get('unit', 'Month')}</td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; font-family: monospace;">Rs. {amount:,.2f}</td>
        </tr>
        '''
    
    round_off_html = ""
    if round_off != 0:
        round_off_str = f"+Rs. {round_off:,.2f}" if round_off >= 0 else f"-Rs. {abs(round_off):,.2f}"
        round_off_html = f'''
        <tr>
            <td style="border: 1px solid #cbd5e1; padding: 4px 10px; font-size: 11px;">Round-Off Adjustment</td>
            <td style="border: 1px solid #cbd5e1; padding: 4px 10px; text-align: right; font-family: monospace; font-size: 11px;">{round_off_str}</td>
        </tr>
        '''
    
    html = f'''<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        @page {{
            size: A4;
            margin: 12mm;
        }}
        
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        
        body {{
            font-family: Arial, Helvetica, sans-serif;
            font-size: 12px;
            color: #1e293b;
            line-height: 1.4;
        }}
        
        .header {{ display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; }}
        .logo {{ height: 55px; width: auto; }}
        .tax-invoice-box {{ border: 2px solid #1e293b; padding: 6px 20px; font-weight: bold; font-size: 14px; }}
        
        .info-row {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }}
        .due-date-box {{ background-color: #FFA14A; padding: 8px 15px; text-align: center; }}
        .due-date-box p {{ margin: 0; color: #2E375B; }}
        
        .separator {{ border-bottom: 2px solid #1e293b; margin-bottom: 12px; }}
        
        .parties {{ display: flex; border-bottom: 1px solid #cbd5e1; margin-bottom: 12px; }}
        .party {{ flex: 1; padding-bottom: 10px; }}
        .party:first-child {{ padding-right: 15px; border-right: 1px solid #cbd5e1; }}
        .party:last-child {{ padding-left: 15px; }}
        .party-header {{ background-color: #f1f5f9; padding: 4px 8px; font-weight: bold; font-size: 11px; margin-bottom: 6px; }}
        .party-content {{ padding: 0 8px; font-size: 11px; }}
        .party-content p {{ margin: 2px 0; }}
        
        .items-table {{ width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 8px; }}
        .items-table th {{ background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; font-weight: 600; }}
        
        .totals-container {{ display: flex; justify-content: flex-end; margin-bottom: 8px; }}
        .totals-table {{ width: 220px; border-collapse: collapse; font-size: 11px; }}
        .totals-table td {{ border: 1px solid #cbd5e1; padding: 4px 10px; }}
        .total-row {{ background-color: #2E375B; color: white; font-weight: bold; }}
        
        .amount-words {{ background-color: #f1f5f9; padding: 8px 12px; margin-bottom: 12px; font-size: 11px; }}
        
        .footer-section {{ display: flex; border-top: 1px solid #cbd5e1; padding-top: 10px; }}
        .bank-details {{ flex: 1; padding-right: 15px; border-right: 1px solid #cbd5e1; font-size: 11px; }}
        .signature {{ flex: 1; padding-left: 15px; text-align: right; font-size: 11px; }}
        .signature img {{ height: 35px; width: auto; margin: 5px 0; }}
        
        .declaration {{ margin-top: 10px; font-size: 10px; color: #64748b; }}
        .thank-you {{ text-align: center; margin-top: 12px; }}
        .thank-you p:first-child {{ font-weight: 600; color: #2E375B; }}
        .thank-you p:last-child {{ font-size: 10px; color: #94a3b8; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="https://customer-assets.emergentagent.com/job_683f7dfb-7860-4882-8d93-58ac3f0439b2/artifacts/jqltfue2_Gemini_Generated_Image_xy33ixy33ixy33ix.png" alt="Thryve Coworking" class="logo" />
            <div class="tax-invoice-box">TAX INVOICE</div>
        </div>
        
        <div class="info-row">
            <div>
                <p><strong>Invoice No:</strong> {invoice.get('invoice_number', '')}</p>
                <p><strong>Invoice Date:</strong> {format_date(invoice.get('invoice_date', ''))}</p>
            </div>
            <div class="due-date-box">
                <p style="font-weight: bold; font-size: 11px;">PAYMENT DUE BY</p>
                <p style="font-weight: bold; font-size: 14px;">{format_date(invoice.get('due_date', ''))}</p>
            </div>
        </div>
        
        <div class="separator"></div>
        
        <div class="parties">
            <div class="party">
                <div class="party-header">Issued By</div>
                <div class="party-content">
                    <p style="font-weight: 600;">{company.get('name', '')}</p>
                    <p style="color: #64748b;">{company.get('address', '')}</p>
                    <p><span style="color: #64748b;">State:</span> {company.get('state', 'Haryana')} | <span style="color: #64748b;">GSTIN:</span> <span style="font-family: monospace;">{company.get('gstin', '')}</span></p>
                </div>
            </div>
            <div class="party">
                <div class="party-header">Bill To</div>
                <div class="party-content">
                    <p style="font-weight: 600;">{client.get('company_name', '')}</p>
                    <p style="color: #64748b;">{client.get('address', '')}</p>
                    <p><span style="color: #64748b;">State:</span> Haryana | <span style="color: #64748b;">GSTIN:</span> <span style="font-family: monospace;">{client.get('gstin', '-')}</span></p>
                </div>
            </div>
        </div>
        
        <table class="items-table">
            <thead>
                <tr>
                    <th style="width: 40px; text-align: center;">S.No.</th>
                    <th>Particulars</th>
                    <th style="width: 60px; text-align: center;">HSN/SAC</th>
                    <th style="width: 50px; text-align: center;">Qty</th>
                    <th style="width: 70px; text-align: right;">Rate</th>
                    <th style="width: 45px; text-align: center;">Per</th>
                    <th style="width: 85px; text-align: right;">Amount (Rs.)</th>
                </tr>
            </thead>
            <tbody>
                {items_html}
            </tbody>
        </table>
        
        <div class="totals-container">
            <table class="totals-table">
                <tr>
                    <td>Sub Total</td>
                    <td style="text-align: right; font-family: monospace;">Rs. {subtotal:,.2f}</td>
                </tr>
                <tr>
                    <td style="font-size: 10px;">CGST (9%) on Plan fee</td>
                    <td style="text-align: right; font-family: monospace; font-size: 10px;">Rs. {total_cgst:,.2f}</td>
                </tr>
                <tr>
                    <td style="font-size: 10px;">SGST (9%) on Plan fee</td>
                    <td style="text-align: right; font-family: monospace; font-size: 10px;">Rs. {total_sgst:,.2f}</td>
                </tr>
                {round_off_html}
                <tr class="total-row">
                    <td style="padding: 6px 10px;">Total Amount</td>
                    <td style="text-align: right; font-family: monospace; padding: 6px 10px;">Rs. {int(grand_total):,}</td>
                </tr>
            </table>
        </div>
        
        <div class="amount-words">
            <strong>Amount Chargeable (in words):</strong> <span style="color: #2E375B; font-weight: 600;">{number_to_words(int(grand_total))}</span>
        </div>
        
        <div class="footer-section">
            <div class="bank-details">
                <p style="font-weight: bold; margin-bottom: 4px;">Company's Bank Details</p>
                <p><span style="color: #64748b;">A/c Name:</span> {company.get('bank', {}).get('account_name', company.get('name', ''))}</p>
                <p><span style="color: #64748b;">Bank:</span> {company.get('bank', {}).get('name', 'HDFC Bank')} | <span style="color: #64748b;">A/c No.:</span> <span style="font-family: monospace;">{company.get('bank', {}).get('account_no', '50200115952448')}</span></p>
                <p><span style="color: #64748b;">Branch:</span> {company.get('bank', {}).get('branch', 'Sector 16, Faridabad')} | <span style="color: #64748b;">IFSC:</span> <span style="font-family: monospace;">{company.get('bank', {}).get('ifsc', 'HDFC0000279')}</span></p>
            </div>
            <div class="signature">
                <p style="font-size: 10px; color: #94a3b8;">E. & O.E.</p>
                <img src="https://customer-assets.emergentagent.com/job_683f7dfb-7860-4882-8d93-58ac3f0439b2/artifacts/x6h984ax_Untitled%20design.jpg" alt="Signature" />
                <p style="font-weight: 600;">for {company.get('name', 'Thryve Coworking')}</p>
                <p style="color: #64748b;">Authorised Signatory</p>
            </div>
        </div>
        
        <div class="declaration">
            <strong>Declaration:</strong> We declare that this invoice shows the actual price of the Services described and that all particulars are true and correct.
        </div>
        
        <div class="thank-you">
            <p>Thank you for choosing Thryve Coworking!</p>
            <p>This is a Computer Generated Invoice</p>
        </div>
    </div>
</body>
</html>'''
    
    return html


def generate_pdf_from_html(invoice: dict) -> bytes:
    """Generate PDF from HTML using WeasyPrint (no browser needed)"""
    html_content = generate_invoice_html(invoice)
    font_config = FontConfiguration()
    html = HTML(string=html_content)
    pdf_bytes = html.write_pdf(font_config=font_config, presentational_hints=True)
    return pdf_bytes


async def generate_pdf_from_html_async(invoice: dict) -> bytes:
    """Async wrapper for PDF generation"""
    return generate_pdf_from_html(invoice)
