"""
PDF Generator using Playwright for true WYSIWYG invoice PDFs.
Renders the same HTML/CSS as the web preview for pixel-perfect output.
"""

from playwright.async_api import async_playwright
from io import BytesIO
import asyncio

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

SERVICE_TYPE_LABELS = {
    "monthly_rental": "Monthly Plan (GST)",
    "security_deposit": "Security Deposit",
    "meeting_room": "Meeting Room Charges",
    "other": "Other Charges"
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
    
    if num >= 10000000:  # Crore
        return convert_chunk(num // 10000000) + ' Crore ' + number_to_words(num % 10000000).replace(' Only', '') + ' Only'
    elif num >= 100000:  # Lakh
        return convert_chunk(num // 100000) + ' Lakh ' + number_to_words(num % 100000).replace(' Only', '') + ' Only'
    elif num >= 1000:  # Thousand
        return convert_chunk(num // 1000) + ' Thousand ' + number_to_words(num % 1000).replace(' Only', '') + ' Only'
    else:
        return convert_chunk(num) + ' Rupees Only'


def generate_invoice_html(invoice: dict) -> str:
    """Generate HTML that matches the React InvoicePreview component exactly"""
    
    company = invoice.get('company', COMPANY_DETAILS)
    client = invoice.get('client', {})
    line_items = invoice.get('line_items', [])
    
    # Calculate totals
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
        
        # Sub-description based on service type
        sub_desc = ""
        if service_type == 'monthly_rental':
            sub_desc = '<p class="text-xs text-slate-500">Workspace subscription</p>'
        elif service_type == 'security_deposit':
            sub_desc = '<p class="text-xs text-slate-500">No GST Applicable</p>'
        elif item.get('is_prorated') and item.get('prorate_days'):
            sub_desc = f'<p class="text-xs text-amber-600">Prorated: {item.get("prorate_days")} of {item.get("prorate_total_days")} days</p>'
        
        items_html += f'''
        <tr>
            <td class="border border-slate-300 px-2 py-2 text-center">{idx}</td>
            <td class="border border-slate-300 px-2 py-2">
                <p class="font-medium">{item.get('description', '')}</p>
                {sub_desc}
            </td>
            <td class="border border-slate-300 px-2 py-2 text-center font-mono text-xs">{item.get('hsn_sac', '997212') if item.get('is_taxable', True) else ''}</td>
            <td class="border border-slate-300 px-2 py-2 text-center">{item.get('quantity', 1)}</td>
            <td class="border border-slate-300 px-2 py-2 text-right font-mono">Rs. {item.get('rate', 0):,.2f}</td>
            <td class="border border-slate-300 px-2 py-2 text-center">{item.get('unit', 'Month')}</td>
            <td class="border border-slate-300 px-2 py-2 text-right font-mono">Rs. {amount:,.2f}</td>
        </tr>
        '''
    
    # Round-off row
    round_off_html = ""
    if round_off != 0:
        round_off_str = f"+Rs. {round_off:,.2f}" if round_off >= 0 else f"-Rs. {abs(round_off):,.2f}"
        round_off_html = f'''
        <tr>
            <td class="border border-slate-300 px-3 py-1 text-sm">Round-Off Adjustment</td>
            <td class="border border-slate-300 px-3 py-1 text-right font-mono text-sm">{round_off_str}</td>
        </tr>
        '''
    
    html = f'''
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap');
            
            body {{
                font-family: 'Manrope', system-ui, sans-serif;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }}
            
            .font-mono {{
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            }}
            
            @page {{
                size: A4;
                margin: 10mm;
            }}
            
            @media print {{
                body {{
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }}
            }}
        </style>
    </head>
    <body class="bg-white p-0 m-0">
        <div class="max-w-[210mm] mx-auto bg-white text-slate-800 text-sm">
            
            <!-- Header: Logo + TAX INVOICE Box -->
            <div class="flex justify-between items-start mb-4">
                <img src="https://customer-assets.emergentagent.com/job_683f7dfb-7860-4882-8d93-58ac3f0439b2/artifacts/jqltfue2_Gemini_Generated_Image_xy33ixy33ixy33ix.png" 
                     alt="Thryve Coworking" class="h-16 w-auto" />
                <div class="border-2 border-slate-800 px-6 py-2">
                    <span class="font-bold text-lg">TAX INVOICE</span>
                </div>
            </div>
            
            <!-- Invoice Info Row -->
            <div class="flex justify-between items-center mb-4">
                <div class="text-sm">
                    <p><span class="font-semibold">Invoice No:</span> {invoice.get('invoice_number', '')}</p>
                    <p><span class="font-semibold">Invoice Date:</span> {format_date(invoice.get('invoice_date', ''))}</p>
                </div>
                <div class="bg-[#FFA14A] px-4 py-2 text-center">
                    <p class="font-bold text-[#2E375B] text-sm">PAYMENT DUE BY</p>
                    <p class="font-bold text-[#2E375B] text-lg">{format_date(invoice.get('due_date', ''))}</p>
                </div>
            </div>
            
            <!-- Separator -->
            <div class="border-b-2 border-slate-800 mb-4"></div>
            
            <!-- Issued By / Bill To Section -->
            <div class="grid grid-cols-2 border-b border-slate-300 mb-4">
                <!-- Issued By -->
                <div class="pr-4 border-r border-slate-300 pb-3">
                    <h3 class="font-bold text-sm mb-2 bg-slate-100 px-2 py-1">Issued By</h3>
                    <div class="text-sm space-y-1 px-2">
                        <p class="font-semibold">{company.get('name', '')}</p>
                        <p class="text-slate-600">{company.get('address', '')}</p>
                        <p><span class="text-slate-500">State:</span> {company.get('state', 'Haryana')} | <span class="text-slate-500">GSTIN:</span> <span class="font-mono">{company.get('gstin', '')}</span></p>
                    </div>
                </div>
                
                <!-- Bill To -->
                <div class="pl-4 pb-3">
                    <h3 class="font-bold text-sm mb-2 bg-slate-100 px-2 py-1">Bill To</h3>
                    <div class="text-sm space-y-1 px-2">
                        <p class="font-semibold">{client.get('company_name', '')}</p>
                        <p class="text-slate-600">{client.get('address', '')}</p>
                        <p><span class="text-slate-500">State:</span> Haryana | <span class="text-slate-500">GSTIN:</span> <span class="font-mono">{client.get('gstin', '-')}</span></p>
                    </div>
                </div>
            </div>
            
            <!-- Line Items Table -->
            <table class="w-full text-sm mb-2">
                <thead>
                    <tr class="bg-slate-100">
                        <th class="border border-slate-300 px-2 py-2 text-left font-semibold w-12">S. No.</th>
                        <th class="border border-slate-300 px-2 py-2 text-left font-semibold">Particulars</th>
                        <th class="border border-slate-300 px-2 py-2 text-center font-semibold w-20">HSN/SAC</th>
                        <th class="border border-slate-300 px-2 py-2 text-center font-semibold w-16">Quantity</th>
                        <th class="border border-slate-300 px-2 py-2 text-right font-semibold w-24">Rate</th>
                        <th class="border border-slate-300 px-2 py-2 text-center font-semibold w-16">Per</th>
                        <th class="border border-slate-300 px-2 py-2 text-right font-semibold w-28">Amount (Rs.)</th>
                    </tr>
                </thead>
                <tbody>
                    {items_html}
                </tbody>
            </table>
            
            <!-- Totals Table (Right Aligned) -->
            <div class="flex justify-end mb-2">
                <table class="text-sm w-64">
                    <tr>
                        <td class="border border-slate-300 px-3 py-1">Sub Total</td>
                        <td class="border border-slate-300 px-3 py-1 text-right font-mono">Rs. {subtotal:,.2f}</td>
                    </tr>
                    <tr>
                        <td class="border border-slate-300 px-3 py-1 text-sm">CGST (9%) on Plan fee</td>
                        <td class="border border-slate-300 px-3 py-1 text-right font-mono text-sm">Rs. {total_cgst:,.2f}</td>
                    </tr>
                    <tr>
                        <td class="border border-slate-300 px-3 py-1 text-sm">SGST (9%) on Plan fee</td>
                        <td class="border border-slate-300 px-3 py-1 text-right font-mono text-sm">Rs. {total_sgst:,.2f}</td>
                    </tr>
                    {round_off_html}
                    <tr class="bg-[#2E375B] text-white font-bold">
                        <td class="border border-slate-300 px-3 py-2">Total Amount</td>
                        <td class="border border-slate-300 px-3 py-2 text-right font-mono">Rs. {int(grand_total):,}</td>
                    </tr>
                </table>
            </div>
            
            <!-- Amount in Words -->
            <div class="bg-slate-100 px-3 py-2 mb-4">
                <p class="text-sm"><span class="font-semibold">Amount Chargeable (in words):</span> <span class="font-semibold text-[#2E375B]">{number_to_words(int(grand_total))}</span></p>
            </div>
            
            <!-- Bank Details & Signature -->
            <div class="grid grid-cols-2 border-t border-slate-300 pt-3">
                <!-- Bank Details -->
                <div class="pr-4 border-r border-slate-300">
                    <h3 class="font-bold text-sm mb-2">Company's Bank Details</h3>
                    <div class="text-sm space-y-1">
                        <p><span class="text-slate-500">A/c Name:</span> {company.get('bank', {}).get('account_name', company.get('name', ''))}</p>
                        <p><span class="text-slate-500">Bank:</span> {company.get('bank', {}).get('name', 'HDFC Bank')} | <span class="text-slate-500">A/c No.:</span> <span class="font-mono">{company.get('bank', {}).get('account_no', '50200115952448')}</span></p>
                        <p><span class="text-slate-500">Branch:</span> {company.get('bank', {}).get('branch', 'Sector 16, Faridabad')} | <span class="text-slate-500">IFSC:</span> <span class="font-mono">{company.get('bank', {}).get('ifsc', 'HDFC0000279')}</span></p>
                    </div>
                </div>
                
                <!-- Signature -->
                <div class="pl-4 text-right">
                    <p class="text-xs text-slate-400 mb-2">E. & O.E.</p>
                    <img src="https://customer-assets.emergentagent.com/job_683f7dfb-7860-4882-8d93-58ac3f0439b2/artifacts/x6h984ax_Untitled%20design.jpg" 
                         alt="Signature" class="h-10 w-auto ml-auto mb-1" />
                    <p class="font-semibold text-sm">for {company.get('name', 'Thryve Coworking')}</p>
                    <p class="text-sm text-slate-500">Authorised Signatory</p>
                </div>
            </div>
            
            <!-- Declaration -->
            <div class="mt-3 text-xs text-slate-500">
                <p><span class="font-semibold">Declaration:</span> We declare that this invoice shows the actual price of the Services described and that all particulars are true and correct.</p>
            </div>
            
            <!-- Footer -->
            <div class="mt-4 text-center">
                <p class="font-semibold text-[#2E375B]">Thank you for choosing Thryve Coworking!</p>
                <p class="text-xs text-slate-400">This is a Computer Generated Invoice</p>
            </div>
            
        </div>
    </body>
    </html>
    '''
    
    return html


async def generate_pdf_from_html(invoice: dict) -> bytes:
    """Generate PDF from HTML using Playwright for true WYSIWYG output"""
    
    html_content = generate_invoice_html(invoice)
    
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        # Set the HTML content
        await page.set_content(html_content, wait_until='networkidle')
        
        # Wait for images to load
        await page.wait_for_timeout(1000)
        
        # Generate PDF
        pdf_bytes = await page.pdf(
            format='A4',
            print_background=True,
            margin={
                'top': '10mm',
                'bottom': '10mm',
                'left': '10mm',
                'right': '10mm'
            }
        )
        
        await browser.close()
        
        return pdf_bytes
