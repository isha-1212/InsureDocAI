-- Create claims table
CREATE TABLE IF NOT EXISTS claims (
    claim_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    policy_id INTEGER REFERENCES policies(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_claims_user_id ON claims(user_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_created_at ON claims(created_at);

-- Create claim_documents table
CREATE TABLE IF NOT EXISTS claim_documents (
    document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID REFERENCES claims(claim_id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK (document_type IN ('hospital_bill', 'pharmacy_bill', 'aadhaar', 'pan')),
    file_path TEXT NOT NULL,
    file_url TEXT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT NOW(),
    
    -- Ensure only one document per type per claim
    UNIQUE (claim_id, document_type)
);

-- Create indexes for claim_documents
CREATE INDEX IF NOT EXISTS idx_claim_documents_claim_id ON claim_documents(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_documents_type ON claim_documents(document_type);

-- Create claim_extracted_fields table
CREATE TABLE IF NOT EXISTS claim_extracted_fields (
    id SERIAL PRIMARY KEY,
    claim_id UUID REFERENCES claims(claim_id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK (document_type IN ('hospital_bill', 'pharmacy_bill', 'aadhaar', 'pan')),
    field_name TEXT NOT NULL,
    field_value TEXT NOT NULL,
    confidence_score NUMERIC(3,2) CHECK (confidence_score >= 0.00 AND confidence_score <= 1.00),
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Ensure only one field per document type per claim
    UNIQUE (claim_id, document_type, field_name)
);

-- Create indexes for claim_extracted_fields
CREATE INDEX IF NOT EXISTS idx_claim_extracted_fields_claim_id ON claim_extracted_fields(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_extracted_fields_document_type ON claim_extracted_fields(document_type);
CREATE INDEX IF NOT EXISTS idx_claim_extracted_fields_field_name ON claim_extracted_fields(field_name);

-- Add comments to explain the schema design
COMMENT ON TABLE claims IS 'Main claims table with UUID primary key. Links to users and policies.';
COMMENT ON TABLE claim_documents IS 'Documents uploaded for each claim. One document per type per claim enforced by UNIQUE constraint.';
COMMENT ON TABLE claim_extracted_fields IS 'AI/ML extracted fields from claim documents with confidence scores.';

COMMENT ON COLUMN claim_documents.document_type IS 'Type of document - determines which bucket to use and which extractor to use';
COMMENT ON COLUMN claim_extracted_fields.document_type IS 'Same as bucket name and determines which ML extractor was used';
COMMENT ON COLUMN claim_extracted_fields.confidence_score IS 'ML confidence score between 0.00 and 1.00';