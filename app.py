"""
Foreperson.ai - Construction Document Intelligence Assistant
Version: 0.2.1
"""

import streamlit as st
import os
import pandas as pd
from pathlib import Path
import plotly.express as px
from document_parser import ConstructionDocumentParser
from ai_assistant import ConstructionAI
import time
from datetime import datetime

# Page config - sidebar collapsed by default for mobile-friendliness
st.set_page_config(
    page_title="Foreperson.ai",
    page_icon="🏗️",
    layout="wide",
    initial_sidebar_state="collapsed"  # Better for mobile - users can expand if needed
)

# Mobile-responsive styling
st.markdown("""
<style>
    /* Base styles */
    .main .block-container { 
        max-width: 1200px; 
        padding: 1rem;
    }
    h1 { color: #1E3A5F; }
    
    /* Metric cards */
    [data-testid="metric-container"] {
        background-color: #F8F9FA;
        border: 1px solid #E0E0E0;
        border-radius: 8px;
        padding: 0.5rem;
    }
    
    /* Document type tags */
    .tag {
        display: inline-block;
        padding: 0.2rem 0.6rem;
        margin: 0.1rem;
        border-radius: 1rem;
        font-size: 0.75rem;
        font-weight: 500;
    }
    .tag-rfi { background-color: #FED7D7; color: #C53030; }
    .tag-contract { background-color: #C6F6D5; color: #276749; }
    .tag-submittal { background-color: #BEE3F8; color: #2B6CB0; }
    .tag-specification { background-color: #FEEBC8; color: #C05621; }
    .tag-drawing { background-color: #E9D8FD; color: #6B46C1; }
    .tag-unknown { background-color: #E2E8F0; color: #4A5568; }
    
    /* Mobile responsive - screens < 768px */
    @media (max-width: 768px) {
        /* Reduce padding on mobile */
        .main .block-container {
            padding: 0.5rem;
        }
        
        /* Stack columns vertically */
        [data-testid="column"] {
            width: 100% !important;
            flex: 100% !important;
            min-width: 100% !important;
        }
        
        /* Smaller headers */
        h1 { font-size: 1.5rem !important; }
        h2 { font-size: 1.25rem !important; }
        h3 { font-size: 1.1rem !important; }
        
        /* Full width buttons */
        .stButton > button {
            width: 100% !important;
        }
        
        /* Adjust tabs for mobile */
        .stTabs [data-baseweb="tab-list"] {
            flex-wrap: wrap;
            gap: 4px;
        }
        .stTabs [data-baseweb="tab"] {
            padding: 8px 12px;
            font-size: 0.8rem;
        }
        
        /* Smaller metrics */
        [data-testid="metric-container"] {
            padding: 0.25rem;
        }
        [data-testid="stMetricValue"] {
            font-size: 1.2rem !important;
        }
        
        /* Text areas full width */
        .stTextArea textarea {
            min-height: 150px;
        }
        
        /* File uploader compact */
        [data-testid="stFileUploader"] {
            padding: 0.5rem;
        }
        
        /* Chat messages */
        .stChatMessage {
            padding: 0.5rem !important;
        }
        
        /* Sidebar auto-collapse on mobile */
        [data-testid="stSidebar"] {
            min-width: 0px;
        }
    }
    
    /* Tablet responsive - screens 768px to 1024px */
    @media (min-width: 768px) and (max-width: 1024px) {
        .main .block-container {
            padding: 1rem;
            max-width: 100%;
        }
        
        /* Two columns max on tablet */
        [data-testid="column"]:nth-child(n+3) {
            width: 50% !important;
        }
    }
    
    /* Touch-friendly buttons */
    @media (hover: none) and (pointer: coarse) {
        .stButton > button {
            min-height: 44px;
            padding: 0.5rem 1rem;
        }
        
        .stSelectbox, .stTextInput {
            min-height: 44px;
        }
    }
    
    /* Hide sidebar toggle text on mobile */
    @media (max-width: 640px) {
        [data-testid="stSidebarNav"] span {
            display: none;
        }
    }
</style>
""", unsafe_allow_html=True)

# Session state
if 'documents' not in st.session_state:
    st.session_state.documents = []
if 'chat_history' not in st.session_state:
    st.session_state.chat_history = []
if 'ai_assistant' not in st.session_state:
    st.session_state.ai_assistant = None


