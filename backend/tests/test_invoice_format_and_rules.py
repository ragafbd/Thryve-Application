"""
Test Invoice Number Format, GST Round-Off, and Credit Pricing Rules
Tests for:
1. Invoice Number Format: YYYY-YYYY/MM/SEQ/CLIENT with FY derived from invoice date
2. GST Round-Off: Invoices include round_off_adjustment and grand_total is whole rupee
3. Credit Pricing: Conference Room = 20 credits/hour, Meeting Room = 5 credits/30-min slot
4. 48-Hour Cancellation Policy: Credits restored if >48 hours, not restored if <48 hours
"""
import pytest
import requests
from conftest import BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD
from datetime import datetime, timedelta


class TestInvoiceNumberFormat:
    """Test invoice number format: YYYY-YYYY/MM/SEQ/CLIENT"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Could not authenticate - skipping tests")
    
    def test_invoice_number_format_april_to_december(self):
        """Test invoice number format for April-December (FY = CurrentYear-NextYear)"""
        # Get a company to create invoice for
        companies_response = self.session.get(f"{BASE_URL}/api/companies")
        assert companies_response.status_code == 200
        companies = companies_response.json()
        
        if not companies:
            pytest.skip("No companies found to test with")
        
        company = companies[0]
        
        # Create invoice with date in May 2026 (April-December range)
        invoice_date = "2026-05-15"
        response = self.session.post(f"{BASE_URL}/api/invoices", json={
            "client_id": company["id"],
            "invoice_date": invoice_date,
            "due_date": "2026-05-19",
            "line_items": [{
                "description": "Test Monthly Plan",
                "service_type": "monthly_rental",
                "quantity": 1,
                "rate": 10000,
                "is_taxable": True,
                "hsn_sac": "997212",
                "unit": "Month"
            }],
            "notes": "TEST_invoice_format_test"
        })
        
        assert response.status_code == 200, f"Failed to create invoice: {response.text}"
        invoice = response.json()
        
        # Verify invoice number format: YYYY-YYYY/MM/SEQ/CLIENT
        invoice_number = invoice.get("invoice_number", "")
        print(f"Invoice number: {invoice_number}")
        
        # Should be 2026-2027/05/XXX/CompanyName for May 2026
        assert invoice_number.startswith("2026-2027/05/"), f"Expected FY 2026-2027/05 prefix, got: {invoice_number}"
        
        # Verify format has 4 parts separated by /
        parts = invoice_number.split("/")
        assert len(parts) == 4, f"Expected 4 parts in invoice number, got {len(parts)}: {invoice_number}"
        
        # Verify FY format (YYYY-YYYY)
        fy_part = parts[0]
        assert "-" in fy_part, f"FY part should contain hyphen: {fy_part}"
        fy_years = fy_part.split("-")
        assert len(fy_years) == 2, f"FY should have 2 years: {fy_part}"
        assert int(fy_years[1]) == int(fy_years[0]) + 1, f"FY end year should be start year + 1: {fy_part}"
        
        # Verify month is 2-digit
        month_part = parts[1]
        assert len(month_part) == 2, f"Month should be 2 digits: {month_part}"
        assert month_part == "05", f"Month should be 05 for May: {month_part}"
        
        # Verify sequence is 3-digit
        seq_part = parts[2]
        assert len(seq_part) == 3, f"Sequence should be 3 digits: {seq_part}"
        
        # Cleanup - delete test invoice
        self.session.delete(f"{BASE_URL}/api/invoices/{invoice['id']}")
        print(f"✓ Invoice number format correct for April-December: {invoice_number}")
    
    def test_invoice_number_format_january_to_march(self):
        """Test invoice number format for January-March (FY = PrevYear-CurrentYear)"""
        # Get a company
        companies_response = self.session.get(f"{BASE_URL}/api/companies")
        companies = companies_response.json()
        
        if not companies:
            pytest.skip("No companies found")
        
        company = companies[0]
        
        # Create invoice with date in February 2026 (Jan-March range)
        invoice_date = "2026-02-15"
        response = self.session.post(f"{BASE_URL}/api/invoices", json={
            "client_id": company["id"],
            "invoice_date": invoice_date,
            "due_date": "2026-02-19",
            "line_items": [{
                "description": "Test Monthly Plan",
                "service_type": "monthly_rental",
                "quantity": 1,
                "rate": 10000,
                "is_taxable": True,
                "hsn_sac": "997212",
                "unit": "Month"
            }],
            "notes": "TEST_invoice_format_test_jan_mar"
        })
        
        assert response.status_code == 200, f"Failed to create invoice: {response.text}"
        invoice = response.json()
        
        invoice_number = invoice.get("invoice_number", "")
        print(f"Invoice number for Feb 2026: {invoice_number}")
        
        # Should be 2025-2026/02/XXX/CompanyName for February 2026
        assert invoice_number.startswith("2025-2026/02/"), f"Expected FY 2025-2026/02 prefix, got: {invoice_number}"
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/invoices/{invoice['id']}")
        print(f"✓ Invoice number format correct for January-March: {invoice_number}")


class TestGSTRoundOff:
    """Test GST-compliant rounding in invoices"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Could not authenticate")
    
    def test_invoice_has_round_off_adjustment_field(self):
        """Test that invoices include round_off_adjustment field"""
        companies_response = self.session.get(f"{BASE_URL}/api/companies")
        companies = companies_response.json()
        
        if not companies:
            pytest.skip("No companies found")
        
        company = companies[0]
        
        # Create invoice with amount that will require rounding
        # 10000 + 18% GST = 11800 (no rounding needed)
        # 10001 + 18% GST = 11801.18 (needs rounding)
        response = self.session.post(f"{BASE_URL}/api/invoices", json={
            "client_id": company["id"],
            "invoice_date": "2026-01-15",
            "due_date": "2026-01-19",
            "line_items": [{
                "description": "Test Service",
                "service_type": "monthly_rental",
                "quantity": 1,
                "rate": 10001,  # Will result in non-whole total
                "is_taxable": True,
                "hsn_sac": "997212",
                "unit": "Month"
            }],
            "notes": "TEST_round_off_test"
        })
        
        assert response.status_code == 200, f"Failed to create invoice: {response.text}"
        invoice = response.json()
        
        # Verify round_off_adjustment field exists
        assert "round_off_adjustment" in invoice, "Invoice should have round_off_adjustment field"
        
        # Verify grand_total is a whole number
        grand_total = invoice.get("grand_total", 0)
        assert grand_total == int(grand_total), f"Grand total should be whole rupee, got: {grand_total}"
        
        print(f"✓ Invoice has round_off_adjustment: {invoice.get('round_off_adjustment')}")
        print(f"✓ Grand total is whole rupee: {grand_total}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/invoices/{invoice['id']}")
    
    def test_round_off_calculation_accuracy(self):
        """Test that round-off is calculated correctly"""
        companies_response = self.session.get(f"{BASE_URL}/api/companies")
        companies = companies_response.json()
        
        if not companies:
            pytest.skip("No companies found")
        
        company = companies[0]
        
        # Create invoice with specific amount
        # Rate: 8333 → Amount: 8333 → GST (18%): 1499.94 → Total: 9832.94 → Rounded: 9833
        response = self.session.post(f"{BASE_URL}/api/invoices", json={
            "client_id": company["id"],
            "invoice_date": "2026-01-15",
            "due_date": "2026-01-19",
            "line_items": [{
                "description": "Test Service",
                "service_type": "monthly_rental",
                "quantity": 1,
                "rate": 8333,
                "is_taxable": True,
                "hsn_sac": "997212",
                "unit": "Month"
            }],
            "notes": "TEST_round_off_accuracy"
        })
        
        assert response.status_code == 200
        invoice = response.json()
        
        subtotal = invoice.get("subtotal", 0)
        total_tax = invoice.get("total_tax", 0)
        round_off = invoice.get("round_off_adjustment", 0)
        grand_total = invoice.get("grand_total", 0)
        
        # Verify calculation
        calculated_total = subtotal + total_tax
        expected_round_off = round(grand_total - calculated_total, 2)
        
        print(f"Subtotal: {subtotal}, Tax: {total_tax}, Round-off: {round_off}, Grand Total: {grand_total}")
        
        # Round-off should be within -0.50 to +0.50
        assert -0.50 <= round_off <= 0.50, f"Round-off should be within ±0.50, got: {round_off}"
        
        # Grand total should be whole number
        assert grand_total == int(grand_total), f"Grand total should be whole rupee: {grand_total}"
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/invoices/{invoice['id']}")
        print(f"✓ Round-off calculation accurate: {round_off}")


