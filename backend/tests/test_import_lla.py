"""
Test Import Data and LLA (Leave & License Agreement) Features
Tests:
- POST /api/import/clients - Bulk import clients from Excel data
- GET /api/companies - Get all companies (for LLA generation)
- GET /api/companies/{id} - Get specific company details
"""
import pytest
import requests
import uuid
from conftest import BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD


class TestAuth:
    """Authentication tests"""
    
    def test_admin_login(self):
        """Test admin login with provided credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        # If password fails, try alternate password
        if response.status_code != 200:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": ADMIN_EMAIL,
                "password": "admin123"  # Default password from server.py
            })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        print(f"SUCCESS: Admin login successful with email {ADMIN_EMAIL}")
        return data["access_token"]


class TestImportClients:
    """Test client import functionality"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": ADMIN_EMAIL,
                "password": "admin123"
            })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_import_requires_auth(self):
        """Test that import endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/import/clients", json={
            "clients": []
        })
        assert response.status_code == 403 or response.status_code == 401
        print("SUCCESS: Import endpoint requires authentication")
    
    def test_import_single_client(self, auth_token):
        """Test importing a single client"""
        unique_id = str(uuid.uuid4())[:8]
        test_client = {
            "_rowNum": 2,
            "company_name": f"TEST_Import_Company_{unique_id}",
            "signatory_name": "John Doe",
            "signatory_designation": "Director",
            "signatory_pan": "ABCDE1234F",
            "company_gstin": f"06ABCDE{unique_id[:4]}1Z5",
            "company_address": "123 Test Street, Faridabad",
            "space_description": "Six Seater Cabin",
            "total_seats": 6,
            "rate_per_seat": 5000,
            "security_deposit": 30000,
            "start_date": "2026-01-01",
            "end_date": "2026-11-30",
            "lock_in_months": 11
        }
        
        response = requests.post(
            f"{BASE_URL}/api/import/clients",
            json={"clients": [test_client]},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Import failed: {response.text}"
        data = response.json()
        assert "success_count" in data
        assert "error_count" in data
        assert "errors" in data
        assert data["success_count"] == 1
        assert data["error_count"] == 0
        print(f"SUCCESS: Imported 1 client - {test_client['company_name']}")
        
        # Verify client was created by fetching companies
        companies_response = requests.get(
            f"{BASE_URL}/api/companies",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert companies_response.status_code == 200
        companies = companies_response.json()
        imported_company = next((c for c in companies if c["company_name"] == test_client["company_name"]), None)
        assert imported_company is not None, "Imported company not found in companies list"
        assert imported_company["total_seats"] == 6
        assert imported_company["rate_per_seat"] == 5000
        print(f"SUCCESS: Verified imported company exists with correct data")
        
        # Cleanup - delete the test company
        if imported_company:
            delete_response = requests.delete(
                f"{BASE_URL}/api/companies/{imported_company['id']}",
                headers={"Authorization": f"Bearer {auth_token}"}
            )
            print(f"Cleanup: Deleted test company - status {delete_response.status_code}")
    
    def test_import_multiple_clients(self, auth_token):
        """Test importing multiple clients at once"""
        unique_id = str(uuid.uuid4())[:8]
        test_clients = [
            {
                "_rowNum": 2,
                "company_name": f"TEST_Multi_Company_A_{unique_id}",
                "signatory_name": "Alice Smith",
                "total_seats": 2,
                "rate_per_seat": 4000
            },
            {
                "_rowNum": 3,
                "company_name": f"TEST_Multi_Company_B_{unique_id}",
                "signatory_name": "Bob Jones",
                "total_seats": 4,
                "rate_per_seat": 4500
            }
        ]
        
        response = requests.post(
            f"{BASE_URL}/api/import/clients",
            json={"clients": test_clients},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success_count"] == 2
        print(f"SUCCESS: Imported {data['success_count']} clients")
        
        # Cleanup
        companies_response = requests.get(
            f"{BASE_URL}/api/companies",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        if companies_response.status_code == 200:
            for company in companies_response.json():
                if company["company_name"].startswith(f"TEST_Multi_Company"):
                    requests.delete(
                        f"{BASE_URL}/api/companies/{company['id']}",
                        headers={"Authorization": f"Bearer {auth_token}"}
                    )
    
    def test_import_duplicate_company_rejected(self, auth_token):
        """Test that importing duplicate company name is rejected"""
        unique_id = str(uuid.uuid4())[:8]
        test_client = {
            "_rowNum": 2,
            "company_name": f"TEST_Duplicate_Company_{unique_id}",
            "signatory_name": "Test User",
            "total_seats": 1,
            "rate_per_seat": 5000
        }
        
        # First import
        response1 = requests.post(
            f"{BASE_URL}/api/import/clients",
            json={"clients": [test_client]},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response1.status_code == 200
        assert response1.json()["success_count"] == 1
        
        # Second import (duplicate)
        response2 = requests.post(
            f"{BASE_URL}/api/import/clients",
            json={"clients": [test_client]},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response2.status_code == 200
        data = response2.json()
        assert data["success_count"] == 0
        assert data["error_count"] == 1
        assert "already exists" in data["errors"][0]["error"]
        print("SUCCESS: Duplicate company correctly rejected")
        
        # Cleanup
        companies_response = requests.get(
            f"{BASE_URL}/api/companies",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        if companies_response.status_code == 200:
            for company in companies_response.json():
                if company["company_name"] == test_client["company_name"]:
                    requests.delete(
                        f"{BASE_URL}/api/companies/{company['id']}",
                        headers={"Authorization": f"Bearer {auth_token}"}
                    )
    
    def test_import_missing_company_name_rejected(self, auth_token):
        """Test that import without company name is rejected"""
        test_client = {
            "_rowNum": 2,
            "signatory_name": "Test User",
            "total_seats": 1
        }
        
        response = requests.post(
            f"{BASE_URL}/api/import/clients",
            json={"clients": [test_client]},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success_count"] == 0
        assert data["error_count"] == 1
        assert "Company name is required" in data["errors"][0]["error"]
        print("SUCCESS: Missing company name correctly rejected")


class TestCompaniesAPI:
    """Test companies API for LLA generation"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": ADMIN_EMAIL,
                "password": "admin123"
            })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_get_companies_requires_auth(self):
        """Test that companies endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/companies")
        assert response.status_code == 403 or response.status_code == 401
        print("SUCCESS: Companies endpoint requires authentication")
    
    def test_get_companies_list(self, auth_token):
        """Test getting list of companies"""
        response = requests.get(
            f"{BASE_URL}/api/companies",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Retrieved {len(data)} companies")
        
        # Verify company structure if any exist
        if len(data) > 0:
            company = data[0]
            assert "id" in company
            assert "company_name" in company
            assert "status" in company
            print(f"SUCCESS: Company structure verified - first company: {company['company_name']}")
    
    def test_get_company_by_id(self, auth_token):
        """Test getting a specific company by ID"""
        # First get list of companies
        list_response = requests.get(
            f"{BASE_URL}/api/companies",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        if list_response.status_code != 200 or len(list_response.json()) == 0:
            pytest.skip("No companies available to test")
        
        company_id = list_response.json()[0]["id"]
        
        # Get specific company
        response = requests.get(
            f"{BASE_URL}/api/companies/{company_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        company = response.json()
        assert company["id"] == company_id
        
        # Verify LLA-relevant fields exist
        lla_fields = ["company_name", "signatory_name", "company_address", "company_gstin",
                      "total_seats", "rate_per_seat", "start_date", "space_description"]
        for field in lla_fields:
            assert field in company, f"Missing LLA field: {field}"
        
        print(f"SUCCESS: Retrieved company {company['company_name']} with all LLA fields")
    
    def test_get_company_not_found(self, auth_token):
        """Test getting non-existent company returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/companies/non-existent-id-12345",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 404
        print("SUCCESS: Non-existent company returns 404")
    
    def test_filter_companies_by_status(self, auth_token):
        """Test filtering companies by status"""
        response = requests.get(
            f"{BASE_URL}/api/companies?status=active",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # All returned companies should be active
        for company in data:
            assert company["status"] == "active"
        
        print(f"SUCCESS: Filtered to {len(data)} active companies")


class TestLLADataIntegrity:
    """Test that imported data has all fields needed for LLA generation"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": ADMIN_EMAIL,
                "password": "admin123"
            })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_import_preserves_lla_fields(self, auth_token):
        """Test that import preserves all LLA-relevant fields"""
        unique_id = str(uuid.uuid4())[:8]
        test_client = {
            "_rowNum": 2,
            "company_name": f"TEST_LLA_Fields_{unique_id}",
            "signatory_name": "Jane Doe",
            "signatory_father_name": "S/o Sh. John Doe",
            "signatory_designation": "Managing Director",
            "signatory_pan": "XYZAB1234C",
            "signatory_aadhar": "123456789012",
            "company_gstin": f"06XYZAB{unique_id[:4]}1Z5",
            "company_address": "456 Business Park, Sector 21, Faridabad, Haryana 121002",
            "space_description": "Four Seater Cabin",
            "total_seats": 4,
            "rate_per_seat": 6000,
            "security_deposit": 24000,
            "setup_charges": "Not applicable",
            "start_date": "2026-02-01",
            "end_date": "2026-12-31",
            "lock_in_months": 11
        }
        
        # Import the client
        import_response = requests.post(
            f"{BASE_URL}/api/import/clients",
            json={"clients": [test_client]},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert import_response.status_code == 200
        assert import_response.json()["success_count"] == 1
        
        # Fetch the imported company
        companies_response = requests.get(
            f"{BASE_URL}/api/companies",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        companies = companies_response.json()
        imported = next((c for c in companies if c["company_name"] == test_client["company_name"]), None)
        
        assert imported is not None
        
        # Verify all LLA fields are preserved
        assert imported["signatory_name"] == test_client["signatory_name"]
        assert imported["signatory_designation"] == test_client["signatory_designation"]
        assert imported["signatory_pan"] == test_client["signatory_pan"]
        assert imported["company_gstin"] == test_client["company_gstin"]
        assert imported["company_address"] == test_client["company_address"]
        assert imported["space_description"] == test_client["space_description"]
        assert imported["total_seats"] == test_client["total_seats"]
        assert imported["rate_per_seat"] == test_client["rate_per_seat"]
        assert imported["security_deposit"] == test_client["security_deposit"]
        assert imported["start_date"] == test_client["start_date"]
        assert imported["lock_in_months"] == test_client["lock_in_months"]
        
        print("SUCCESS: All LLA fields preserved after import")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/companies/{imported['id']}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
