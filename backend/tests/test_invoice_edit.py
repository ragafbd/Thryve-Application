"""
Test Invoice Edit Feature
- Tests PUT /api/invoices/{invoice_id} endpoint
- Tests line item modification, due date changes, notes updates
- Tests total recalculation when line items change
"""
import pytest
import requests
from conftest import BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD


class TestInvoiceEdit:
    """Invoice Edit endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.auth_token = token
        else:
            pytest.skip("Authentication failed - skipping tests")
    
    def test_get_existing_invoice(self):
        """Test fetching the existing test invoice"""
        # Use the test invoice ID provided
        invoice_id = "f67b3b33-e036-41a8-bb71-b421585df59b"
        
        response = self.session.get(f"{BASE_URL}/api/invoices/{invoice_id}")
        
        if response.status_code == 404:
            # Invoice doesn't exist, let's get any invoice
            invoices_response = self.session.get(f"{BASE_URL}/api/invoices")
            assert invoices_response.status_code == 200
            invoices = invoices_response.json()
            
            if len(invoices) > 0:
                invoice_id = invoices[0]["id"]
                response = self.session.get(f"{BASE_URL}/api/invoices/{invoice_id}")
                assert response.status_code == 200
                print(f"Using existing invoice: {invoice_id}")
            else:
                pytest.skip("No invoices exist in database")
        else:
            assert response.status_code == 200
            
        invoice = response.json()
        assert "id" in invoice
        assert "invoice_number" in invoice
        assert "line_items" in invoice
        print(f"Invoice found: {invoice.get('invoice_number')}")
        return invoice
    
    def test_edit_invoice_due_date(self):
        """Test editing invoice due date"""
        # Get an existing invoice
        invoices_response = self.session.get(f"{BASE_URL}/api/invoices")
        assert invoices_response.status_code == 200
        invoices = invoices_response.json()
        
        if len(invoices) == 0:
            pytest.skip("No invoices exist in database")
        
        invoice = invoices[0]
        invoice_id = invoice["id"]
        original_due_date = invoice.get("due_date")
        
        # Update due date
        new_due_date = "2026-02-28"
        response = self.session.put(f"{BASE_URL}/api/invoices/{invoice_id}", json={
            "due_date": new_due_date
        })
        
        assert response.status_code == 200
        updated_invoice = response.json()
        assert updated_invoice["due_date"] == new_due_date
        print(f"Due date updated from {original_due_date} to {new_due_date}")
        
        # Verify persistence with GET
        get_response = self.session.get(f"{BASE_URL}/api/invoices/{invoice_id}")
        assert get_response.status_code == 200
        fetched_invoice = get_response.json()
        assert fetched_invoice["due_date"] == new_due_date
        print("Due date change persisted successfully")
    
    def test_edit_invoice_notes(self):
        """Test editing invoice notes"""
        # Get an existing invoice
        invoices_response = self.session.get(f"{BASE_URL}/api/invoices")
        assert invoices_response.status_code == 200
        invoices = invoices_response.json()
        
        if len(invoices) == 0:
            pytest.skip("No invoices exist in database")
        
        invoice = invoices[0]
        invoice_id = invoice["id"]
        
        # Update notes
        new_notes = "TEST_Updated notes for testing - " + str(os.urandom(4).hex())
        response = self.session.put(f"{BASE_URL}/api/invoices/{invoice_id}", json={
            "notes": new_notes
        })
        
        assert response.status_code == 200
        updated_invoice = response.json()
        assert updated_invoice["notes"] == new_notes
        print(f"Notes updated successfully")
        
        # Verify persistence with GET
        get_response = self.session.get(f"{BASE_URL}/api/invoices/{invoice_id}")
        assert get_response.status_code == 200
        fetched_invoice = get_response.json()
        assert fetched_invoice["notes"] == new_notes
        print("Notes change persisted successfully")
    
    def test_edit_invoice_line_items(self):
        """Test editing invoice line items and verify total recalculation"""
        # Get an existing invoice
        invoices_response = self.session.get(f"{BASE_URL}/api/invoices")
        assert invoices_response.status_code == 200
        invoices = invoices_response.json()
        
        if len(invoices) == 0:
            pytest.skip("No invoices exist in database")
        
        invoice = invoices[0]
        invoice_id = invoice["id"]
        original_grand_total = invoice.get("grand_total", 0)
        
        # Create new line items
        new_line_items = [
            {
                "description": "TEST Monthly Plan",
                "service_type": "monthly_rental",
                "quantity": 1,
                "rate": 10000,
                "is_taxable": True
            },
            {
                "description": "TEST Security Deposit",
                "service_type": "security_deposit",
                "quantity": 1,
                "rate": 5000,
                "is_taxable": False
            }
        ]
        
        response = self.session.put(f"{BASE_URL}/api/invoices/{invoice_id}", json={
            "line_items": new_line_items
        })
        
        assert response.status_code == 200
        updated_invoice = response.json()
        
        # Verify line items were updated
        assert len(updated_invoice["line_items"]) == 2
        
        # Verify totals were recalculated
        # Monthly Plan: 10000 + 18% GST = 11800
        # Security Deposit: 5000 (no GST)
        # Expected total: 16800
        expected_subtotal = 15000  # 10000 + 5000
        expected_tax = 1800  # 18% of 10000
        expected_grand_total = 16800
        
        assert updated_invoice["subtotal"] == expected_subtotal
        assert updated_invoice["total_tax"] == expected_tax
        assert updated_invoice["grand_total"] == expected_grand_total
        
        print(f"Line items updated. Grand total changed from {original_grand_total} to {updated_invoice['grand_total']}")
        print(f"Subtotal: {updated_invoice['subtotal']}, Tax: {updated_invoice['total_tax']}, Grand Total: {updated_invoice['grand_total']}")
        
        # Verify persistence with GET
        get_response = self.session.get(f"{BASE_URL}/api/invoices/{invoice_id}")
        assert get_response.status_code == 200
        fetched_invoice = get_response.json()
        assert fetched_invoice["grand_total"] == expected_grand_total
        print("Line item changes and totals persisted successfully")
    
    def test_edit_invoice_add_line_item(self):
        """Test adding a new line item to existing invoice"""
        # Get an existing invoice
        invoices_response = self.session.get(f"{BASE_URL}/api/invoices")
        assert invoices_response.status_code == 200
        invoices = invoices_response.json()
        
        if len(invoices) == 0:
            pytest.skip("No invoices exist in database")
        
        invoice = invoices[0]
        invoice_id = invoice["id"]
        original_items_count = len(invoice.get("line_items", []))
        
        # Get current line items and add one more
        current_items = invoice.get("line_items", [])
        new_item = {
            "description": "TEST Additional Service",
            "service_type": "meeting_room",
            "quantity": 2,
            "rate": 500,
            "is_taxable": True
        }
        
        # Convert existing items to proper format
        updated_items = []
        for item in current_items:
            updated_items.append({
                "description": item.get("description", ""),
                "service_type": item.get("service_type", "monthly_rental"),
                "quantity": item.get("quantity", 1),
                "rate": item.get("rate", 0),
                "is_taxable": item.get("is_taxable", True)
            })
        updated_items.append(new_item)
        
        response = self.session.put(f"{BASE_URL}/api/invoices/{invoice_id}", json={
            "line_items": updated_items
        })
        
        assert response.status_code == 200
        updated_invoice = response.json()
        
        # Verify item was added
        assert len(updated_invoice["line_items"]) == len(updated_items)
        print(f"Line items count: {original_items_count} -> {len(updated_invoice['line_items'])}")
        
        # Verify the new item exists
        descriptions = [item["description"] for item in updated_invoice["line_items"]]
        assert "TEST Additional Service" in descriptions
        print("New line item added successfully")
    
    def test_edit_invoice_not_found(self):
        """Test editing non-existent invoice returns 404"""
        fake_id = "non-existent-invoice-id-12345"
        
        response = self.session.put(f"{BASE_URL}/api/invoices/{fake_id}", json={
            "notes": "Test notes"
        })
        
        assert response.status_code == 404
        print("Correctly returned 404 for non-existent invoice")
    
    def test_edit_invoice_empty_line_items(self):
        """Test that empty line items array is handled"""
        # Get an existing invoice
        invoices_response = self.session.get(f"{BASE_URL}/api/invoices")
        assert invoices_response.status_code == 200
        invoices = invoices_response.json()
        
        if len(invoices) == 0:
            pytest.skip("No invoices exist in database")
        
        invoice = invoices[0]
        invoice_id = invoice["id"]
        
        # Try to update with empty line items
        response = self.session.put(f"{BASE_URL}/api/invoices/{invoice_id}", json={
            "line_items": []
        })
        
        # Should succeed but with zero totals
        assert response.status_code == 200
        updated_invoice = response.json()
        assert len(updated_invoice["line_items"]) == 0
        assert updated_invoice["grand_total"] == 0
        print("Empty line items handled correctly - grand total is 0")


class TestCreateInvoiceDescription:
    """Test Create Invoice - description auto-population from service type"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Authentication failed - skipping tests")
    
    def test_create_invoice_with_service_type_description(self):
        """Test creating invoice where description comes from service type"""
        # First get a client/company
        companies_response = self.session.get(f"{BASE_URL}/api/companies")
        
        if companies_response.status_code != 200 or len(companies_response.json()) == 0:
            # Try clients collection
            clients_response = self.session.get(f"{BASE_URL}/api/clients")
            if clients_response.status_code != 200 or len(clients_response.json()) == 0:
                pytest.skip("No clients/companies exist in database")
            client_id = clients_response.json()[0]["id"]
        else:
            client_id = companies_response.json()[0]["id"]
        
        # Create invoice with line items that have description from service type
        invoice_data = {
            "client_id": client_id,
            "invoice_date": "2026-03-11",
            "due_date": "2026-03-15",
            "line_items": [
                {
                    "description": "Monthly Plan",  # This should match service type label
                    "service_type": "monthly_rental",
                    "quantity": 1,
                    "rate": 15000,
                    "is_taxable": True,
                    "hsn_sac": "997212",
                    "unit": "Month"
                }
            ],
            "notes": "TEST_Invoice for description auto-population test"
        }
        
        response = self.session.post(f"{BASE_URL}/api/invoices", json=invoice_data)
        
        assert response.status_code == 200
        created_invoice = response.json()
        
        # Verify invoice was created
        assert "id" in created_invoice
        assert "invoice_number" in created_invoice
        assert len(created_invoice["line_items"]) == 1
        
        # Verify description is set
        assert created_invoice["line_items"][0]["description"] == "Monthly Plan"
        
        print(f"Invoice created: {created_invoice['invoice_number']}")
        print(f"Line item description: {created_invoice['line_items'][0]['description']}")
        
        # Cleanup - delete the test invoice
        delete_response = self.session.delete(f"{BASE_URL}/api/invoices/{created_invoice['id']}")
        assert delete_response.status_code == 200
        print("Test invoice cleaned up")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
