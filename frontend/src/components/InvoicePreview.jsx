import { Separator } from "@/components/ui/separator";

const SERVICE_TYPE_LABELS = {
  monthly_rental: "Monthly Plan",
  security_deposit: "Refundable Security Deposit",
  setup_charges: "Setup Charges",
  day_pass: "Day Pass",
  meeting_room: "Meeting Room Charges"
};

const HSN_SAC_CODES = {
  monthly_rental: "997212",
  day_pass: "997212",
  meeting_room: "997212",
  security_deposit: "",
  setup_charges: ""
};

// Convert number to words (Indian format)
function numberToWords(num) {
  if (num === 0) return "Zero";
  
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  
  function convertLessThanThousand(n) {
    if (n === 0) return "";
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + ones[n % 10] : "");
    return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 !== 0 ? " " + convertLessThanThousand(n % 100) : "");
  }
  
  function convert(n) {
    if (n === 0) return "";
    
    let result = "";
    
    // Crores
    if (n >= 10000000) {
      result += convertLessThanThousand(Math.floor(n / 10000000)) + " Crore ";
      n %= 10000000;
    }
    
    // Lakhs
    if (n >= 100000) {
      result += convertLessThanThousand(Math.floor(n / 100000)) + " Lakh ";
      n %= 100000;
    }
    
    // Thousands
    if (n >= 1000) {
      result += convertLessThanThousand(Math.floor(n / 1000)) + " Thousand ";
      n %= 1000;
    }
    
    // Hundreds
    if (n > 0) {
      result += convertLessThanThousand(n);
    }
    
    return result.trim();
  }
  
  const intPart = Math.floor(num);
  return "Rupees " + convert(intPart) + " Only";
}

