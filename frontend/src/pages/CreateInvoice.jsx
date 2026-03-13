import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { 
  Plus, 
  Trash2, 
  CalendarIcon, 
  FileDown,
  Building2,
  Eye
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import axios from "axios";
import InvoicePreview from "@/components/InvoicePreview";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SERVICE_TYPES = [
  { value: "monthly_rental", label: "Monthly Plan", taxable: true, hsn: "997212", unit: "Month" },
  { value: "security_deposit", label: "Refundable Security Deposit", taxable: false, hsn: "", unit: "Units" },
  { value: "setup_charges", label: "Setup Charges", taxable: true, hsn: "997212", unit: "Units" },
  { value: "day_pass", label: "Day Pass", taxable: true, hsn: "997212", unit: "Day" },
  { value: "meeting_room", label: "Meeting Room Charges", taxable: true, hsn: "997212", unit: "Hour" },
];

const emptyLineItem = {
  description: "Monthly Plan", // Default description from service type
  service_type: "monthly_rental",
  quantity: "",  // Will be populated from client data
  rate: "",      // Will be populated from client data (blank if no rate)
  is_taxable: true,
  hsn_sac: "997212",
  unit: "Month",
  is_prorated: false,
  prorate_days: null,
  prorate_total_days: 30
};

export default function CreateInvoice() {
  const navigate = useNavigate();
  const previewRef = useRef(null);
  
  const [clients, setClients] = useState([]);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [selectedClientId, setSelectedClientId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date());
  const [dueDate, setDueDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 4); // Default: 4 days from invoice date
    return date;
  });
  const [lineItems, setLineItems] = useState([{ ...emptyLineItem }]);
  const [notes, setNotes] = useState("");
  const [pendingCharges, setPendingCharges] = useState([]);

  // Compute selectedClient from clients array
  const selectedClient = clients.find(c => c.id === selectedClientId);

  // Auto-update due date when invoice date changes (invoice date + 4 days)
  useEffect(() => {
    const newDueDate = new Date(invoiceDate);
    newDueDate.setDate(newDueDate.getDate() + 4);
    setDueDate(newDueDate);
  }, [invoiceDate]);

  // Auto-populate line item with client data when client is selected
  useEffect(() => {
    if (selectedClient) {
      // Auto-populate the first line item with client's seat quantity and rate
      setLineItems(prev => {
        const newItems = [...prev];
        // Only update the first non-meeting-room item (manual items)
        const firstManualItemIndex = newItems.findIndex(item => !item.booking_id);
        if (firstManualItemIndex !== -1 && newItems[firstManualItemIndex].service_type === 'monthly_rental') {
          newItems[firstManualItemIndex] = {
            ...newItems[firstManualItemIndex],
            quantity: selectedClient.total_seats || "",
            rate: selectedClient.rate_per_seat || "",
            description: selectedClient.plan_name ? `${selectedClient.plan_name}` : "Monthly Plan"
          };
        }
        return newItems;
      });
    }
  }, [selectedClient]);

  // Fetch pending meeting room charges when client is selected
  useEffect(() => {
    const fetchPendingCharges = async () => {
      if (!selectedClientId || !selectedClient) {
        setPendingCharges([]);
        // Remove auto-added meeting room items when no client selected
        setLineItems(prev => prev.filter(item => !item.booking_id));
        return;
      }
      try {
        const response = await axios.get(`${API}/management/pending-charges`);
        const clientCharges = response.data.company_charges.find(
          c => c.company_name === selectedClient.company_name
        );
        if (clientCharges && clientCharges.bookings.length > 0) {
          setPendingCharges(clientCharges.bookings);
          // Auto-add meeting room charges as line items
          const meetingRoomItems = clientCharges.bookings.map(booking => ({
            description: `Meeting Room - ${booking.room_name} (${booking.date})`,
            service_type: "meeting_room",
            quantity: 1,
            rate: booking.amount,
            is_taxable: true,
            hsn_sac: "997212",
            unit: "Units",
            is_prorated: false,
            prorate_days: null,
            prorate_total_days: 30,
            booking_id: booking.booking_id // Track which booking this is for
          }));
          // Add to existing line items
          setLineItems(prev => {
            // Remove any existing meeting room items that are auto-added
            const nonMeetingItems = prev.filter(item => !item.booking_id);
            return [...nonMeetingItems, ...meetingRoomItems];
          });
        } else {
          setPendingCharges([]);
          // Remove auto-added meeting room items
          setLineItems(prev => prev.filter(item => !item.booking_id));
        }
      } catch (error) {
        console.error("Failed to fetch pending charges");
      }
    };
    fetchPendingCharges();
  }, [selectedClientId, selectedClient]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clientsRes, companyRes] = await Promise.all([
          axios.get(`${API}/companies`),  // Use companies instead of clients
          axios.get(`${API}/company`)
        ]);
        setClients(clientsRes.data);
        setCompany(companyRes.data);
      } catch (error) {
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleServiceTypeChange = (index, value) => {
    const service = SERVICE_TYPES.find(s => s.value === value);
    const newItems = [...lineItems];
    // Auto-populate all fields from the service type - no separate description input needed
    newItems[index] = {
      ...newItems[index],
      service_type: value,
      description: service?.label || value, // Use service label as description
      is_taxable: service?.taxable ?? true,
      hsn_sac: service?.hsn || "",
      unit: service?.unit || "Units"
    };
    setLineItems(newItems);
  };

  const handleLineItemChange = (index, field, value) => {
    const newItems = [...lineItems];
    
    // Handle numeric fields properly - allow empty string and direct input
    if (field === 'quantity' || field === 'rate') {
      // Allow empty string or valid numbers
      if (value === '' || value === null || value === undefined) {
        newItems[index] = { ...newItems[index], [field]: '' };
      } else {
        // Parse as number, but keep as string if it's being typed
        const numValue = parseFloat(value);
        newItems[index] = { ...newItems[index], [field]: isNaN(numValue) ? '' : numValue };
      }
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    
    setLineItems(newItems);
  };

  const addLineItem = () => {
    // Create new line item - populate with client data if available
    const newItem = {
      ...emptyLineItem,
      quantity: selectedClient?.total_seats || "",
      rate: selectedClient?.rate_per_seat || "",
      description: selectedClient?.plan_name || "Monthly Plan"
    };
    setLineItems([...lineItems, newItem]);
  };

  const removeLineItem = (index) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  // Calculate totals
  const calculateTotals = () => {
    let subtotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;

    lineItems.forEach(item => {
      // Handle empty or invalid quantity/rate as 0 for calculation
      const qty = parseFloat(item.quantity) || 0;
      const rate = parseFloat(item.rate) || 0;
      
      let amount;
      if (item.is_prorated && item.prorate_days && item.prorate_total_days) {
        amount = qty * (rate / item.prorate_total_days) * item.prorate_days;
      } else {
        amount = qty * rate;
      }
      subtotal += amount;
      if (item.is_taxable) {
        totalCgst += amount * 0.09;
        totalSgst += amount * 0.09;
      }
    });

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalCgst: Math.round(totalCgst * 100) / 100,
      totalSgst: Math.round(totalSgst * 100) / 100,
      totalTax: Math.round((totalCgst + totalSgst) * 100) / 100,
      grandTotal: Math.round((subtotal + totalCgst + totalSgst) * 100) / 100
    };
  };

  const totals = calculateTotals();

  // Build preview data
  const previewData = {
    invoice_number: "THR/XXXX/XX/XXXX",
    invoice_date: invoiceDate.toISOString(),
    due_date: dueDate.toISOString(),
    client: selectedClient || null,
    company: company,
    line_items: lineItems.map(item => {
      const qty = parseFloat(item.quantity) || 0;
      const rate = parseFloat(item.rate) || 0;
      let amount;
      if (item.is_prorated && item.prorate_days && item.prorate_total_days) {
        amount = qty * (rate / item.prorate_total_days) * item.prorate_days;
      } else {
        amount = qty * rate;
      }
      return {
        ...item,
        quantity: qty,
        rate: rate,
        amount: amount,
        cgst: item.is_taxable ? amount * 0.09 : 0,
        sgst: item.is_taxable ? amount * 0.09 : 0,
        total: amount + (item.is_taxable ? amount * 0.18 : 0)
      };
    }),
    subtotal: totals.subtotal,
    total_cgst: totals.totalCgst,
    total_sgst: totals.totalSgst,
    total_tax: totals.totalTax,
    grand_total: totals.grandTotal,
    notes: notes
  };

  const handleSaveInvoice = async () => {
    if (!selectedClientId) {
      toast.error("Please select a client");
      return;
    }
    
    // Validate that all line items have valid quantity and rate
    const invalidItems = lineItems.filter(item => {
      const qty = parseFloat(item.quantity);
      const rate = parseFloat(item.rate);
      return isNaN(qty) || qty <= 0 || isNaN(rate) || rate <= 0;
    });
    
    if (invalidItems.length > 0) {
      toast.error("Please enter valid quantity and rate for all line items");
      return;
    }

    setSaving(true);
    try {
      // Ensure numeric values are proper numbers before sending
      const processedLineItems = lineItems.map(item => ({
        ...item,
        quantity: parseFloat(item.quantity) || 0,
        rate: parseFloat(item.rate) || 0
      }));
      
      const response = await axios.post(`${API}/invoices`, {
        client_id: selectedClientId,
        invoice_date: invoiceDate.toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
        line_items: processedLineItems,
        notes: notes
      });
      toast.success("Invoice created successfully!");
      navigate(`/invoices/${response.data.id}`);
    } catch (error) {
      toast.error("Failed to create invoice");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="create-invoice-page">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight font-[Manrope]">
          Create Invoice
        </h1>
        <p className="text-slate-600 mt-1">
          Generate a new invoice for your client
        </p>
      </div>

      {/* Split View Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Left: Form */}
        <div className="space-y-6">
          {/* Client & Date Selection */}
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold font-[Manrope]">
                Invoice Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Client Selection */}
              <div className="space-y-2">
                <Label>Select Client</Label>
                {clients.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-lg text-center">
                    <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No clients found</p>
                    <Button
                      variant="link"
                      className="text-[#2E375B]"
                      onClick={() => navigate("/admin/companies")}
                    >
                      Add a client first
                    </Button>
                  </div>
                ) : (
                  <Select
                    value={selectedClientId}
                    onValueChange={setSelectedClientId}
                  >
                    <SelectTrigger data-testid="client-select">
                      <SelectValue placeholder="Choose a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Selected Client Details */}
              {selectedClient && (
                <div className="p-4 bg-[#FFD4B0] rounded-lg">
                  <p className="font-medium text-slate-900">{selectedClient.company_name}</p>
                  <p className="text-sm text-slate-600 mt-1">{selectedClient.company_address}</p>
                  {selectedClient.company_gstin && (
                    <p className="text-xs font-mono text-[#2E375B] mt-2">
                      GSTIN: {selectedClient.company_gstin}
                    </p>
                  )}
                </div>
              )}

              {/* Invoice Date */}
              <div className="space-y-2">
                <Label>Invoice Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-mono",
                        !invoiceDate && "text-muted-foreground"
                      )}
                      data-testid="invoice-date-picker"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {invoiceDate ? format(invoiceDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={invoiceDate}
                      onSelect={(date) => date && setInvoiceDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Due Date */}
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-mono",
                        !dueDate && "text-muted-foreground"
                      )}
                      data-testid="due-date-picker"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, "PPP") : "Pick due date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={(date) => date && setDueDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold font-[Manrope]">
                  Services / Line Items
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addLineItem}
                  className="text-[#2E375B] border-[#2E375B] hover:bg-[#FFD4B0]"
                  data-testid="add-line-item-btn"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {lineItems.map((item, index) => (
                <div 
                  key={index} 
                  className="p-4 bg-slate-50 rounded-lg space-y-4"
                  data-testid={`line-item-${index}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-500">
                      Item #{index + 1}
                    </span>
                    {lineItems.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => removeLineItem(index)}
                        data-testid={`remove-line-item-${index}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Service Type */}
                    <div className="col-span-2 space-y-2">
                      <Label>Service Type</Label>
                      <Select
                        value={item.service_type}
                        onValueChange={(value) => handleServiceTypeChange(index, value)}
                      >
                        <SelectTrigger data-testid={`service-type-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SERVICE_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label} {type.taxable ? "(GST)" : "(No GST)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {/* Display selected description */}
                      {item.description && (
                        <p className="text-sm text-slate-600 mt-1">
                          Description: <span className="font-medium">{item.description}</span>
                        </p>
                      )}
                    </div>

                    {/* Quantity */}
                    <div className="space-y-2">
                      <Label>Quantity (Seats)</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={item.quantity}
                        onChange={(e) => {
                          const val = e.target.value;
                          // Allow empty or numeric values only
                          if (val === '' || /^\d*\.?\d*$/.test(val)) {
                            handleLineItemChange(index, "quantity", val === '' ? '' : parseFloat(val) || '');
                          }
                        }}
                        placeholder={selectedClient?.total_seats ? `${selectedClient.total_seats}` : "Enter quantity"}
                        className="font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        data-testid={`quantity-${index}`}
                      />
                    </div>

                    {/* Rate */}
                    <div className="space-y-2">
                      <Label>Rate (₹)</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9]*\.?[0-9]*"
                        value={item.rate}
                        onChange={(e) => {
                          const val = e.target.value;
                          // Allow empty or numeric values (with decimal) only
                          if (val === '' || /^\d*\.?\d*$/.test(val)) {
                            handleLineItemChange(index, "rate", val === '' ? '' : parseFloat(val) || '');
                          }
                        }}
                        placeholder={selectedClient?.rate_per_seat ? `${selectedClient.rate_per_seat}` : "Enter rate"}
                        className="font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        data-testid={`rate-${index}`}
                      />
                    </div>

                    {/* GST Applicable */}
                    <div className="col-span-2 flex items-center space-x-2">
                      <Checkbox
                        id={`taxable-${index}`}
                        checked={item.is_taxable}
                        onCheckedChange={(checked) => handleLineItemChange(index, "is_taxable", checked)}
                        data-testid={`taxable-${index}`}
                      />
                      <Label htmlFor={`taxable-${index}`} className="text-sm">
                        GST Applicable (18%)
                      </Label>
                    </div>

                    {/* Prorate Billing */}
                    {item.service_type === 'monthly_rental' && (
                      <>
                        <div className="col-span-2 flex items-center space-x-2 pt-2 border-t border-slate-200">
                          <Checkbox
                            id={`prorated-${index}`}
                            checked={item.is_prorated}
                            onCheckedChange={(checked) => handleLineItemChange(index, "is_prorated", checked)}
                            data-testid={`prorated-${index}`}
                          />
                          <Label htmlFor={`prorated-${index}`} className="text-sm text-amber-700">
                            Enable Prorate Billing
                          </Label>
                        </div>
                        
                        {item.is_prorated && (
                          <div className="col-span-2 grid grid-cols-2 gap-3 p-3 bg-amber-50 rounded-lg">
                            <div className="space-y-1">
                              <Label className="text-xs text-amber-700">Days to Charge</Label>
                              <Input
                                type="number"
                                min="1"
                                max={item.prorate_total_days || 30}
                                value={item.prorate_days || ""}
                                onChange={(e) => handleLineItemChange(index, "prorate_days", parseInt(e.target.value) || null)}
                                placeholder="e.g., 15"
                                className="font-numbers h-9"
                                data-testid={`prorate-days-${index}`}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-amber-700">Total Days in Period</Label>
                              <Input
                                type="number"
                                min="1"
                                value={item.prorate_total_days || 30}
                                onChange={(e) => handleLineItemChange(index, "prorate_total_days", parseInt(e.target.value) || 30)}
                                className="font-numbers h-9"
                                data-testid={`prorate-total-days-${index}`}
                              />
                            </div>
                            {item.prorate_days && item.prorate_total_days && (
                              <div className="col-span-2 text-xs text-amber-700">
                                Charging for {item.prorate_days} of {item.prorate_total_days} days = {((item.prorate_days / item.prorate_total_days) * 100).toFixed(1)}% of monthly rate
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Item Total */}
                  <div className="text-right pt-2 border-t border-slate-200">
                    <span className="text-sm text-slate-500">Amount: </span>
                    <span className="font-numbers font-medium text-slate-900">
                      ₹{(() => {
                        let amt;
                        if (item.is_prorated && item.prorate_days && item.prorate_total_days) {
                          amt = item.quantity * (item.rate / item.prorate_total_days) * item.prorate_days;
                        } else {
                          amt = item.quantity * item.rate;
                        }
                        return amt.toLocaleString('en-IN');
                      })()}
                    </span>
                    {item.is_taxable && (
                      <span className="text-xs text-slate-400 ml-2">
                        + GST ₹{(() => {
                          let amt;
                          if (item.is_prorated && item.prorate_days && item.prorate_total_days) {
                            amt = item.quantity * (item.rate / item.prorate_total_days) * item.prorate_days;
                          } else {
                            amt = item.quantity * item.rate;
                          }
                          return (amt * 0.18).toLocaleString('en-IN');
                        })()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold font-[Manrope]">
                Notes (Optional)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional notes for this invoice..."
                rows={3}
                data-testid="invoice-notes"
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate("/invoices")}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-[#2E375B] hover:bg-[#232B47]"
              onClick={handleSaveInvoice}
              disabled={saving || !selectedClientId}
              data-testid="save-invoice-btn"
            >
              {saving ? "Creating..." : "Create Invoice"}
            </Button>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="hidden xl:block">
          <div className="sticky top-24">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="w-5 h-5 text-slate-400" />
              <span className="text-sm font-medium text-slate-500 uppercase tracking-wide">
                Live Preview
              </span>
            </div>
            <div ref={previewRef} className="bg-white rounded-xl shadow-lg overflow-hidden">
              <InvoicePreview invoice={previewData} isPreview={true} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
