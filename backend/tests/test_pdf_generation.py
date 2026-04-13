"""
Test PDF Generation - fpdf2 based PDF generation
Tests:
1. PDF download endpoint returns valid PDF with correct headers
2. Backend starts without import errors (no WeasyPrint/ReportLab)
3. PDF generator uses fpdf2 (pure Python, zero system deps)
4. Frontend uses fetch+blob for download (not window.open)
5. Frontend print handler opens PDF URL in new window
"""
import pytest
import requests
from conftest import BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD


# Test invoice IDs from test_credentials.md
TEST_INVOICE_ID = "0174dd9e-4d94-4f53-a359-cca903a24217"  # Apex Legal Eagles
FALLBACK_INVOICE_ID = "24eeb71a-5e22-4a42-99ee-5224e823520a"  # Last 2 Brain Cells


class TestPDFGeneration:
    """PDF Generation endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
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
    
    def test_api_health(self):
        """Test API is running"""
        response = self.session.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        print("✓ API health check passed")
    
    def test_pdf_download_endpoint_returns_200(self):
        """Test PDF download endpoint returns HTTP 200"""
        response = self.session.get(f"{BASE_URL}/api/invoices/{TEST_INVOICE_ID}/pdf")
        
        if response.status_code == 404:
            # Try fallback invoice
            response = self.session.get(f"{BASE_URL}/api/invoices/{FALLBACK_INVOICE_ID}/pdf")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ PDF endpoint returned HTTP 200")
    
    def test_pdf_download_content_type(self):
        """Test PDF download returns correct content-type: application/pdf"""
        response = self.session.get(f"{BASE_URL}/api/invoices/{TEST_INVOICE_ID}/pdf")
        
        if response.status_code == 404:
            response = self.session.get(f"{BASE_URL}/api/invoices/{FALLBACK_INVOICE_ID}/pdf")
        
        assert response.status_code == 200
        content_type = response.headers.get('Content-Type', '')
        assert 'application/pdf' in content_type, f"Expected application/pdf, got {content_type}"
        print(f"✓ Content-Type is application/pdf")
    
    def test_pdf_download_valid_pdf_header(self):
        """Test downloaded PDF has valid PDF header (%PDF)"""
        response = self.session.get(f"{BASE_URL}/api/invoices/{TEST_INVOICE_ID}/pdf")
        
        if response.status_code == 404:
            response = self.session.get(f"{BASE_URL}/api/invoices/{FALLBACK_INVOICE_ID}/pdf")
        
        assert response.status_code == 200
        # PDF files start with %PDF
        pdf_content = response.content
        assert pdf_content[:4] == b'%PDF', f"PDF header invalid: {pdf_content[:10]}"
        print(f"✓ PDF has valid %PDF header")
    
    def test_pdf_download_has_content_disposition_attachment(self):
        """Test PDF download has Content-Disposition: attachment header for auto-download"""
        response = self.session.get(f"{BASE_URL}/api/invoices/{TEST_INVOICE_ID}/pdf")
        
        if response.status_code == 404:
            response = self.session.get(f"{BASE_URL}/api/invoices/{FALLBACK_INVOICE_ID}/pdf")
        
        assert response.status_code == 200
        content_disposition = response.headers.get('Content-Disposition', '')
        assert 'attachment' in content_disposition, f"Expected attachment, got {content_disposition}"
        assert 'filename=' in content_disposition, f"Expected filename in header"
        print(f"✓ Content-Disposition header present: {content_disposition}")
    
    def test_pdf_download_nonexistent_invoice_returns_404(self):
        """Test PDF download for non-existent invoice returns 404"""
        fake_invoice_id = "00000000-0000-0000-0000-000000000000"
        response = self.session.get(f"{BASE_URL}/api/invoices/{fake_invoice_id}/pdf")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Non-existent invoice returns 404")
    
    def test_pdf_has_reasonable_size(self):
        """Test PDF has reasonable file size (not empty, not too small)"""
        response = self.session.get(f"{BASE_URL}/api/invoices/{TEST_INVOICE_ID}/pdf")
        
        if response.status_code == 404:
            response = self.session.get(f"{BASE_URL}/api/invoices/{FALLBACK_INVOICE_ID}/pdf")
        
        assert response.status_code == 200
        content_length = len(response.content)
        # PDF should be at least 10KB for a proper invoice with fpdf2
        assert content_length > 10000, f"PDF too small: {content_length} bytes"
        print(f"✓ PDF size is reasonable: {content_length} bytes ({content_length/1024:.1f} KB)")


class TestBackendImports:
    """Test backend uses fpdf2 (not WeasyPrint/ReportLab)"""
    
    def test_server_imports_no_reportlab(self):
        """Verify server.py doesn't have ReportLab imports"""
        server_path = "/app/backend/server.py"
        with open(server_path, 'r') as f:
            content = f.read()
        
        assert 'reportlab' not in content.lower(), "ReportLab import found in server.py"
        print("✓ No ReportLab imports in server.py")
    
    def test_server_imports_no_weasyprint(self):
        """Verify server.py doesn't have WeasyPrint imports"""
        server_path = "/app/backend/server.py"
        with open(server_path, 'r') as f:
            content = f.read()
        
        assert 'weasyprint' not in content.lower(), "WeasyPrint import found in server.py"
        print("✓ No WeasyPrint imports in server.py")
    
    def test_pdf_generator_uses_fpdf2(self):
        """Verify pdf_generator.py uses fpdf2 (FPDF class)"""
        pdf_gen_path = "/app/backend/utils/pdf_generator.py"
        with open(pdf_gen_path, 'r') as f:
            content = f.read()
        
        assert 'from fpdf import FPDF' in content, "fpdf2 import not found in pdf_generator.py"
        assert 'weasyprint' not in content.lower(), "WeasyPrint found in pdf_generator.py - should use fpdf2"
        print("✓ pdf_generator.py uses fpdf2 (FPDF)")
    
    def test_pdf_generator_has_generate_pdf_from_html(self):
        """Verify pdf_generator.py has generate_pdf_from_html function"""
        pdf_gen_path = "/app/backend/utils/pdf_generator.py"
        with open(pdf_gen_path, 'r') as f:
            content = f.read()
        
        assert 'def generate_pdf_from_html' in content, "generate_pdf_from_html function not found"
        print("✓ pdf_generator.py has generate_pdf_from_html function")


