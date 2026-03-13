"""
Test Auto Invoice Generation Feature
Tests for:
- GET /api/auto-invoice/eligible-companies - Returns eligible/ineligible companies based on start_date
- POST /api/auto-invoice/generate - Generates invoices respecting start_date validation
- Due date calculation (invoice_date + 4 days)
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAutoInvoiceEligibility:
    """Tests for GET /api/auto-invoice/eligible-companies endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@thryve.in",
            "password": "password"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.token = login_resp.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_eligible_companies_january_2026(self):
        """Test: January 2026 should have 1 eligible company (To Be Honest Circle LLP with start_date 2026-01-01)"""
        resp = requests.get(f"{BASE_URL}/api/auto-invoice/eligible-companies?billing_month=2026-01", headers=self.headers)
        
        assert resp.status_code == 200
        data = resp.json()
        
        # Verify response structure
        assert "billing_month" in data
        assert "invoice_date" in data
        assert "due_date" in data
        assert "eligible_count" in data
        assert "ineligible_count" in data
        assert "eligible_companies" in data
        assert "ineligible_companies" in data
        assert "total_estimated_amount" in data
        
        # Verify January 2026 has 1 eligible company
        assert data["eligible_count"] == 1, f"Expected 1 eligible, got {data['eligible_count']}"
        assert data["ineligible_count"] == 12, f"Expected 12 ineligible, got {data['ineligible_count']}"
        
        # Verify the eligible company is To Be Honest Circle LLP
        eligible = data["eligible_companies"]
        assert len(eligible) == 1
        assert eligible[0]["company_name"] == "To Be Honest Circle LLP"
        assert eligible[0]["start_date"] == "2026-01-01"
    
    def test_eligible_companies_april_2026(self):
        """Test: April 2026 should have all 13 companies eligible (all start_dates <= 2026-04-01)"""
        resp = requests.get(f"{BASE_URL}/api/auto-invoice/eligible-companies?billing_month=2026-04", headers=self.headers)
        
        assert resp.status_code == 200
        data = resp.json()
        
        # All companies should be eligible for April 2026
        assert data["eligible_count"] == 13, f"Expected 13 eligible, got {data['eligible_count']}"
        assert data["ineligible_count"] == 0, f"Expected 0 ineligible, got {data['ineligible_count']}"
    
    def test_eligible_companies_march_2026_existing_invoices(self):
        """Test: March 2026 should have 0 eligible (all have existing invoices or start_date after)"""
        resp = requests.get(f"{BASE_URL}/api/auto-invoice/eligible-companies?billing_month=2026-03", headers=self.headers)
        
        assert resp.status_code == 200
        data = resp.json()
        
        # All companies should be ineligible due to existing invoices or start_date after billing period
        assert data["eligible_count"] == 0, f"Expected 0 eligible, got {data['eligible_count']}"
        assert data["ineligible_count"] == 13, f"Expected 13 ineligible, got {data['ineligible_count']}"
        
        # Verify reason is either "Invoice already exists" or "Start date is after billing period"
        for company in data["ineligible_companies"]:
            reason = company.get("reason", "")
            assert "Invoice already exists" in reason or "Start date" in reason, \
                f"Unexpected reason for {company['company_name']}: {reason}"
    
    def test_due_date_calculation(self):
        """Test: Due date should be invoice_date + 4 days"""
        resp = requests.get(f"{BASE_URL}/api/auto-invoice/eligible-companies?billing_month=2026-01", headers=self.headers)
        
        assert resp.status_code == 200
        data = resp.json()
        
        invoice_date = datetime.strptime(data["invoice_date"], "%Y-%m-%d")
        expected_due = invoice_date + timedelta(days=4)
        actual_due = datetime.strptime(data["due_date"], "%Y-%m-%d")
        
        assert expected_due == actual_due, f"Due date mismatch: expected {expected_due.strftime('%Y-%m-%d')}, got {actual_due.strftime('%Y-%m-%d')}"
        
        # Verify specific dates for January 2026
        assert data["invoice_date"] == "2026-01-01"
        assert data["due_date"] == "2026-01-05"
    
    def test_ineligible_reason_start_date_after_billing(self):
        """Test: Ineligible companies show correct reason for start_date after billing period"""
        resp = requests.get(f"{BASE_URL}/api/auto-invoice/eligible-companies?billing_month=2026-01", headers=self.headers)
        
        assert resp.status_code == 200
        data = resp.json()
        
        # Find a company with start_date after January 2026
        ineligible = data["ineligible_companies"]
        start_date_ineligible = [c for c in ineligible if "Start date" in c.get("reason", "")]
        
        assert len(start_date_ineligible) > 0, "Expected at least one company ineligible due to start date"
        
        # Verify reason format
        for company in start_date_ineligible:
            assert "is after billing period" in company["reason"]
            assert company["start_date"] is not None
    
    def test_invalid_billing_month_format(self):
        """Test: Invalid billing_month format returns 400 error"""
        resp = requests.get(f"{BASE_URL}/api/auto-invoice/eligible-companies?billing_month=invalid", headers=self.headers)
        
        assert resp.status_code == 400
        assert "Invalid billing_month format" in resp.json().get("detail", "")
    
    def test_total_estimated_amount_includes_gst(self):
        """Test: Total estimated amount includes 18% GST"""
        resp = requests.get(f"{BASE_URL}/api/auto-invoice/eligible-companies?billing_month=2026-01", headers=self.headers)
        
        assert resp.status_code == 200
        data = resp.json()
        
        # Calculate expected amount (sum of total_rate * 1.18 for eligible companies)
        eligible = data["eligible_companies"]
        expected_amount = sum(c.get("total_rate", 0) * 1.18 for c in eligible)
        
        assert abs(data["total_estimated_amount"] - expected_amount) < 0.01, \
            f"Amount mismatch: expected {expected_amount}, got {data['total_estimated_amount']}"


