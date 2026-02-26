import { ExtractedField, ValidationItem, ClaimData } from '@/types/claim-processing';
import { ConfidenceBadge } from './ConfidenceBadge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, AlertTriangle, XCircle, Upload, FileX, CheckSquare } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ValidationPanelProps {
    claimData: ClaimData;
    onApprove: () => void;
    onReject: (reason: string) => void;
    onRequestReupload: () => void;
}

export function ValidationPanel({
    claimData,
    onApprove,
    onReject,
    onRequestReupload
}: ValidationPanelProps) {
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState('');

    const handleReject = () => {
        if (rejectReason.trim()) {
            onReject(rejectReason);
            setIsRejectModalOpen(false);
            setRejectReason('');
        }
    };

    const getValidationIcon = (status: ValidationItem['status']) => {
        switch (status) {
            case 'match': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
            case 'partial': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
            case 'mismatch': return <XCircle className="w-4 h-4 text-red-500" />;
        }
    };

    const getValidationBgClass = (status: ValidationItem['status']) => {
        switch (status) {
            case 'match': return 'bg-emerald-50 border-emerald-200';
            case 'partial': return 'bg-amber-50 border-amber-200';
            case 'mismatch': return 'bg-red-50 border-red-200';
        }
    };

    const getRiskBadgeClass = (risk: ClaimData['riskLevel']) => {
        switch (risk) {
            case 'Low': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'Medium': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'High': return 'bg-red-100 text-red-700 border-red-200';
        }
    };

    return (
        <div className="h-full flex flex-col bg-white">
            {/* Header */}
            <div className="p-4 border-b">
                <h2 className="font-semibold text-slate-900">AI Validation & Analysis</h2>
                <p className="text-sm text-slate-600">Automated verification results</p>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* 1. Extracted Fields Table */}
                <div>
                    <h3 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                        <FileX className="w-4 h-4" />
                        Extracted Fields
                    </h3>

                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50">
                                    <TableHead className="text-xs">Field</TableHead>
                                    <TableHead className="text-xs">Value</TableHead>
                                    <TableHead className="text-xs w-20">Confidence</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {claimData.extractedFields.map((field, index) => (
                                    <TableRow key={index} className="text-sm">
                                        <TableCell className="font-medium text-xs">
                                            {field.fieldName}
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            {field.extractedValue}
                                        </TableCell>
                                        <TableCell>
                                            <ConfidenceBadge
                                                confidence={field.confidence}
                                                size="sm"
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                {/* 2. Cross-Document Validation */}
                <div>
                    <h3 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                        <CheckSquare className="w-4 h-4" />
                        Cross-Document Validation
                    </h3>

                    <div className="space-y-2">
                        {claimData.crossDocumentValidation.map((item, index) => (
                            <div
                                key={index}
                                className={cn(
                                    'p-3 rounded-lg border text-sm',
                                    getValidationBgClass(item.status)
                                )}
                            >
                                <div className="flex items-start gap-3">
                                    {getValidationIcon(item.status)}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-slate-900 text-xs">
                                            {item.label}
                                        </p>
                                        {item.details && (
                                            <p className="text-slate-600 text-xs mt-1">
                                                {item.details}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 3. ML Confidence Summary */}
                <div>
                    <h3 className="font-medium text-slate-900 mb-3">Overall Assessment</h3>

                    <div className="space-y-4">
                        <div className="p-3 bg-slate-50 rounded-lg border">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">Claim Confidence Score</span>
                                <span className="text-sm font-bold text-slate-900">
                                    {claimData.overallConfidence}%
                                </span>
                            </div>
                            <Progress value={claimData.overallConfidence} className="h-2" />
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                            <span className="text-sm font-medium">Risk Level</span>
                            <Badge
                                variant="outline"
                                className={getRiskBadgeClass(claimData.riskLevel)}
                            >
                                {claimData.riskLevel}
                            </Badge>
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. Admin Decision Panel */}
            <div className="p-4 border-t bg-slate-50">
                <h3 className="font-medium text-slate-900 mb-3">Admin Decision</h3>

                <div className="flex flex-col gap-2">
                    <Button
                        onClick={onApprove}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approve Claim
                    </Button>

                    <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50">
                                <XCircle className="w-4 h-4 mr-2" />
                                Reject Claim
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Reject Claim</DialogTitle>
                            </DialogHeader>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-700">
                                        Reason for Rejection
                                    </label>
                                    <Textarea
                                        value={rejectReason}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                        placeholder="Please provide a detailed reason for rejecting this claim..."
                                        className="mt-2 min-h-[100px]"
                                    />
                                </div>

                                <div className="flex gap-3">
                                    <Button
                                        variant="outline"
                                        onClick={() => setIsRejectModalOpen(false)}
                                        className="flex-1"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleReject}
                                        disabled={!rejectReason.trim()}
                                        className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                                    >
                                        Confirm Rejection
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Button
                        variant="outline"
                        onClick={onRequestReupload}
                        className="w-full text-amber-600 border-amber-200 hover:bg-amber-50"
                    >
                        <Upload className="w-4 h-4 mr-2" />
                        Request Re-upload
                    </Button>
                </div>
            </div>
        </div>
    );
}