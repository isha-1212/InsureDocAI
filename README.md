# InsureDocAI – Intelligent Insurance Claim Processing System

AI-powered insurance claim processing platform with OCR-based document extraction, automated validation workflows, ML-assisted admin review, and microservice-based document intelligence.

---

## System Architecture 
<p align="center">
  <img src="https://raw.githubusercontent.com/isha-1212/InsureDocAI/main/IMG_20260518_073508.jpg" width="900"/>
</p>


## 🧩 System Components

| Component | Description |
|---|---|
| Frontend | React + TypeScript dashboard for users and admins |
| Django Backend | Main backend handling claims, policies, users, uploads, validation workflows |
| ML Flask Server | Separate ML microservice for OCR and document extraction |
| PostgreSQL | Relational database for claims, policies, users, and extracted fields |
| Supabase Storage | Secure document storage with signed URL access |
| Authentication Service | JWT-based authentication and role-based access |
| Validation Engine | Cross-document validation and confidence-based approval logic |
| OCR Pipeline | PaddleOCR-based text and bounding-box extraction |
| Extraction Engine | LayoutLMv3 transformer-based structured field extraction |

---

## ⚙️ Tech Stack

| Category | Technologies Used |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS, Vite |
| Backend | Django, Django REST Framework |
| ML/AI | LayoutLMv3, PaddleOCR, PyTorch, HuggingFace Transformers |
| Database | PostgreSQL |
| Storage | Supabase Storage |
| Authentication | JWT Authentication |
| Async Processing | AsyncIO, ThreadPoolExecutor |
| APIs | REST APIs |
| Containerization | Docker, Docker Compose |

---

## ✨ Features

- Insurance claim management workflows
- Family-member policy support
- OCR-powered document extraction
- AI-assisted admin validation
- Confidence-aware extraction workflows
- Cross-document verification
- Claim approval/rejection workflows
- Reapply and reopen claim support
- Async extraction orchestration
- Cached extraction results
- Signed URL document access
- Retry/backoff handling
- Role-based access control

---

## 📄 Supported Documents

| Document Type | Purpose |
|---|---|
| Hospital Bill | Medical expense verification |
| Pharmacy Bill | Medicine expense verification |
| Aadhaar Card / Pan Card| Identity verification |
| Birth Certificate | Minor verification |

---

## 🤖 ML Pipeline

```text
Document Upload
      ↓
PaddleOCR
      ↓
Bounding Box Extraction
      ↓
LayoutLMv3 Inference
      ↓
Field Extraction
      ↓
Confidence Scoring
      ↓
Validation Engine
```


## Related Repositories

- Main System: https://github.com/isha-1212/InsureDocAI
- ML Server: https://github.com/isha-1212/InsureDocAI-flask-server
