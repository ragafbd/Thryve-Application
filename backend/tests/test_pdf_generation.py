"""
Test PDF Generation - WeasyPrint based PDF generation
Tests:
1. PDF download endpoint returns valid PDF
2. Backend starts without import errors (no ReportLab)
3. Auto invoice PDF generation using WeasyPrint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPDFGeneration:
    """PDF Generation endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@thryve.in",
            "password": "password"
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
        # Use the specific invoice ID from the test request
        invoice_id = "24eeb71a-5e22-4a42-99ee-5224e823520a"
        response = self.session.get(f"{BASE_URL}/api/invoices/{invoice_id}/pdf")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ PDF endpoint returned HTTP 200")
    
    def test_pdf_download_content_type(self):
        """Test PDF download returns correct content-type"""
        invoice_id = "24eeb71a-5e22-4a42-99ee-5224e823520a"
        response = self.session.get(f"{BASE_URL}/api/invoices/{invoice_id}/pdf")
        
        assert response.status_code == 200
        content_type = response.headers.get('Content-Type', '')
        assert 'application/pdf' in content_type, f"Expected application/pdf, got {content_type}"
        print(f"✓ Content-Type is application/pdf")
    
    def test_pdf_download_valid_pdf_header(self):
        """Test downloaded PDF has valid PDF header (%PDF)"""
        invoice_id = "24eeb71a-5e22-4a42-99ee-5224e823520a"
        response = self.session.get(f"{BASE_URL}/api/invoices/{invoice_id}/pdf")
        
        assert response.status_code == 200
        # PDF files start with %PDF
        pdf_content = response.content
        assert pdf_content[:4] == b'%PDF', f"PDF header invalid: {pdf_content[:10]}"
        print(f"✓ PDF has valid %PDF header")
    
    def test_pdf_download_has_content_disposition(self):
        """Test PDF download has Content-Disposition header for download"""
        invoice_id = "24eeb71a-5e22-4a42-99ee-5224e823520a"
        response = self.session.get(f"{BASE_URL}/api/invoices/{invoice_id}/pdf")
        
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
        invoice_id = "24eeb71a-5e22-4a42-99ee-5224e823520a"
        response = self.session.get(f"{BASE_URL}/api/invoices/{invoice_id}/pdf")
        
        assert response.status_code == 200
        content_length = len(response.content)
        # PDF should be at least 10KB for a proper invoice
        assert content_length > 10000, f"PDF too small: {content_length} bytes"
        print(f"✓ PDF size is reasonable: {content_length} bytes ({content_length/1024:.1f} KB)")


class TestBackendImports:
    """Test backend starts without import errors"""
    
    def test_server_imports_no_reportlab(self):
        """Verify server.py doesn't have ReportLab imports"""
        server_path = "/app/backend/server.py"
        with open(server_path, 'r') as f:
            content = f.read()
        
        assert 'reportlab' not in content.lower(), "ReportLab import found in server.py"
        print("✓ No ReportLab imports in server.py")
    
    def test_auto_invoice_imports_no_reportlab(self):
        """Verify auto_invoice.py doesn't have ReportLab imports"""
        auto_invoice_path = "/app/backend/routes/auto_invoice.py"
        with open(auto_invoice_path, 'r') as f:
            content = f.read()
        
        assert 'reportlab' not in content.lower(), "ReportLab import found in auto_invoice.py"
        print("✓ No ReportLab imports in auto_invoice.py")
    
    def test_pdf_generator_uses_weasyprint(self):
        """Verify pdf_generator.py uses WeasyPrint"""
        pdf_gen_path = "/app/backend/utils/pdf_generator.py"
        with open(pdf_gen_path, 'r') as f:
            content = f.read()
        
        assert 'weasyprint' in content.lower(), "WeasyPrint not found in pdf_generator.py"
        assert 'from weasyprint import' in content, "WeasyPrint import not found"
        print("✓ pdf_generator.py uses WeasyPrint")
    
    def test_auto_invoice_uses_pdf_generator(self):
        """Verify auto_invoice.py uses generate_pdf_from_html from pdf_generator"""
        auto_invoice_path = "/app/backend/routes/auto_invoice.py"
        with open(auto_invoice_path, 'r') as f:
            content = f.read()
        
        assert 'from utils.pdf_generator import generate_pdf_from_html' in content, \
            "auto_invoice.py should import generate_pdf_from_html from utils.pdf_generator"
        print("✓ auto_invoice.py imports generate_pdf_from_html from pdf_generator")
    
    def test_auto_invoice_generate_pdf_content_is_sync(self):
        """Verify generate_pdf_content in auto_invoice.py calls WeasyPrint synchronously"""
        auto_invoice_path = "/app/backend/routes/auto_invoice.py"
        with open(auto_invoice_path, 'r') as f:
            content = f.read()
        
        # Check that generate_pdf_content is defined and calls generate_pdf_from_html directly
        assert 'def generate_pdf_content' in content, "generate_pdf_content function not found"
        # Should NOT have asyncio.get_event_loop() or run_in_executor for PDF generation
        # The function should be synchronous
        assert 'asyncio.get_event_loop' not in content or 'generate_pdf_from_html' not in content.split('asyncio.get_event_loop')[0], \
            "generate_pdf_content should not use asyncio event loop"
        print("✓ generate_pdf_content calls WeasyPrint synchronously")


class TestInvoiceViewFrontend:
    """Test InvoiceView.jsx has correct react-to-print v3 implementation"""
    
    def test_print_button_onclick_syntax(self):
        """Verify Print button uses onClick={() => handlePrint()} syntax for react-to-print v3"""
        invoice_view_path = "/app/frontend/src/pages/InvoiceView.jsx"
        with open(invoice_view_path, 'r') as f:
            content = f.read()
        
        # Check for correct onClick syntax: onClick={() => handlePrint()}
        assert 'onClick={() => handlePrint()}' in content, \
            "Print button should use onClick={() => handlePrint()} for react-to-print v3"
        print("✓ Print button uses correct onClick={() => handlePrint()} syntax")
    
    def test_use_react_to_print_with_content_ref(self):
        """Verify useReactToPrint is used with contentRef"""
        invoice_view_path = "/app/frontend/src/pages/InvoiceView.jsx"
        with open(invoice_view_path, 'r') as f:
            content = f.read()
        
        assert 'useReactToPrint' in content, "useReactToPrint hook not found"
        assert 'contentRef' in content, "contentRef not found in useReactToPrint"
        print("✓ useReactToPrint is used with contentRef")
    
    def test_print_ref_attached_to_invoice_preview(self):
        """Verify printRef is attached to the invoice preview container"""
        invoice_view_path = "/app/frontend/src/pages/InvoiceView.jsx"
        with open(invoice_view_path, 'r') as f:
            content = f.read()
        
        assert 'ref={printRef}' in content, "printRef not attached to any element"
        print("✓ printRef is attached to invoice preview container")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
