import os
# Try to import better PDF libraries, fallback to PyPDF2
try:
    import fitz  # pymupdf - MUCH better than PyPDF2
    HAS_PYMUPDF = True
except ImportError:
    HAS_PYMUPDF = False

try:
    import PyPDF2
    HAS_PYPDF2 = True
except ImportError:
    HAS_PYPDF2 = False

try:
    import pdfplumber  # Better for structured content and tables
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False

from docx import Document
import openpyxl
import pandas as pd
from pathlib import Path
import re
from typing import Dict, List, Optional

class ConstructionDocumentParser:
    def __init__(self):
        self.document_types = {
            'RFI': {
                'keywords': ['rfi', 'request for information', 'clarification'],
                'patterns': [r'RFI[-\s]?\d+', r'REQUEST FOR INFORMATION']
            },
            'SUBMITTAL': {
                'keywords': ['submittal', 'shop drawing', 'product data', 'samples'],
                'patterns': [r'SUBMITTAL', r'SHOP DRAWING', r'PRODUCT DATA']
            },
            'SPECIFICATION': {
                'keywords': ['specification', 'section', 'csi', 'division'],
                'patterns': [r'SECTION \d+', r'CSI \d+', r'DIVISION \d+']
            },
            'CONTRACT': {
                'keywords': ['contract', 'agreement', 'general conditions'],
                'patterns': [r'CONTRACT', r'AGREEMENT', r'GENERAL CONDITIONS']
            },
            'CHANGE_ORDER': {
                'keywords': ['change order', 'co', 'pco', 'change directive'],
                'patterns': [r'CO[-\s]?\d+', r'CHANGE ORDER', r'PCO']
            },
            'DRAWING': {
                'keywords': ['drawing', 'plan', 'elevation', 'section', 'detail'],
                'patterns': [r'[A-Z]-\d+', r'DRAWING', r'PLAN', r'ELEVATION']
            },
            'SCHEDULE': {
                'keywords': ['schedule', 'timeline', 'milestone', 'gantt'],
                'patterns': [r'SCHEDULE', r'TIMELINE', r'MILESTONE']
            },
            'INVOICE': {
                'keywords': ['invoice', 'payment', 'billing', 'pay application'],
                'patterns': [r'INVOICE', r'PAYMENT', r'PAY APP']
            }
        }
    
    def identify_document_type(self, text: str, filename: str) -> str:
        """Identify the type of construction document based on content and filename"""
        text_upper = text.upper()
        filename_upper = filename.upper()
        
        scores = {}
        
        for doc_type, rules in self.document_types.items():
            score = 0
            
            # Check keywords in text
            for keyword in rules['keywords']:
                if keyword.upper() in text_upper:
                    score += 2
            
            # Check patterns in text
            for pattern in rules['patterns']:
                if re.search(pattern, text_upper):
                    score += 3
            
            # Check filename
            for keyword in rules['keywords']:
                if keyword.upper() in filename_upper:
                    score += 1
            
            scores[doc_type] = score
        
        # Return highest scoring type
        if scores:
            best_match = max(scores.items(), key=lambda x: x[1])
            return best_match[0] if best_match[1] > 0 else 'UNKNOWN'
        
        return 'UNKNOWN'
    
    def extract_text_from_pdf(self, file_path: str) -> str:
        """Extract text from PDF files using best available library"""
        # Try pymupdf first (best for scanned PDFs and complex layouts)
        if HAS_PYMUPDF:
            try:
                doc = fitz.open(file_path)
                text = ""
                for page_num, page in enumerate(doc, 1):
                    page_text = page.get_text()
                    if page_text.strip():
                        text += f"\n--- Page {page_num} ---\n"
                        text += page_text + "\n"
                    else:
                        text += f"\n--- Page {page_num} ---\n"
                        text += "[No text content - may be scanned image]\n"
                doc.close()
                return text if text.strip() else "No text found in PDF"
            except Exception as e:
                print(f"pymupdf error for {file_path}: {e}, trying fallback...")
        
        # Try pdfplumber as second option (excellent for structured content)
        if HAS_PDFPLUMBER:
            try:
                text = ""
                with pdfplumber.open(file_path) as pdf:
                    for page_num, page in enumerate(pdf.pages, 1):
                        page_text = page.extract_text()
                        if page_text:
                            text += f"\n--- Page {page_num} ---\n"
                            text += page_text + "\n"
                        
                        # Also extract tables if any
                        tables = page.extract_tables()
                        if tables:
                            text += f"\n[Tables on page {page_num}]\n"
                            for table in tables:
                                for row in table:
                                    if row:
                                        text += " | ".join([str(cell) if cell else "" for cell in row]) + "\n"
                return text if text.strip() else "No text found in PDF"
            except Exception as e:
                print(f"pdfplumber error for {file_path}: {e}, trying fallback...")
        
        # Fallback to PyPDF2 if available
        if HAS_PYPDF2:
            try:
                with open(file_path, 'rb') as file:
                    reader = PyPDF2.PdfReader(file)
                    text = ""
                    for page_num, page in enumerate(reader.pages, 1):
                        page_text = page.extract_text()
                        if page_text:
                            text += f"\n--- Page {page_num} ---\n"
                            text += page_text + "\n"
                        else:
                            text += f"\n--- Page {page_num} ---\n"
                            text += "[No text content]\n"
                    return text
            except Exception as e:
                print(f"PyPDF2 error for {file_path}: {e}")
                return f"Error: {str(e)}"
        
        return "Error: No PDF extraction library available. Please install pymupdf: pip install pymupdf"
    
    def extract_text_from_docx(self, file_path: str) -> str:
        """Extract text from Word documents"""
        try:
            doc = Document(file_path)
            text = ""
            for paragraph in doc.paragraphs:
                text += paragraph.text + "\n"
            
            # Also extract text from tables
            for table in doc.tables:
                for row in table.rows:
                    for cell in row.cells:
                        text += cell.text + "\t"
                    text += "\n"
            
            return text
        except Exception as e:
            print(f"Error reading DOCX {file_path}: {e}")
            return ""
    
    def extract_text_from_excel(self, file_path: str) -> str:
        """Extract text from Excel files"""
        try:
            workbook = openpyxl.load_workbook(file_path, data_only=True)
            text = ""
            
            for sheet_name in workbook.sheetnames:
                sheet = workbook[sheet_name]
                text += f"Sheet: {sheet_name}\n"
                
                for row in sheet.iter_rows(values_only=True):
                    row_text = "\t".join([str(cell) if cell is not None else "" for cell in row])
                    text += row_text + "\n"
                
                text += "\n"
            
            return text
        except Exception as e:
            print(f"Error reading Excel {file_path}: {e}")
            return ""
    
    def parse_document(self, file_path: str) -> Dict:
        """Parse a single document and return structured data"""
        file_path = Path(file_path)
        
        if not file_path.exists():
            return {"error": "File not found"}
        
        # Determine file type (using file extension instead of MIME type)
        file_extension = file_path.suffix.lower()
        
        # Extract text based on file type
        text = ""
        if file_extension == '.pdf':
            text = self.extract_text_from_pdf(str(file_path))
        elif file_extension == '.docx':
            text = self.extract_text_from_docx(str(file_path))
        elif file_extension in ['.xlsx', '.xls']:
            text = self.extract_text_from_excel(str(file_path))
        elif file_extension == '.txt':
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    text = f.read()
            except Exception as e:
                return {"error": f"Could not read text file: {str(e)}"}
        else:
            return {"error": f"Unsupported file type: {file_extension}"}
        
        # Identify document type
        doc_type = self.identify_document_type(text, file_path.name)
        
        return {
            "filename": file_path.name,
            "file_path": str(file_path),
            "document_type": doc_type,
            "text_content": text,
            "word_count": len(text.split()),
            "char_count": len(text)
        }
    
    def parse_directory(self, directory_path: str) -> List[Dict]:
        """Parse all documents in a directory"""
        directory = Path(directory_path)
        documents = []
        
        supported_extensions = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.txt']
        
        for file_path in directory.rglob('*'):
            if file_path.is_file() and file_path.suffix.lower() in supported_extensions:
                print(f"Parsing: {file_path.name}")
                doc_data = self.parse_document(str(file_path))
                documents.append(doc_data)
        
        return documents