class TestFrontendPDFHandlers:
    """Test InvoiceView.jsx has correct PDF download and print handlers"""
    
    def test_download_uses_fetch_blob_approach(self):
        """Verify handleDownloadPDF uses fetch+blob+createObjectURL (not window.open)"""
        invoice_view_path = "/app/frontend/src/pages/InvoiceView.jsx"
        with open(invoice_view_path, 'r') as f:
            content = f.read()
        
        # Check for fetch-based download approach
        assert 'fetch(' in content, "fetch() not found - should use fetch for PDF download"
        assert '.blob()' in content, ".blob() not found - should convert response to blob"
        assert 'createObjectURL' in content, "createObjectURL not found - should create blob URL"
        assert 'a.download' in content or 'download =' in content, "download attribute not set on anchor"
        print("✓ handleDownloadPDF uses fetch+blob+createObjectURL approach")
    
    def test_print_uses_window_open(self):
        """Verify handlePrint opens PDF URL in new window for printing"""
        invoice_view_path = "/app/frontend/src/pages/InvoiceView.jsx"
        with open(invoice_view_path, 'r') as f:
            content = f.read()
        
        # Check for window.open approach for print
        assert 'window.open' in content, "window.open not found - should open PDF in new window for print"
        print("✓ handlePrint uses window.open approach")
    
    def test_download_button_has_testid(self):
        """Verify Download PDF button has data-testid attribute"""
        invoice_view_path = "/app/frontend/src/pages/InvoiceView.jsx"
        with open(invoice_view_path, 'r') as f:
            content = f.read()
        
        assert 'data-testid="download-pdf-btn"' in content, "Download PDF button missing data-testid"
        print("✓ Download PDF button has data-testid")
    
    def test_print_button_has_testid(self):
        """Verify Print button has data-testid attribute"""
        invoice_view_path = "/app/frontend/src/pages/InvoiceView.jsx"
        with open(invoice_view_path, 'r') as f:
            content = f.read()
        
        assert 'data-testid="print-invoice-btn"' in content, "Print button missing data-testid"
        print("✓ Print button has data-testid")


class TestPDFContent:
    """Test PDF content structure (basic validation)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_pdf_is_valid_and_complete(self):
        """Test PDF is valid and has proper structure (header, trailer, objects)"""
        response = self.session.get(f"{BASE_URL}/api/invoices/{TEST_INVOICE_ID}/pdf")
        
        if response.status_code == 404:
            response = self.session.get(f"{BASE_URL}/api/invoices/{FALLBACK_INVOICE_ID}/pdf")
        
        assert response.status_code == 200
        pdf_content = response.content
        
        # Check PDF structure markers
        assert pdf_content[:4] == b'%PDF', "PDF should start with %PDF header"
        assert b'%%EOF' in pdf_content[-100:], "PDF should end with %%EOF marker"
        assert b'/Type /Page' in pdf_content, "PDF should contain page objects"
        
        # Check PDF has reasonable size (fpdf2 generates ~700KB+ for invoice with images)
        assert len(pdf_content) > 50000, f"PDF too small: {len(pdf_content)} bytes"
        
        print(f"✓ PDF is valid and complete ({len(pdf_content)/1024:.1f} KB)")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