def get_tag_class(doc_type: str) -> str:
    type_map = {
        'RFI': 'tag-rfi', 'CONTRACT': 'tag-contract', 'SUBMITTAL': 'tag-submittal',
        'SPECIFICATION': 'tag-specification', 'DRAWING': 'tag-drawing',
    }
    return type_map.get(doc_type.upper(), 'tag-unknown')


def initialize_ai():
    api_key = st.session_state.get('openai_key')
    if api_key:
        try:
            st.session_state.ai_assistant = ConstructionAI(api_key)
            if st.session_state.documents:
                st.session_state.ai_assistant.load_documents(st.session_state.documents)
            return True
        except Exception as e:
            st.error(f"❌ Failed to initialize AI: {e}")
            return False
    return False


def parse_uploaded_files(uploaded_files):
    parser = ConstructionDocumentParser()
    new_documents = []
    
    progress = st.progress(0)
    for i, uploaded_file in enumerate(uploaded_files):
        try:
            temp_path = os.path.abspath(f"temp_{uploaded_file.name}")
            with open(temp_path, "wb") as f:
                f.write(uploaded_file.getbuffer())
            
            doc_data = parser.parse_document(temp_path)
            if 'error' not in doc_data:
                doc_data['upload_time'] = datetime.now().isoformat()
                new_documents.append(doc_data)
            else:
                st.warning(f"⚠️ {uploaded_file.name}: {doc_data['error']}")
        except Exception as e:
            st.error(f"❌ {uploaded_file.name}: {e}")
        
        progress.progress((i + 1) / len(uploaded_files))
    
    progress.empty()
    
    if new_documents:
        st.success(f"✅ Parsed {len(new_documents)} document(s)")
        st.session_state.documents.extend(new_documents)
        if st.session_state.ai_assistant:
            st.session_state.ai_assistant.load_documents(st.session_state.documents)
    
    return new_documents


def search_documents(query: str, type_filter: str = "All"):
    results = []
    query_lower = query.lower().strip()
    
    for i, doc in enumerate(st.session_state.documents):
        if type_filter != "All" and doc['document_type'] != type_filter:
            continue
        if query_lower:
            if query_lower in doc['filename'].lower() or query_lower in doc['text_content'].lower():
                results.append((i, doc))
        else:
            results.append((i, doc))
    
    return results


def cleanup_temp_files():
    for ext in ['pdf', 'docx', 'xlsx', 'txt']:
        for f in Path(".").glob(f"temp_*.{ext}"):
            try:
                f.unlink()
            except:
                pass


