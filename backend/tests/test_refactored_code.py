"""
Test Refactored Code Quality - Iteration 16
Tests for:
- POST /api/auto-invoice/generate - refactored auto invoice generation
- GET /api/auto-invoice/runs - auto invoice runs history
- POST /api/import/clients - refactored client import
- GET /api/companies - companies endpoint
- GET /api/invoices - invoices endpoint
- Admin login
- Member login
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Credentials from conftest
ADMIN_EMAIL = os.environ.get('TEST_ADMIN_EMAIL', 'admin@thryve.in')
ADMIN_PASSWORD = os.environ.get('TEST_ADMIN_PASSWORD', 'password')
MEMBER_EMAIL = os.environ.get('TEST_MEMBER_EMAIL', 'info@tbhcircle.com')
MEMBER_PASSWORD = os.environ.get('TEST_MEMBER_PASSWORD', 'password')


class TestAdminAuth:
    """Tests for admin authentication"""
    
    def test_admin_login_success(self):
        """Test: Admin login with valid credentials"""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert resp.status_code == 200, f"Admin login failed: {resp.text}"
        data = resp.json()
        assert "access_token" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"
    
    def test_admin_login_invalid_credentials(self):
        """Test: Admin login with invalid credentials returns 401"""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@email.com",
            "password": "wrongpassword"
        })
        assert resp.status_code == 401


class TestMemberAuth:
    """Tests for member authentication"""
    
    def test_member_login_success(self):
        """Test: Member login with valid credentials"""
        resp = requests.post(f"{BASE_URL}/api/member/login", json={
            "email": MEMBER_EMAIL,
            "password": MEMBER_PASSWORD
        })
        assert resp.status_code == 200, f"Member login failed: {resp.text}"
        data = resp.json()
        assert "access_token" in data
        assert "member" in data
        assert data["member"]["email"] == MEMBER_EMAIL
    
    def test_member_login_invalid_credentials(self):
        """Test: Member login with invalid credentials returns 401"""
        resp = requests.post(f"{BASE_URL}/api/member/login", json={
            "email": "wrong@email.com",
            "password": "wrongpassword"
        })
        assert resp.status_code == 401


class TestAutoInvoiceRefactored:
    """Tests for refactored auto-invoice generation (auto_invoice.py)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.token = login_resp.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_generate_endpoint_exists(self):
        """Test: POST /api/auto-invoice/generate endpoint exists and is accessible"""
        # Use a future month to avoid conflicts with existing invoices
        resp = requests.post(f"{BASE_URL}/api/auto-invoice/generate", 
            json={"billing_month": "2027-01"},
            headers=self.headers
        )
        # Should return 200 (success) or 404 (no companies) - not 405 (method not allowed)
        assert resp.status_code in [200, 404], f"Unexpected status: {resp.status_code}, response: {resp.text}"
    
    def test_generate_returns_result_structure(self):
        """Test: Generate endpoint returns proper result structure"""
        resp = requests.post(f"{BASE_URL}/api/auto-invoice/generate", 
            json={"billing_month": "2027-02"},
            headers=self.headers
        )
        assert resp.status_code in [200, 404]
        
        if resp.status_code == 200:
            data = resp.json()
            assert "message" in data
            assert "result" in data
            result = data["result"]
            assert "billing_month" in result
            assert "total_invoices" in result
            assert "successful" in result
            assert "failed" in result
            assert "invoices" in result
            assert "errors" in result
    
    def test_generate_invalid_billing_month(self):
        """Test: Generate with invalid billing_month returns 400"""
        resp = requests.post(f"{BASE_URL}/api/auto-invoice/generate", 
            json={"billing_month": "invalid"},
            headers=self.headers
        )
        assert resp.status_code == 400
        assert "Invalid billing_month format" in resp.json().get("detail", "")
    
    def test_runs_endpoint_returns_list(self):
        """Test: GET /api/auto-invoice/runs returns list of runs"""
        resp = requests.get(f"{BASE_URL}/api/auto-invoice/runs", headers=self.headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        
        # If there are runs, verify structure
        if len(data) > 0:
            run = data[0]
            assert "billing_month" in run
            assert "total_invoices" in run
            assert "successful" in run
            assert "created_at" in run


class TestImportRefactored:
    """Tests for refactored client import (import_data.py)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.token = login_resp.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_import_clients_endpoint_exists(self):
        """Test: POST /api/import/clients endpoint exists"""
        resp = requests.post(f"{BASE_URL}/api/import/clients", 
            json={"clients": []},
            headers=self.headers
        )
        # Should return 200 with empty result, not 404 or 405
        assert resp.status_code == 200, f"Unexpected status: {resp.status_code}"
    
    def test_import_clients_returns_result_structure(self):
        """Test: Import endpoint returns proper result structure"""
        resp = requests.post(f"{BASE_URL}/api/import/clients", 
            json={"clients": []},
            headers=self.headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "success_count" in data
        assert "error_count" in data
        assert "errors" in data
    
    def test_import_clients_with_valid_data(self):
        """Test: Import with valid client data succeeds"""
        test_client = {
            "_rowNum": 1,
            "company_name": "TEST_Refactor_Import_Company",
            "total_seats": 2,
            "rate_per_seat": 5000,
            "start_date": "2027-01-01"
        }
        resp = requests.post(f"{BASE_URL}/api/import/clients", 
            json={"clients": [test_client]},
            headers=self.headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success_count"] == 1
        assert data["error_count"] == 0
        
        # Cleanup: Delete the test company
        companies_resp = requests.get(f"{BASE_URL}/api/companies", headers=self.headers)
        if companies_resp.status_code == 200:
            for company in companies_resp.json():
                if company["company_name"] == "TEST_Refactor_Import_Company":
                    requests.delete(f"{BASE_URL}/api/companies/{company['id']}", headers=self.headers)
    
    def test_import_clients_duplicate_company(self):
        """Test: Import duplicate company returns error"""
        # First import
        test_client = {
            "_rowNum": 1,
            "company_name": "TEST_Duplicate_Company",
            "total_seats": 1,
            "rate_per_seat": 5000
        }
        resp1 = requests.post(f"{BASE_URL}/api/import/clients", 
            json={"clients": [test_client]},
            headers=self.headers
        )
        assert resp1.status_code == 200
        
        # Second import (duplicate)
        resp2 = requests.post(f"{BASE_URL}/api/import/clients", 
            json={"clients": [test_client]},
            headers=self.headers
        )
        assert resp2.status_code == 200
        data = resp2.json()
        assert data["error_count"] == 1
        assert "already exists" in data["errors"][0]["error"]
        
        # Cleanup
        companies_resp = requests.get(f"{BASE_URL}/api/companies", headers=self.headers)
        if companies_resp.status_code == 200:
            for company in companies_resp.json():
                if company["company_name"] == "TEST_Duplicate_Company":
                    requests.delete(f"{BASE_URL}/api/companies/{company['id']}", headers=self.headers)


class TestCompaniesEndpoint:
    """Tests for GET /api/companies endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_resp.status_code == 200
        self.token = login_resp.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_companies_returns_list(self):
        """Test: GET /api/companies returns list"""
        resp = requests.get(f"{BASE_URL}/api/companies", headers=self.headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
    
    def test_get_companies_structure(self):
        """Test: Companies have expected fields"""
        resp = requests.get(f"{BASE_URL}/api/companies", headers=self.headers)
        assert resp.status_code == 200
        data = resp.json()
        
        if len(data) > 0:
            company = data[0]
            assert "id" in company
            assert "company_name" in company
            assert "status" in company
            assert "total_seats" in company


class TestInvoicesEndpoint:
    """Tests for GET /api/invoices endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_resp.status_code == 200
        self.token = login_resp.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_invoices_returns_list(self):
        """Test: GET /api/invoices returns list"""
        resp = requests.get(f"{BASE_URL}/api/invoices", headers=self.headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
    
    def test_get_invoices_structure(self):
        """Test: Invoices have expected fields"""
        resp = requests.get(f"{BASE_URL}/api/invoices", headers=self.headers)
        assert resp.status_code == 200
        data = resp.json()
        
        if len(data) > 0:
            invoice = data[0]
            assert "id" in invoice
            assert "invoice_number" in invoice
            assert "status" in invoice
            assert "grand_total" in invoice
            assert "client" in invoice
