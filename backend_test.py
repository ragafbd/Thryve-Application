import requests
import sys
from datetime import datetime
import json

class InvoiceAPITester:
    def __init__(self, base_url="https://workspace-mgmt-3.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_client_id = None
        self.test_invoice_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json() if response.text else {}
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, response = self.run_test(
            "Root API Endpoint",
            "GET",
            "",
            200
        )
        return success

    def test_company_details(self):
        """Test company details endpoint"""
        success, response = self.run_test(
            "Company Details",
            "GET",
            "company",
            200
        )
        if success:
            expected_fields = ["name", "address", "gstin", "email", "phone"]
            for field in expected_fields:
                if field not in response:
                    print(f"❌ Missing field: {field}")
                    return False
            print(f"✅ Company details complete: {response['name']}")
        return success

    def test_create_client(self):
        """Test client creation"""
        test_client = {
            "company_name": f"Test Company {datetime.now().strftime('%H%M%S')}",
            "address": "123 Test Street, Test City - 560001",
            "gstin": "29AABCT1234F1Z5"
        }
        
        success, response = self.run_test(
            "Create Client",
            "POST",
            "clients",
            200,
            data=test_client
        )
        
        if success and 'id' in response:
            self.test_client_id = response['id']
            print(f"✅ Client created with ID: {self.test_client_id}")
        return success

    def test_get_clients(self):
        """Test getting all clients"""
        success, response = self.run_test(
            "Get All Clients",
            "GET",
            "clients",
            200
        )
        if success:
            print(f"✅ Found {len(response)} clients")
        return success

    def test_get_client_by_id(self):
        """Test getting client by ID"""
        if not self.test_client_id:
            print("❌ No test client ID available")
            return False
            
        success, response = self.run_test(
            "Get Client by ID",
            "GET",
            f"clients/{self.test_client_id}",
            200
        )
        return success

    def test_update_client(self):
        """Test updating client"""
        if not self.test_client_id:
            print("❌ No test client ID available")
            return False
            
        updated_data = {
            "company_name": "Updated Test Company",
            "address": "456 Updated Street, Updated City - 560002",
            "gstin": "29AABCT5678F1Z9"
        }
        
        success, response = self.run_test(
            "Update Client",
            "PUT",
            f"clients/{self.test_client_id}",
            200,
            data=updated_data
        )
        return success

    def test_create_invoice(self):
        """Test invoice creation"""
        if not self.test_client_id:
            print("❌ No test client ID available")
            return False
            
        test_invoice = {
            "client_id": self.test_client_id,
            "invoice_date": datetime.now().strftime('%Y-%m-%d'),
            "line_items": [
                {
                    "description": "Monthly Rental - Desk Space",
                    "service_type": "monthly_rental",
                    "quantity": 1,
                    "rate": 10000.00,
                    "is_taxable": True
                },
                {
                    "description": "Security Deposit",
                    "service_type": "security_deposit",
                    "quantity": 1,
                    "rate": 5000.00,
                    "is_taxable": False
                }
            ],
            "notes": "Test invoice for API testing"
        }
        
        success, response = self.run_test(
            "Create Invoice",
            "POST",
            "invoices",
            200,
            data=test_invoice
        )
        
        if success and 'id' in response:
            self.test_invoice_id = response['id']
            print(f"✅ Invoice created with ID: {self.test_invoice_id}")
            
            # Verify GST calculations
            if 'line_items' in response and len(response['line_items']) >= 2:
                taxable_item = response['line_items'][0]
                non_taxable_item = response['line_items'][1]
                
                # Check taxable item (Monthly Rental)
                expected_cgst = 10000 * 0.09  # 9% CGST
                expected_sgst = 10000 * 0.09  # 9% SGST
                if abs(taxable_item['cgst'] - expected_cgst) < 0.01 and abs(taxable_item['sgst'] - expected_sgst) < 0.01:
                    print("✅ GST calculation correct for taxable item")
                else:
                    print(f"❌ GST calculation incorrect: Expected CGST={expected_cgst}, SGST={expected_sgst}, Got CGST={taxable_item['cgst']}, SGST={taxable_item['sgst']}")
                
                # Check non-taxable item (Security Deposit)
                if non_taxable_item['cgst'] == 0 and non_taxable_item['sgst'] == 0:
                    print("✅ Non-taxable item has no GST")
                else:
                    print(f"❌ Non-taxable item should have no GST: Got CGST={non_taxable_item['cgst']}, SGST={non_taxable_item['sgst']}")
        
        return success

    def test_get_invoices(self):
        """Test getting all invoices"""
        success, response = self.run_test(
            "Get All Invoices",
            "GET",
            "invoices",
            200
        )
        if success:
            print(f"✅ Found {len(response)} invoices")
        return success

    def test_get_invoice_by_id(self):
        """Test getting invoice by ID"""
        if not self.test_invoice_id:
            print("❌ No test invoice ID available")
            return False
            
        success, response = self.run_test(
            "Get Invoice by ID",
            "GET",
            f"invoices/{self.test_invoice_id}",
            200
        )
        return success

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        success, response = self.run_test(
            "Dashboard Stats",
            "GET",
            "stats",
            200
        )
        
        if success:
            expected_fields = ["total_invoices", "total_clients", "total_revenue"]
            for field in expected_fields:
                if field not in response:
                    print(f"❌ Missing stats field: {field}")
                    return False
            print(f"✅ Stats: {response['total_invoices']} invoices, {response['total_clients']} clients, ₹{response['total_revenue']} revenue")
        return success

    def test_delete_invoice(self):
        """Test invoice deletion"""
        if not self.test_invoice_id:
            print("❌ No test invoice ID available")
            return False
            
        success, response = self.run_test(
            "Delete Invoice",
            "DELETE",
            f"invoices/{self.test_invoice_id}",
            200
        )
        return success

    def test_delete_client(self):
        """Test client deletion"""
        if not self.test_client_id:
            print("❌ No test client ID available")
            return False
            
        success, response = self.run_test(
            "Delete Client",
            "DELETE",
            f"clients/{self.test_client_id}",
            200
        )
        return success

def main():
    print("🚀 Starting Thryve Invoice Generator API Tests")
    print("=" * 50)
    
    tester = InvoiceAPITester()
    
    # Test sequence
    tests = [
        tester.test_root_endpoint,
        tester.test_company_details,
        tester.test_create_client,
        tester.test_get_clients,
        tester.test_get_client_by_id,
        tester.test_update_client,
        tester.test_create_invoice,
        tester.test_get_invoices,
        tester.test_get_invoice_by_id,
        tester.test_dashboard_stats,
        tester.test_delete_invoice,
        tester.test_delete_client
    ]
    
    # Run all tests
    for test in tests:
        try:
            test()
        except Exception as e:
            print(f"❌ Test failed with exception: {str(e)}")
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())