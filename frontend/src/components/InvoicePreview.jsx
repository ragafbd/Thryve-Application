import { Building2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const SERVICE_TYPE_LABELS = {
  monthly_rental: "Monthly Rental",
  security_deposit: "Refundable Security Deposit",
  setup_charges: "Setup Charges",
  day_pass: "Day Pass",
  meeting_room: "Meeting Room Charges"
};

export default function InvoicePreview({ invoice, isPreview = false }) {
  const company = invoice?.company || {
    name: "Thryve Coworking",
    address: "123 Business Park, Tech Hub, Bangalore - 560001",
    gstin: "29AABCT1234F1Z5",
    email: "billing@thryvecoworking.com",
    phone: "+91 80 1234 5678"
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return "₹0.00";
    return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="p-8 md:p-12 bg-white min-h-[800px]" data-testid="invoice-preview">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-[#064E3B] flex items-center justify-center">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-[Manrope]">
              {company.name}
            </h1>
            <p className="text-sm text-slate-500 mt-1">{company.address}</p>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-3xl font-bold text-[#064E3B] uppercase tracking-wider font-[Manrope]">
            Invoice
          </h2>
          <p className="font-mono text-sm text-slate-600 mt-2">
            {invoice?.invoice_number || "THR/XXXX/XX/XXXX"}
          </p>
        </div>
      </div>

      {/* Company & Client Info */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        {/* From */}
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            From
          </h3>
          <div className="space-y-1">
            <p className="font-semibold text-slate-900">{company.name}</p>
            <p className="text-sm text-slate-600">{company.address}</p>
            <p className="text-sm font-mono text-[#064E3B]">GSTIN: {company.gstin}</p>
            <p className="text-sm text-slate-500">{company.email}</p>
            <p className="text-sm text-slate-500">{company.phone}</p>
          </div>
        </div>

        {/* To */}
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Bill To
          </h3>
          {invoice?.client ? (
            <div className="space-y-1">
              <p className="font-semibold text-slate-900">{invoice.client.company_name}</p>
              <p className="text-sm text-slate-600">{invoice.client.address}</p>
              <p className="text-sm font-mono text-[#064E3B]">GSTIN: {invoice.client.gstin}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">Select a client</p>
          )}
        </div>
      </div>

      {/* Invoice Details */}
      <div className="flex gap-8 mb-8">
        <div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Invoice Date
          </span>
          <p className="font-mono text-slate-900 mt-1">
            {formatDate(invoice?.invoice_date)}
          </p>
        </div>
      </div>

      <Separator className="mb-6" />

      {/* Line Items Table */}
      <div className="mb-8">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3">
                Description
              </th>
              <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider py-3">
                Qty
              </th>
              <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider py-3">
                Rate
              </th>
              <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider py-3">
                Amount
              </th>
              <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider py-3">
                CGST (9%)
              </th>
              <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider py-3">
                SGST (9%)
              </th>
              <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider py-3">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice?.line_items?.length > 0 ? (
              invoice.line_items.map((item, index) => (
                <tr key={index} className="border-b border-slate-100">
                  <td className="py-4">
                    <p className="font-medium text-slate-900">
                      {item.description || SERVICE_TYPE_LABELS[item.service_type] || "-"}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {SERVICE_TYPE_LABELS[item.service_type]}
                      {!item.is_taxable && " (Non-taxable)"}
                    </p>
                  </td>
                  <td className="py-4 text-center font-mono text-slate-700">
                    {item.quantity}
                  </td>
                  <td className="py-4 text-right font-mono text-slate-700">
                    {formatCurrency(item.rate)}
                  </td>
                  <td className="py-4 text-right font-mono text-slate-700">
                    {formatCurrency(item.amount || item.quantity * item.rate)}
                  </td>
                  <td className="py-4 text-right font-mono text-slate-500 text-sm">
                    {item.is_taxable ? formatCurrency(item.cgst || (item.quantity * item.rate * 0.09)) : "-"}
                  </td>
                  <td className="py-4 text-right font-mono text-slate-500 text-sm">
                    {item.is_taxable ? formatCurrency(item.sgst || (item.quantity * item.rate * 0.09)) : "-"}
                  </td>
                  <td className="py-4 text-right font-mono font-semibold text-slate-900">
                    {formatCurrency(item.total || (item.quantity * item.rate + (item.is_taxable ? item.quantity * item.rate * 0.18 : 0)))}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  No items added yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-80">
          <div className="flex justify-between py-2 text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-mono text-slate-700">{formatCurrency(invoice?.subtotal)}</span>
          </div>
          <div className="flex justify-between py-2 text-sm">
            <span className="text-slate-500">CGST (9%)</span>
            <span className="font-mono text-slate-700">{formatCurrency(invoice?.total_cgst)}</span>
          </div>
          <div className="flex justify-between py-2 text-sm">
            <span className="text-slate-500">SGST (9%)</span>
            <span className="font-mono text-slate-700">{formatCurrency(invoice?.total_sgst)}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between py-2 text-sm">
            <span className="text-slate-500">Total Tax</span>
            <span className="font-mono text-slate-700">{formatCurrency(invoice?.total_tax)}</span>
          </div>
          <div className="flex justify-between py-3 bg-[#064E3B] text-white px-4 rounded-lg mt-2">
            <span className="font-semibold">Grand Total</span>
            <span className="font-mono font-bold text-lg">
              {formatCurrency(invoice?.grand_total)}
            </span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {invoice?.notes && (
        <div className="mt-8 p-4 bg-slate-50 rounded-lg">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Notes
          </h4>
          <p className="text-sm text-slate-600">{invoice.notes}</p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 pt-6 border-t border-slate-200 text-center">
        <p className="text-xs text-slate-400">
          This is a computer-generated invoice. No signature is required.
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Thank you for choosing {company.name}!
        </p>
      </div>
    </div>
  );
}
