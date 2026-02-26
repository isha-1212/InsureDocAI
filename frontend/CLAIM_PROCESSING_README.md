# Insurance Admin Dashboard - Claim Processing

## Overview

A professional insurance admin dashboard for claim processing with AI-assisted document verification. Built with React, TypeScript, and Tailwind CSS.

## 🚀 Quick Access

**Live Demo Routes:**
- **New Processing View**: `http://localhost:5174/admin/claims/process`
- **Old Table View**: `http://localhost:5174/admin/claims`
- **Admin Dashboard**: `http://localhost:5174/admin` (has quick access button)

## ✨ Features

### Three-Panel Layout
- **Left Panel (Document List)**: 
  - Vertical list of required documents
  - Upload status indicators (Uploaded/Missing)
  - ML confidence badges with color coding
  - Click to select and view documents

- **Center Panel (Document Viewer)**: 
  - Full document preview with realistic mock documents
  - Zoom controls (50% - 200%)
  - Rotate document functionality
  - Page indicators
  - AI verification badges

- **Right Panel (AI Validation)**: 
  - Extracted fields table with confidence scores
  - Cross-document validation with status indicators
  - Overall claim confidence progress bar
  - Risk level assessment
  - Admin decision controls

### Document Types Supported
- **Hospital Bills** - Detailed medical invoices
- **Pharmacy Bills** - Prescription receipts
- **Aadhaar Cards** - Government ID verification
- **PAN Cards** - Tax identification documents

### AI Validation Features
- **Field Extraction**: Patient name, dates, amounts, addresses
- **Cross-validation**: Name matching, date consistency, amount verification
- **Confidence Scoring**: ML confidence for each extracted field
- **Risk Assessment**: Overall claim risk level (Low/Medium/High)

### Demo Scenarios
Switch between different claim types:
- **Low Risk Claim**: All documents present, high confidence scores, perfect matches
- **High Risk Claim**: Missing documents, low confidence, validation mismatches

## 🎯 Professional UI Elements

### Status Indicators
- Color-coded badges for different statuses
- Consistent iconography throughout
- Professional insurance industry styling

### Interactive Elements
- Hover effects and smooth transitions
- Modal dialogs for rejection reasons
- Responsive button states
- Loading and disabled states

### Data Visualization
- Progress bars for confidence scores
- Color-coded validation status
- Professional table layouts
- Badge-based information display

## 📂 Architecture

### Component Structure
```
components/claim-processing/
├── ConfidenceBadge.tsx      # ML confidence score display
├── DocumentList.tsx         # Left sidebar document list
├── DocumentViewer.tsx       # Center panel document viewer
└── ValidationPanel.tsx      # Right panel AI validation
```

### Mock Data Structure
```
data/
├── mock-claim-data.ts       # Original single claim
└── mock-claim-scenarios.ts  # Multiple scenarios (low/high risk)
```

### Type Definitions
```
types/
└── claim-processing.ts      # TypeScript interfaces
```

## 🛠 Technology Stack
- **React 18** + TypeScript for robust development
- **Tailwind CSS** for responsive, professional styling
- **Radix UI** components for accessibility
- **Lucide React** icons for consistent iconography
- **Framer Motion** for smooth animations

## 💡 Key Highlights

### Professional Design
- Clean, minimal enterprise UI
- Consistent color scheme and spacing
- Insurance industry-appropriate styling
- Responsive layout optimized for desktop admin use

### Mock Document Previews
- Realistic hospital bill layouts
- Pharmacy receipt formats
- Government ID card designs
- Professional document templates

### Advanced Features
- **Scenario Switching**: Demo different claim types
- **Document Navigation**: Easy switching between documents
- **Validation Insights**: Detailed AI analysis results
- **Admin Controls**: Approve/Reject/Request re-upload actions

### No Backend Dependencies
- Purely frontend implementation
- Static mock data for demonstration
- No API calls or authentication required
- Perfect for demos and prototyping

## 🎮 Demo Instructions

1. **Start the application**: `npm run dev` (running on port 5174)
2. **Access the demo**: Navigate to `/admin/claims/process`
3. **Try different scenarios**: Use the dropdown to switch between low/high risk claims
4. **Explore features**:
   - Click documents in the left panel
   - Use zoom/rotate controls in the center
   - Review AI validation in the right panel
   - Try the admin decision buttons

## 🎯 Use Cases
- **Insurance Admin Training**: Perfect for demonstrating claim processing workflows
- **Client Presentations**: Professional UI for showcasing capabilities
- **Development Reference**: Clean component architecture for real implementations
- **Prototype Testing**: Validate UI/UX concepts before backend integration

This implementation provides a comprehensive, professional-grade UI that demonstrates modern insurance claim processing workflows with AI assistance.