export default function InvoicePreview({ invoice, isPreview = false }) {
  const company = invoice?.company || {
    name: "Thryve Coworking",
    address: "18/1, Plot no. 3, Azad Colony, Mathura Road, Sector 15 A, Faridabad, Haryana 121007",
    gstin: "06AAYFT8213A1Z2",
    state: "Haryana",
    email: "billing@thryvecoworking.com",
    phone: "+91 80 1234 5678",
    bank: {
      name: "HDFC Bank",
      account_name: "Thryve Coworking",
      account_no: "50200115952448",
      branch: "Sector 16, Faridabad",
      ifsc: "HDFC0000279"
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      const months = ["January", "February", "March", "April", "May", "June", 
        "July", "August", "September", "October", "November", "December"];
      return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return "0.00";
    return Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Calculate taxable amount for GST calculation display
  const taxableAmount = invoice?.line_items?.reduce((sum, item) => {
    if (item.is_taxable) {
      return sum + (item.amount || item.quantity * item.rate);
    }
    return sum;
  }, 0) || 0;

  return (
    <div className="bg-white min-h-[1000px] text-slate-800" style={{ fontFamily: "'Source Sans 3', 'Calibri', sans-serif" }} data-testid="invoice-preview">
      {/* Header */}
      <div className="border-b-2 border-slate-800 p-6 pb-4">
        <div className="flex justify-between items-start">
          {/* Logo & Company */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-[#064E3B] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-2xl">T</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#064E3B] tracking-wide">
                THRYVE COWORKING
              </h1>
            </div>
          </div>
          
          {/* Invoice Title */}
          <div className="text-right">
            <h2 className="text-2xl font-bold text-slate-800 border-2 border-slate-800 px-4 py-1">
              TAX INVOICE
            </h2>
          </div>
        </div>
        
        {/* Invoice Details Row */}
        <div className="mt-4 flex justify-between text-sm">
          <div className="space-y-1">
            <p><span className="font-semibold">Invoice No:</span> <span className="font-numbers">{invoice?.invoice_number || "THR/XXXX/XX/XXXX"}</span></p>
            <p><span className="font-semibold">Invoice Date:</span> <span className="font-numbers">{formatDate(invoice?.invoice_date)}</span></p>
            <p><span className="font-semibold">Terms of Payment:</span> Due on Receipt</p>
          </div>
        </div>
      </div>

      {/* Issued By / Bill To Section */}
      <div className="grid grid-cols-2 border-b border-slate-300">
        {/* Issued By */}
        <div className="p-4 border-r border-slate-300">
          <h3 className="font-bold text-sm mb-2 bg-slate-100 px-2 py-1">Issued By</h3>
          <div className="text-sm space-y-1 px-2">
            <p className="font-semibold">{company.name}</p>
            <p className="text-slate-600">{company.address}</p>
            <p><span className="text-slate-500">State Name:</span> {company.state || "Haryana"}</p>
            <p><span className="text-slate-500">GSTIN:</span> <span className="font-numbers">{company.gstin}</span></p>
            <p><span className="text-slate-500">Terms of Delivery:</span></p>
          </div>
        </div>
        
        {/* Bill To */}
        <div className="p-4">
          <h3 className="font-bold text-sm mb-2 bg-slate-100 px-2 py-1">Bill To</h3>
          {invoice?.client ? (
            <div className="text-sm space-y-1 px-2">
              <p className="font-semibold">{invoice.client.company_name}</p>
              <p className="text-slate-600">{invoice.client.address}</p>
              <p><span className="text-slate-500">State Name:</span> Haryana</p>
              <p><span className="text-slate-500">GSTIN:</span> <span className="font-numbers">{invoice.client.gstin}</span></p>
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic px-2">Select a client</p>
          )}
        </div>
      </div>

      {/* Line Items Table */}
      <div className="p-4">
        <table className="w-full text-sm border border-slate-300">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 px-2 py-2 text-left font-semibold w-12">S. No.</th>
              <th className="border border-slate-300 px-2 py-2 text-left font-semibold">Particulars</th>
              <th className="border border-slate-300 px-2 py-2 text-center font-semibold w-20">HSN/SAC</th>
              <th className="border border-slate-300 px-2 py-2 text-center font-semibold w-16">Quantity</th>
              <th className="border border-slate-300 px-2 py-2 text-right font-semibold w-24">Rate</th>
              <th className="border border-slate-300 px-2 py-2 text-center font-semibold w-16">Per</th>
              <th className="border border-slate-300 px-2 py-2 text-right font-semibold w-28">Amount (Rs.)</th>
            </tr>
          </thead>
          <tbody>
            {invoice?.line_items?.length > 0 ? (
              invoice.line_items.map((item, index) => (
                <tr key={index}>
                  <td className="border border-slate-300 px-2 py-2 text-center font-numbers">{index + 1}</td>
                  <td className="border border-slate-300 px-2 py-2">
                    <p className="font-medium">{item.description || SERVICE_TYPE_LABELS[item.service_type]}</p>
                    {item.service_type === 'monthly_rental' && (
                      <p className="text-xs text-slate-500">Workspace subscription for {item.quantity} month{item.quantity > 1 ? 's' : ''}</p>
                    )}
                    {item.service_type === 'security_deposit' && (
                      <p className="text-xs text-slate-500">No GST Applicable</p>
                    )}
                    {item.is_prorated && item.prorate_days && (
                      <p className="text-xs text-amber-600">Prorated: {item.prorate_days} of {item.prorate_total_days} days</p>
                    )}
                  </td>
                  <td className="border border-slate-300 px-2 py-2 text-center font-numbers">
                    {item.hsn_sac || HSN_SAC_CODES[item.service_type] || ""}
                  </td>
                  <td className="border border-slate-300 px-2 py-2 text-center font-numbers">{item.quantity}</td>
                  <td className="border border-slate-300 px-2 py-2 text-right font-numbers">
                    {formatCurrency(item.rate)}
                  </td>
                  <td className="border border-slate-300 px-2 py-2 text-center">{item.unit || "Units"}</td>
                  <td className="border border-slate-300 px-2 py-2 text-right font-numbers font-medium">
                    {formatCurrency(item.amount || item.quantity * item.rate)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="border border-slate-300 px-2 py-8 text-center text-slate-400">
                  No items added yet
                </td>
              </tr>
            )}
            
            {/* Empty rows for visual consistency */}
            {invoice?.line_items?.length > 0 && invoice.line_items.length < 3 && (
              [...Array(3 - invoice.line_items.length)].map((_, i) => (
                <tr key={`empty-${i}`}>
                  <td className="border border-slate-300 px-2 py-2">&nbsp;</td>
                  <td className="border border-slate-300 px-2 py-2"></td>
                  <td className="border border-slate-300 px-2 py-2"></td>
                  <td className="border border-slate-300 px-2 py-2"></td>
                  <td className="border border-slate-300 px-2 py-2"></td>
                  <td className="border border-slate-300 px-2 py-2"></td>
                  <td className="border border-slate-300 px-2 py-2"></td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mt-0">
          <table className="text-sm border border-t-0 border-slate-300 w-80">
            <tbody>
              <tr>
                <td className="border border-slate-300 px-3 py-1 font-semibold bg-slate-50">Sub Total</td>
                <td className="border border-slate-300 px-3 py-1 text-right font-numbers font-medium w-28">
                  {formatCurrency(invoice?.subtotal)}
                </td>
              </tr>
              <tr>
                <td className="border border-slate-300 px-3 py-1 text-slate-600">CGST (9%) on Plan fee</td>
                <td className="border border-slate-300 px-3 py-1 text-right font-numbers">
                  {formatCurrency(invoice?.total_cgst)}
                </td>
              </tr>
              <tr>
                <td className="border border-slate-300 px-3 py-1 text-slate-600">SGST (9%) on Plan fee</td>
                <td className="border border-slate-300 px-3 py-1 text-right font-numbers">
                  {formatCurrency(invoice?.total_sgst)}
                </td>
              </tr>
              <tr className="bg-slate-100">
                <td className="border border-slate-300 px-3 py-2 font-bold">Total Amount</td>
                <td className="border border-slate-300 px-3 py-2 text-right font-numbers font-bold text-lg">
                  {formatCurrency(invoice?.grand_total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Amount in Words */}
        <div className="mt-4 p-3 bg-slate-50 border border-slate-200">
          <p className="text-sm">
            <span className="font-semibold">Amount Chargeable (in words):</span><br />
            <span className="italic">{numberToWords(invoice?.grand_total || 0)}</span>
          </p>
        </div>
      </div>

      {/* Bank Details & Signature */}
      <div className="grid grid-cols-2 border-t border-slate-300 mt-4">
        {/* Bank Details */}
        <div className="p-4 border-r border-slate-300">
          <h3 className="font-bold text-sm mb-2">Company's Bank Details</h3>
          <div className="text-sm space-y-1">
            <p><span className="text-slate-500">Bank Name:</span> {company.bank?.name || "HDFC Bank"}</p>
            <p><span className="text-slate-500">A/c Name:</span> {company.bank?.account_name || company.name}</p>
            <p><span className="text-slate-500">Current A/c No.:</span> <span className="font-numbers">{company.bank?.account_no || "50200115952448"}</span></p>
            <p><span className="text-slate-500">Branch:</span> {company.bank?.branch || "Sector 16, Faridabad"}</p>
            <p><span className="text-slate-500">IFSC:</span> <span className="font-numbers">{company.bank?.ifsc || "HDFC0000279"}</span></p>
          </div>
        </div>
        
        {/* Signature */}
        <div className="p-4 text-right">
          <p className="text-xs text-slate-400 mb-8">E. & O.E.</p>
          <p className="font-semibold">for {company.name}</p>
          <div className="h-12 border-b border-slate-300 mb-2"></div>
          <p className="text-sm text-slate-500">Authorised Signatory</p>
        </div>
      </div>

      {/* Declaration */}
      <div className="p-4 border-t border-slate-300 text-xs text-slate-600">
        <p><span className="font-semibold">Declaration:</span> We declare that this invoice shows the actual price of the Services described and that all particulars are true and correct.</p>
      </div>

      {/* Footer */}
      <div className="text-center py-3 border-t border-slate-200 bg-slate-50">
        <p className="text-xs text-slate-400">This is a Computer Generated Invoice</p>
      </div>
    </div>
  );
}