class TestAutoInvoiceGeneration:
    """Tests for POST /api/auto-invoice/generate endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@thryve.in",
            "password": "password"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.token = login_resp.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_generate_respects_start_date_validation(self):
        """Test: Generate endpoint skips companies with start_date after billing period"""
        # Use a month where we know some companies are ineligible
        resp = requests.post(f"{BASE_URL}/api/auto-invoice/generate", 
            json={"billing_month": "2026-01", "notes": "Test generation"},
            headers=self.headers
        )
        
        # Should succeed (200) or return message about no eligible companies
        assert resp.status_code in [200, 404], f"Unexpected status: {resp.status_code}"
        
        data = resp.json()
        result = data.get("result", {})
        
        # If there are skipped companies, verify they have start_date reasons
        skipped = result.get("skipped_companies", [])
        for company in skipped:
            assert "start_date" in company.get("reason", "").lower() or "Start date" in company.get("reason", "")
    
    def test_generate_returns_no_eligible_message(self):
        """Test: Generate returns appropriate message when no companies are eligible"""
        # March 2026 has all invoices already generated
        resp = requests.post(f"{BASE_URL}/api/auto-invoice/generate", 
            json={"billing_month": "2026-03"},
            headers=self.headers
        )
        
        assert resp.status_code == 200
        data = resp.json()
        
        # Should indicate no eligible companies or all failed due to existing invoices
        result = data.get("result", {})
        assert result.get("successful", 0) == 0 or "No companies eligible" in data.get("message", "")


class TestAutoInvoiceRuns:
    """Tests for GET /api/auto-invoice/runs endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@thryve.in",
            "password": "password"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.token = login_resp.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_runs_returns_history(self):
        """Test: GET /api/auto-invoice/runs returns generation history"""
        resp = requests.get(f"{BASE_URL}/api/auto-invoice/runs", headers=self.headers)
        
        assert resp.status_code == 200
        data = resp.json()
        
        # Should return a list
        assert isinstance(data, list)
        
        # If there are runs, verify structure
        if len(data) > 0:
            run = data[0]
            assert "billing_month" in run
            assert "total_invoices" in run
            assert "successful" in run
            assert "failed" in run
            assert "created_at" in run
