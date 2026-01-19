# 🏗️ Foreperson.ai

**Construction Document Intelligence Platform**

An AI-powered platform that helps construction professionals understand, analyze, and manage their project documents instantly.

## ✨ Features

### 📁 Document Management
- Upload PDF, Word, Excel, and text files
- Automatic document type classification (RFI, Contract, Submittal, etc.)
- Organize documents into folders
- Search and filter across all documents
- Preview document content

### 💬 AI-Powered Q&A
- Ask natural language questions about your documents
- Get instant answers with document citations
- Quick action buttons for common queries
- Construction-industry expertise built-in

### 📋 Smart Summaries
- Generate comprehensive summaries for any document
- Batch summarize all documents at once
- Structured output with key dates, parties, and requirements
- Download summaries as reports

### 🔄 Document Comparison
- Compare any two documents side-by-side
- Find conflicts and discrepancies
- Identify relationships between documents
- Multi-document conflict analysis

### 📊 Reports & Export
- Visual analytics dashboard
- Export to Excel, Text, or JSON
- Document inventory reports
- Backup and restore functionality

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/foreperson-local.git
cd foreperson-local

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the app
streamlit run app.py
```

### Usage

1. Open **http://localhost:8501** in your browser
2. Enter your OpenAI API key in the sidebar
3. Upload construction documents
4. Start asking questions or generate summaries!

## 📁 Project Structure

```
foreperson-local/
├── app.py                 # Main Streamlit application
├── document_parser.py     # Document text extraction
├── ai_assistant.py        # OpenAI integration
├── requirements.txt       # Python dependencies
├── README.md              # This file
└── documents/             # Document storage folders
```

## 🎯 Supported Document Types

| Type | Extensions | Auto-Detection |
|------|------------|----------------|
| PDF | `.pdf` | ✅ Contracts, Specs, Drawings |
| Word | `.docx` | ✅ RFIs, Submittals |
| Excel | `.xlsx` | ✅ Schedules, Budgets |
| Text | `.txt` | ✅ General |

## 💡 Example Questions

- "What are the key milestones and deadlines?"
- "Summarize the scope of work from the contract"
- "What are the payment terms?"
- "Are there any conflicts between these specs and the contract?"
- "Who is responsible for HVAC installation?"

## 🔧 Configuration

### OpenAI Model

Default: `gpt-4o-mini` (cost-effective, ~$0.15 per 1M tokens)

To use a different model, edit `ai_assistant.py`:
```python
self.model = "gpt-4o"  # More capable, higher cost
```

## 📈 Roadmap

- [x] Document upload and parsing
- [x] AI-powered Q&A
- [x] Document summaries
- [x] Conflict detection
- [x] Document comparison
- [x] Export to Excel/Text/JSON
- [ ] Visual annotation detection (ML)
- [ ] User accounts and cloud storage
- [ ] Team collaboration
- [ ] API for integrations

## 📄 License

MIT License

## 🆘 Support

- **Issues**: Open a GitHub issue
- **Email**: support@foreperson.ai

---

**Version**: 0.2.0

Built with ❤️ for construction professionals