def main():
    # Header
    st.title("🏗️ Foreperson.ai")
    st.caption("Construction Document Intelligence Platform")
    
    # Sidebar
    with st.sidebar:
        st.header("⚙️ Settings")
        
        api_key = st.text_input("OpenAI API Key", type="password", 
                                value=st.session_state.get('openai_key', ''))
        
        if api_key:
            st.session_state.openai_key = api_key
            if not st.session_state.ai_assistant:
                if initialize_ai():
                    st.success("✅ AI Ready")
        
        st.divider()
        
        # Stats
        if st.session_state.documents:
            st.metric("Documents", len(st.session_state.documents))
            doc_types = pd.Series([d['document_type'] for d in st.session_state.documents]).value_counts()
            for t, c in doc_types.items():
                st.caption(f"• {t}: {c}")
        
        st.divider()
        
        if st.button("🗑️ Clear All", use_container_width=True):
            cleanup_temp_files()
            st.session_state.documents = []
            st.session_state.chat_history = []
            st.rerun()
        
        st.caption("v0.2.1")
    
    # Main tabs - 5 tabs including Visual Annotations placeholder
    tab1, tab2, tab3, tab4, tab5 = st.tabs([
        "📁 Documents", "💬 AI Chat", "📋 Summaries", "🔄 Compare", "🎯 Visual Annotations"
    ])
    
    # ==================== TAB 1: Documents ====================
    with tab1:
        st.header("📁 Documents")
        
        # Upload
        uploaded_files = st.file_uploader(
            "Upload construction documents",
            type=['pdf', 'docx', 'xlsx', 'txt'],
            accept_multiple_files=True
        )
        
        if uploaded_files:
            if st.button("🔄 Parse Documents", type="primary"):
                parse_uploaded_files(uploaded_files)
        
        # Search and filter
        if st.session_state.documents:
            st.divider()
            
            col1, col2 = st.columns([3, 1])
            with col1:
                search = st.text_input("🔍 Search", placeholder="Search documents...")
            with col2:
                types = ["All"] + list(set(d['document_type'] for d in st.session_state.documents))
                filter_type = st.selectbox("Type", types)
            
            filtered = search_documents(search, filter_type)
            st.caption(f"Showing {len(filtered)} of {len(st.session_state.documents)} documents")
            
            # Document list
            for idx, doc in filtered:
                col1, col2 = st.columns([5, 1])
                with col1:
                    tag = get_tag_class(doc['document_type'])
                    st.markdown(f"""**{doc['filename']}** 
                    <span class="tag {tag}">{doc['document_type']}</span>
                    <span style="color:#888;font-size:0.8rem">• {doc['word_count']:,} words</span>""", 
                    unsafe_allow_html=True)
                with col2:
                    if st.button("🗑️", key=f"del_{idx}"):
                        st.session_state.documents.pop(idx)
                        st.rerun()
            
            # Preview
            st.divider()
            st.subheader("👁️ Preview")
            sel = st.selectbox("Select", range(len(st.session_state.documents)),
                              format_func=lambda x: st.session_state.documents[x]['filename'])
            
            if sel is not None:
                doc = st.session_state.documents[sel]
                col1, col2, col3 = st.columns(3)
                col1.metric("Type", doc['document_type'])
                col2.metric("Words", f"{doc['word_count']:,}")
                col3.metric("Chars", f"{doc['char_count']:,}")
                
                with st.expander("📄 Content"):
                    st.text_area("", doc['text_content'][:8000], height=300, label_visibility="collapsed")
    
    # ==================== TAB 2: AI Chat ====================
    with tab2:
        st.header("💬 AI Chat")
        
        if not st.session_state.get('openai_key'):
            st.warning("⚠️ Enter OpenAI API key in sidebar")
            st.stop()
        if not st.session_state.documents:
            st.info("📭 Upload documents first")
            st.stop()
        
        st.caption(f"{len(st.session_state.documents)} document(s) loaded")
        
        # Chat history
        for msg in st.session_state.chat_history:
            with st.chat_message(msg["role"]):
                st.markdown(msg["content"])
        
        # Input
        if question := st.chat_input("Ask about your documents..."):
            st.session_state.chat_history.append({"role": "user", "content": question})
            with st.chat_message("user"):
                st.markdown(question)
            
            with st.chat_message("assistant"):
                with st.spinner("Thinking..."):
                    response = st.session_state.ai_assistant.ask_question(question)
                    st.markdown(response)
                    st.session_state.chat_history.append({"role": "assistant", "content": response})
        
        # Quick buttons
        st.divider()
        col1, col2, col3, col4 = st.columns(4)
        
        prompts = [
            ("📅 Key dates", "What are all important dates and deadlines?"),
            ("💰 Costs", "What costs and financial terms are mentioned?"),
            ("⚠️ Risks", "What risks or issues are identified?"),
            ("📋 Summary", "Summarize all documents briefly")
        ]
        
        for col, (label, prompt) in zip([col1, col2, col3, col4], prompts):
            with col:
                if st.button(label, use_container_width=True):
                    st.session_state.chat_history.append({"role": "user", "content": prompt})
                    response = st.session_state.ai_assistant.ask_question(prompt)
                    st.session_state.chat_history.append({"role": "assistant", "content": response})
                    st.rerun()
        
        if st.session_state.chat_history:
            if st.button("Clear chat"):
                st.session_state.chat_history = []
                st.rerun()
    
    # ==================== TAB 3: Summaries ====================
    with tab3:
        st.header("📋 Summaries")
        
        if not st.session_state.get('openai_key'):
            st.warning("⚠️ Enter OpenAI API key")
            st.stop()
        if not st.session_state.documents:
            st.info("📭 Upload documents first")
            st.stop()
        
        col1, col2 = st.columns(2)
        
        with col1:
            st.subheader("📄 Single Document")
            sel = st.selectbox("Select document", range(len(st.session_state.documents)),
                              format_func=lambda x: st.session_state.documents[x]['filename'],
                              key="sum_sel")
            
            if st.button("Generate Summary", type="primary"):
                doc = st.session_state.documents[sel]
                with st.spinner("Generating..."):
                    summary = st.session_state.ai_assistant.get_document_summary(sel)
                    st.markdown(f"### {doc['filename']}")
                    st.markdown(summary)
                    st.download_button("📥 Download", summary, f"summary_{doc['filename']}.txt")
        
        with col2:
            st.subheader("📚 All Documents")
            if st.button("Summarize All"):
                progress = st.progress(0)
                for i, doc in enumerate(st.session_state.documents):
                    with st.spinner(f"{doc['filename']}..."):
                        summary = st.session_state.ai_assistant.get_document_summary(i)
                        with st.expander(doc['filename']):
                            st.markdown(summary)
                    progress.progress((i + 1) / len(st.session_state.documents))
                progress.empty()
    
    # ==================== TAB 4: Compare ====================
    with tab4:
        st.header("🔄 Compare Documents")
        
        if not st.session_state.get('openai_key'):
            st.warning("⚠️ Enter OpenAI API key")
            st.stop()
        if len(st.session_state.documents) < 2:
            st.info("📭 Upload at least 2 documents")
            st.stop()
        
        col1, col2 = st.columns(2)
        
        with col1:
            doc1 = st.selectbox("Document 1", range(len(st.session_state.documents)),
                               format_func=lambda x: st.session_state.documents[x]['filename'], key="cmp1")
        with col2:
            doc2 = st.selectbox("Document 2", range(len(st.session_state.documents)),
                               format_func=lambda x: st.session_state.documents[x]['filename'], key="cmp2")
        
        cmp_type = st.radio("Analysis", ["🔍 Find Conflicts", "🔗 Find Relationships"], horizontal=True)
        
        if st.button("Compare", type="primary"):
            if doc1 == doc2:
                st.error("Select different documents")
            else:
                d1, d2 = st.session_state.documents[doc1], st.session_state.documents[doc2]
                with st.spinner("Comparing..."):
                    prompt = f"""Compare these documents and {"find conflicts" if "Conflicts" in cmp_type else "analyze relationships"}:

DOC 1: {d1['filename']}
{d1['text_content'][:3000]}

DOC 2: {d2['filename']}
{d2['text_content'][:3000]}"""
                    
                    result = st.session_state.ai_assistant.ask_question(prompt)
                    st.markdown(f"### {d1['filename']} vs {d2['filename']}")
                    st.markdown(result)
        
        st.divider()
        st.subheader("⚠️ Multi-Document Conflicts")
        if st.button("Analyze All for Conflicts"):
            with st.spinner("Analyzing..."):
                conflicts = st.session_state.ai_assistant.find_conflicts()
                st.markdown(conflicts)
    
    # ==================== TAB 5: Visual Annotations ====================
    with tab5:
        st.header("🎯 Visual Annotation Detection")
        
        st.info("""
        **🚧 Coming in Phase 3**
        
        This feature will use a custom-trained ML model to detect annotations on construction drawings:
        
        - 📍 **Callout bubbles** - Detail markers and references
        - 📏 **Dimensions** - Measurement lines
        - 🔲 **Drawing grids** - Reference grid markers
        - 🔴 **Redlines** - Markup corrections
        - ☁️ **Revision clouds** - Change areas
        - ✅ **Stamps** - Approval stamps
        - 📝 **Text boxes** - Notes and annotations
        - 📋 **Title blocks** - Drawing information
        """)
        
        st.divider()
        
        st.markdown("""
        ### 📋 Implementation Plan
        
        **Step 1: Data Collection**
        - Collect 50-100 real construction drawings
        - Sources: GSA.gov, city planning departments, partners
        
        **Step 2: Annotation on Roboflow**
        - Upload drawings to Roboflow
        - Label 8 annotation classes
        - Need 500+ annotations total
        
        **Step 3: Train Model**
        - Train YOLOv8 on Roboflow
        - Target: 80%+ accuracy
        
        **Step 4: Integration**
        - Deploy model to this app
        - Detect annotations on uploaded drawings
        - Extract text from detected regions
        """)
        
        st.divider()
        
        # Placeholder for future upload
        st.subheader("📁 Upload Drawing (Preview)")
        drawing = st.file_uploader("Upload a construction drawing PDF", type=['pdf'], 
                                   key="annotation_upload", disabled=True)
        
        st.warning("⚠️ Visual annotation detection requires ML model training. See PRODUCT_ROADMAP.md for details.")


if __name__ == "__main__":
    main()
