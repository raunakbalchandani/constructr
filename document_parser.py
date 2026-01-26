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

# Try to import OCR libraries
try:
    import pytesseract
    from PIL import Image
    import io
    HAS_TESSERACT = True
except ImportError:
    HAS_TESSERACT = False

from docx import Document
import openpyxl
import pandas as pd
from pathlib import Path
import re
from typing import Dict, List, Optional

class ConstructionDocumentParser:
    def __init__(self):
        # Minimum text threshold to trigger OCR (if page has less than this, try OCR)
        self.ocr_threshold = 50  # characters
        
        # Construction-specific OCR settings
        self.construction_keywords = {
            'drawing_numbers': [r'[A-Z]-\d+', r'[A-Z]\d+', r'SHEET\s+\d+', r'DWG\s+\d+'],
            'dimensions': [r'\d+[\'"]?\s*-?\s*\d+[\'"]?', r'\d+\.\d+\s*[MmFfTt]', r'SCALE\s*:?\s*\d+'],
            'title_block': ['PROJECT', 'DRAWING', 'SHEET', 'REVISION', 'DATE', 'SCALE', 'DWG NO'],
            'annotations': ['SEE', 'REF', 'DETAIL', 'NOTE', 'CALL', 'CALL OUT'],
            'room_labels': ['ROOM', 'OFFICE', 'BATH', 'KITCHEN', 'STORAGE', 'CORRIDOR'],
            'materials': ['CONCRETE', 'STEEL', 'GYPSUM', 'BRICK', 'MASONRY', 'WOOD', 'METAL'],
            'grid_labels': [r'[A-Z]\d+', r'GRID\s+[A-Z]', r'COLUMN\s+[A-Z]']
        }
        
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
    
    def _preprocess_image_for_construction(self, image: Image.Image) -> Image.Image:
        """Preprocess image specifically for construction drawings - enhance contrast, deskew, denoise"""
        if not HAS_TESSERACT:
            return image
        
        try:
            from PIL import ImageEnhance, ImageFilter
            
            # Convert to grayscale if not already
            if image.mode != 'L':
                image = image.convert('L')
            
            # Enhance contrast (construction drawings often have low contrast)
            enhancer = ImageEnhance.Contrast(image)
            image = enhancer.enhance(1.5)  # Increase contrast by 50%
            
            # Enhance sharpness (important for small text in drawings)
            enhancer = ImageEnhance.Sharpness(image)
            image = enhancer.enhance(1.3)
            
            # Apply slight denoising (remove scan artifacts)
            image = image.filter(ImageFilter.MedianFilter(size=3))
            
            return image
        except Exception as e:
            print(f"Image preprocessing error: {e}, using original image")
            return image
    
    def _extract_title_block_text(self, page_image: Image.Image) -> str:
        """Extract text from title block area (typically bottom-right corner)"""
        if not HAS_TESSERACT:
            return ""
        
        try:
            width, height = page_image.size
            # Title block is typically in bottom-right 30% of page
            title_block_region = (int(width * 0.7), int(height * 0.7), width, height)
            title_block_img = page_image.crop(title_block_region)
            
            # Preprocess title block region
            title_block_img = self._preprocess_image_for_construction(title_block_img)
            
            # PSM 6: Single uniform block (good for title blocks)
            config = r'--oem 3 --psm 6'
            title_text = pytesseract.image_to_string(title_block_img, config=config)
            return title_text.strip()
        except Exception as e:
            print(f"Title block extraction error: {e}")
            return ""
    
    def _extract_annotations_text(self, page_image: Image.Image) -> str:
        """Extract scattered annotations, callouts, and dimensions using sparse text mode"""
        if not HAS_TESSERACT:
            return ""
        
        try:
            # Preprocess for annotations
            processed_img = self._preprocess_image_for_construction(page_image)
            
            # PSM 11: Sparse text (for scattered annotations on drawings)
            config = r'--oem 3 --psm 11'
            annotations_text = pytesseract.image_to_string(processed_img, config=config)
            return annotations_text.strip()
        except Exception as e:
            print(f"Annotations extraction error: {e}")
            return ""
    
    def _extract_text_with_ocr(self, page_image: Image.Image, page_num: int) -> str:
        """Extract text from a page image using construction-specific OCR strategies"""
        if not HAS_TESSERACT:
            return f"[OCR not available - Python packages (pytesseract/Pillow) not installed]"
        
        try:
            # Preprocess image for construction documents
            processed_image = self._preprocess_image_for_construction(page_image)
            
            # Strategy 1: Extract title block (most important for drawings)
            title_block_text = self._extract_title_block_text(processed_image)
            
            # Strategy 2: Try multiple PSM modes and combine results
            ocr_results = []
            
            # PSM 6: Single uniform block (good for title blocks, contracts, specs)
            try:
                config_6 = r'--oem 3 --psm 6'
                text_6 = pytesseract.image_to_string(processed_image, config=config_6)
                if text_6.strip():
                    ocr_results.append(("Uniform Block", text_6.strip()))
            except:
                pass
            
            # PSM 11: Sparse text (for annotations, callouts, dimensions on drawings)
            try:
                config_11 = r'--oem 3 --psm 11'
                text_11 = pytesseract.image_to_string(processed_image, config=config_11)
                if text_11.strip() and len(text_11.strip()) > 20:  # Only if substantial
                    ocr_results.append(("Sparse Text", text_11.strip()))
            except:
                pass
            
            # PSM 3: Fully automatic (fallback)
            try:
                config_3 = r'--oem 3 --psm 3'
                text_3 = pytesseract.image_to_string(processed_image, config=config_3)
                if text_3.strip() and len(text_3.strip()) > 50:
                    ocr_results.append(("Auto", text_3.strip()))
            except:
                pass
            
            # Combine results intelligently
            combined_text = ""
            
            # Prioritize title block if found
            if title_block_text:
                combined_text += f"[TITLE BLOCK]\n{title_block_text}\n\n"
            
            # Add other OCR results, deduplicating similar content
            seen_texts = set()
            for mode, text in ocr_results:
                # Simple deduplication: if text is very similar to existing, skip
                text_lower = text.lower()
                is_duplicate = False
                for seen in seen_texts:
                    # If 80% similar, consider duplicate
                    similarity = len(set(text_lower.split()) & set(seen.split())) / max(len(text_lower.split()), 1)
                    if similarity > 0.8:
                        is_duplicate = True
                        break
                
                if not is_duplicate:
                    combined_text += f"[{mode}]\n{text}\n\n"
                    seen_texts.add(text_lower)
            
            # Extract construction-specific patterns
            construction_patterns = self._extract_construction_patterns(combined_text)
            if construction_patterns:
                combined_text += f"[CONSTRUCTION PATTERNS]\n{construction_patterns}\n"
            
            return combined_text.strip() if combined_text.strip() else "[No text extracted]"
            
        except pytesseract.TesseractNotFoundError:
            error_msg = "[OCR failed - Tesseract binary not found. Install with: brew install tesseract (macOS) or sudo apt-get install tesseract-ocr (Ubuntu)]"
            print(f"OCR error on page {page_num}: {error_msg}")
            return error_msg
        except Exception as e:
            error_msg = f"[OCR failed: {str(e)}]"
            print(f"OCR error on page {page_num}: {e}")
            return error_msg
    
    def _extract_construction_patterns(self, text: str) -> str:
        """Extract and highlight construction-specific patterns from OCR text"""
        patterns_found = []
        
        for category, patterns in self.construction_keywords.items():
            for pattern in patterns:
                matches = re.findall(pattern, text, re.IGNORECASE)
                if matches:
                    patterns_found.append(f"{category.upper()}: {', '.join(set(matches[:10]))}")  # Limit to 10 matches
        
        return "\n".join(patterns_found) if patterns_found else ""
    
    def _pdf_page_to_image(self, page, dpi: int = 400) -> Optional[Image.Image]:
        """Convert a PDF page (pymupdf) to PIL Image for OCR
        Uses higher DPI (400) for construction drawings to capture small text"""
        if not HAS_PYMUPDF or not HAS_TESSERACT:
            return None
        
        try:
            # Higher DPI for construction drawings (small text, dimensions, annotations)
            # 400 DPI provides better OCR accuracy for technical drawings
            mat = fitz.Matrix(dpi / 72, dpi / 72)  # Scale factor for DPI
            pix = page.get_pixmap(matrix=mat, alpha=False)
            
            # Convert to PIL Image
            img_data = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_data))
            return img
        except Exception as e:
            print(f"Error converting PDF page to image: {e}")
            return None
    
    def extract_text_from_pdf(self, file_path: str) -> str:
        """Extract text from PDF files using best available library, with OCR fallback for scanned pages"""
        # Try pymupdf first (best for scanned PDFs and complex layouts)
        if HAS_PYMUPDF:
            try:
                doc = fitz.open(file_path)
                text = ""
                pages_needing_ocr = []
                
                # First pass: extract text normally and identify pages needing OCR
                for page_num, page in enumerate(doc, 1):
                    page_text = page.get_text()
                    if page_text.strip() and len(page_text.strip()) >= self.ocr_threshold:
                        # Page has sufficient text
                        text += f"\n--- Page {page_num} ---\n"
                        text += page_text + "\n"
                    else:
                        # Page has little/no text - mark for OCR
                        pages_needing_ocr.append((page_num, page))
                        if page_text.strip():
                            # Some text but not enough - include it and add OCR
                            text += f"\n--- Page {page_num} ---\n"
                            text += page_text + "\n"
                            text += "[Attempting OCR for additional content...]\n"
                        else:
                            text += f"\n--- Page {page_num} ---\n"
                            text += "[No text found - attempting OCR...]\n"
                
                # Second pass: OCR pages that need it
                if pages_needing_ocr and HAS_TESSERACT:
                    print(f"Applying OCR to {len(pages_needing_ocr)} page(s) in {Path(file_path).name}")
                    for page_num, page in pages_needing_ocr:
                        page_image = self._pdf_page_to_image(page)
                        if page_image:
                            ocr_text = self._extract_text_with_ocr(page_image, page_num)
                            if ocr_text and ocr_text != "[OCR not available - Tesseract not installed]":
                                # Replace the placeholder with OCR text
                                text = text.replace(
                                    f"--- Page {page_num} ---\n[No text found - attempting OCR...]\n",
                                    f"--- Page {page_num} (OCR) ---\n{ocr_text}\n"
                                )
                                text = text.replace(
                                    f"--- Page {page_num} ---\n[Attempting OCR for additional content...]\n",
                                    f"--- Page {page_num} (OCR) ---\n{ocr_text}\n"
                                )
                
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