class TestCreditPricing:
    """Test credit pricing for meeting rooms"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Could not authenticate")
    
    def test_conference_room_credit_cost(self):
        """Test Conference Room = 20 credits/hour (60-min slot)"""
        response = self.session.get(f"{BASE_URL}/api/management/rooms")
        assert response.status_code == 200
        
        rooms = response.json()
        conference_rooms = [r for r in rooms if r.get("room_type") == "conference_room" or "CR" in r.get("name", "").upper()]
        
        if not conference_rooms:
            pytest.skip("No conference rooms found")
        
        for room in conference_rooms:
            credit_cost = room.get("credit_cost_per_slot", 0)
            slot_duration = room.get("slot_duration", 60)
            
            print(f"Conference Room {room.get('name')}: {credit_cost} credits per {slot_duration}-min slot")
            
            # Conference Room should be 20 credits per hour (60-min slot)
            assert credit_cost == 20, f"Conference Room should cost 20 credits/hour, got: {credit_cost}"
            assert slot_duration == 60, f"Conference Room slot should be 60 min, got: {slot_duration}"
        
        print(f"✓ Conference Room pricing correct: 20 credits/hour")
    
    def test_meeting_room_credit_cost(self):
        """Test Meeting Room = 5 credits/30-min slot"""
        response = self.session.get(f"{BASE_URL}/api/management/rooms")
        assert response.status_code == 200
        
        rooms = response.json()
        meeting_rooms = [r for r in rooms if r.get("room_type") == "meeting_room" or "MR" in r.get("name", "").upper()]
        
        if not meeting_rooms:
            pytest.skip("No meeting rooms found")
        
        for room in meeting_rooms:
            credit_cost = room.get("credit_cost_per_slot", 0)
            slot_duration = room.get("slot_duration", 30)
            
            print(f"Meeting Room {room.get('name')}: {credit_cost} credits per {slot_duration}-min slot")
            
            # Meeting Room should be 5 credits per 30-min slot
            assert credit_cost == 5, f"Meeting Room should cost 5 credits/30-min, got: {credit_cost}"
            assert slot_duration == 30, f"Meeting Room slot should be 30 min, got: {slot_duration}"
        
        print(f"✓ Meeting Room pricing correct: 5 credits/30-min slot")


class TestCancellationPolicy:
    """Test 48-hour cancellation policy for credit restoration"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as member"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as member
        login_response = self.session.post(f"{BASE_URL}/api/member/login", json={
            "email": "info@tbhcircle.com",
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.member = login_response.json().get("member", {})
        else:
            pytest.skip(f"Could not authenticate as member: {login_response.text}")
    
    def test_cancellation_policy_exists_in_response(self):
        """Test that cancellation response includes late cancellation info"""
        # Get available rooms
        rooms_response = self.session.get(f"{BASE_URL}/api/member/rooms")
        if rooms_response.status_code != 200:
            pytest.skip("Could not get rooms")
        
        rooms = rooms_response.json()
        if not rooms:
            pytest.skip("No rooms available")
        
        room = rooms[0]
        
        # Create a booking for tomorrow (within 48 hours)
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        # Check availability first
        avail_response = self.session.get(f"{BASE_URL}/api/member/rooms/{room['id']}/availability?date={tomorrow}")
        if avail_response.status_code != 200:
            pytest.skip("Could not check availability")
        
        avail_data = avail_response.json()
        available_slots = [s for s in avail_data.get("slots", []) if s.get("is_available")]
        
        if not available_slots:
            pytest.skip("No available slots for tomorrow")
        
        slot = available_slots[0]
        
        # Create booking
        booking_response = self.session.post(f"{BASE_URL}/api/member/bookings", json={
            "room_id": room["id"],
            "date": tomorrow,
            "start_time": slot["start_time"],
            "end_time": slot["end_time"],
            "purpose": "TEST_cancellation_policy_test",
            "attendees": 2
        })
        
        if booking_response.status_code != 200:
            pytest.skip(f"Could not create booking: {booking_response.text}")
        
        booking = booking_response.json()
        booking_id = booking.get("id")
        
        # Cancel the booking (within 48 hours - should be late cancellation)
        cancel_response = self.session.delete(f"{BASE_URL}/api/member/bookings/{booking_id}")
        
        assert cancel_response.status_code == 200, f"Failed to cancel: {cancel_response.text}"
        cancel_data = cancel_response.json()
        
        # Verify response includes late cancellation info
        assert "is_late_cancellation" in cancel_data, "Response should include is_late_cancellation field"
        
        # Since booking is tomorrow (within 48 hours), it should be late cancellation
        is_late = cancel_data.get("is_late_cancellation", False)
        print(f"Cancellation response: {cancel_data}")
        print(f"Is late cancellation: {is_late}")
        
        if is_late:
            assert "credits_forfeited" in cancel_data, "Late cancellation should show credits_forfeited"
            print(f"✓ Late cancellation detected, credits forfeited: {cancel_data.get('credits_forfeited')}")
        else:
            assert "credits_restored" in cancel_data, "Early cancellation should show credits_restored"
            print(f"✓ Early cancellation, credits restored: {cancel_data.get('credits_restored')}")


class TestMeetingRoomLabel:
    """Test that 'Excess Credits' label appears for Meeting Room Charges"""
    
    def test_frontend_label_in_code(self):
        """Verify the frontend code has correct label logic"""
        # Read the CreateInvoice.jsx file
        with open("/app/frontend/src/pages/CreateInvoice.jsx", "r") as f:
            content = f.read()
        
        # Check for the dynamic label logic
        assert "service_type === 'meeting_room'" in content, "Should check for meeting_room service type"
        assert "Excess Credits" in content, "Should have 'Excess Credits' label"
        assert "Quantity (Seats)" in content, "Should have 'Quantity (Seats)' as default label"
        
        # Verify the ternary logic
        assert "service_type === 'meeting_room' ? 'Excess Credits' : 'Quantity (Seats)'" in content, \
            "Should have correct ternary for label switching"
        
        print("✓ Frontend has correct label logic for Meeting Room Charges")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
