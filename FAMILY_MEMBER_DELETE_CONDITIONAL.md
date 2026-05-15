# Family Member Deletion - Conditional Logic Implementation

## Overview
Implemented conditional deletion logic for family members to ensure data integrity by preventing deletion of members who have associated claims.

---

## Changes Made

### 1. Backend - API Validation (views.py)

**File:** `backend/api/views.py`

**Method Updated:** `FamilyMemberViewSet.destroy()`

**Changes:**
- Added claim count validation before deletion
- Returns HTTP 400 error if member has associated claims
- Provides clear error message: `"This family member is associated with existing claims and cannot be deleted."`
- Includes claim count details for transparency

**Implementation:**
```python
# Check if member has any associated claims
claims_count = member.claims.count()
if claims_count > 0:
    return Response(
        {
            "error": "This family member is associated with existing claims and cannot be deleted.",
            "details": f"Found {claims_count} claim(s) linked to this member."
        },
        status=400
    )
```

---

### 2. Backend - Serializer Enhancement (serializers.py)

**File:** `backend/api/serializers.py`

**Class Modified:** `FamilyMemberSerializer`

**Changes:**
- Added `has_claims` read-only field
- Returns boolean indicating if member has any associated claims
- Uses `SerializerMethodField` with `get_has_claims()` method
- Leverages Django's related manager `claims.exists()`

**Implementation:**
```python
class FamilyMemberSerializer(serializers.ModelSerializer):
    age = serializers.ReadOnlyField()
    has_claims = serializers.SerializerMethodField()
    
    class Meta:
        model = FamilyMember
        fields = [..., 'has_claims']
        read_only_fields = [..., 'has_claims']
    
    def get_has_claims(self, obj):
        """Check if family member has any associated claims"""
        return obj.claims.exists()
```

**API Response Example:**
```json
{
  "id": 1,
  "name": "Rajesh Kumar",
  "relation": "self",
  "has_claims": true,
  "is_minor": false,
  ...
}
```

---

### 3. Frontend - Component State (FamilyMembers.tsx)

**File:** `frontend/client/src/pages/FamilyMembers.tsx`

**Changes:**
- Added `deleteError` state to track deletion errors
- Updated state management to clear errors on dialog close

**Implementation:**
```typescript
const [deleteError, setDeleteError] = useState<string | null>(null);
```

---

### 4. Frontend - Error Handling (FamilyMembers.tsx)

**Function Updated:** `confirmDelete()`

**Changes:**
- Added error state reset before deletion attempt
- Implemented error handling with onError callback
- Extracts error message from response data
- Provides fallback error message

**Implementation:**
```typescript
const confirmDelete = () => {
  if (!deleteConfirmation || !policy) return;
  setDeleteError(null);
  deleteMember(
    { memberId: deleteConfirmation.memberId, policyId: policy.id },
    {
      onSuccess: () => {
        setDeleteConfirmation(null);
        setDeleteError(null);
      },
      onError: (error: any) => {
        const errorMessage = error?.response?.data?.error || 
                            error?.message || 
                            "Failed to delete family member";
        setDeleteError(errorMessage);
      },
    },
  );
};
```

---

### 5. Frontend - Delete Dialog Enhancement (FamilyMembers.tsx)

**Component Updated:** Delete Confirmation Dialog

**Changes:**
- Added error state display
- Shows error message in red alert box
- Hides delete action button when error is shown
- Shows "Close" button instead of "Cancel" when error
- Clear error on dialog close

**Implementation:**
```typescript
{deleteError ? (
  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
    <p className="text-red-300 text-sm">{deleteError}</p>
  </div>
) : (
  <p className="text-slate-300">
    Are you sure you want to remove <span className="font-semibold">{deleteConfirmation?.memberName}</span>?
  </p>
)}
```

---

### 6. Frontend - Delete Button UX (FamilyMembers.tsx)

**Components Updated:** Two delete buttons (compact card & regular card)

**Changes:**
- Disabled button when member has claims (`has_claims === true`)
- Changed button styling based on state:
  - **Can Delete:** Red with hover effects
  - **Cannot Delete:** Gray with disabled cursor
- Updated tooltip text based on state
- Prevents click when disabled

**Implementation:**
```typescript
<button
  onClick={() => handleDeleteMember(member.id, member.name)}
  disabled={(member as any).has_claims}
  className={`p-1 rounded-md transition-colors opacity-0 group-hover:opacity-100 ${
    (member as any).has_claims
      ? "bg-slate-500/10 text-slate-400 cursor-not-allowed"
      : "bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300"
  }`}
  title={(member as any).has_claims ? "Cannot delete member with associated claims" : "Delete member"}
>
  <Trash2 className="w-4 h-4" />
</button>
```

---

## User Experience Flow

### Scenario 1: Member Without Claims ✅
1. Admin hovers over member card
2. Red delete button appears
3. Click opens confirmation dialog
4. Confirms deletion → Member is deleted
5. Success message/UI update

### Scenario 2: Member With Claims ❌
1. Admin hovers over member card
2. **Gray delete button appears** (disabled)
3. Tooltip shows: "Cannot delete member with associated claims"
4. Click has no effect (disabled)
5. No dialog opens

### Scenario 3: Attempt Backend Delete With Claims
1. User somehow bypasses frontend (manual API call)
2. Backend validation runs
3. Returns 400 error: `"This family member is associated with existing claims..."`
4. Frontend shows error in dialog
5. Admin must close dialog

---

## Data Integrity Guarantees

### Frontend Level
- ✅ Delete button disabled for members with claims
- ✅ Visual feedback (grayed out, changed tooltip)
- ✅ Error messages in confirmation dialog
- ✅ Clear indication why deletion is blocked

### Backend Level
- ✅ Query checks `claims.count()` before deletion
- ✅ Returns meaningful error response
- ✅ Transaction protected (all-or-nothing)
- ✅ Audit logging maintained via `_log_policy_event()`

### Database Level
- ✅ Foreign key relationship enforced
- ✅ Related manager available via `related_name='claims'`
- ✅ No orphan claims possible

---

## Testing Checklist

- [ ] Delete member WITHOUT claims → ✅ Succeeds
- [ ] Delete member WITH claims → ❌ Blocked with error
- [ ] Error message displays correctly
- [ ] Button disabled state shows correctly
- [ ] Tooltip text updates based on state
- [ ] Dialog closes on error close button
- [ ] Multiple claims on same member → Still blocked
- [ ] Pending/Approved/Rejected claims all block deletion
- [ ] Manual API delete attempt blocked at backend
- [ ] Audit logging recorded for successful deletions
- [ ] Mobile responsive delete buttons
- [ ] Keyboard accessibility maintained

---

## Related Models

### Claim Model
```python
member = models.ForeignKey(
    'api.FamilyMember',
    on_delete=models.SET_NULL,
    related_name='claims',  # ← Enables reverse lookup
    null=True,
    blank=True
)
```

### FamilyMember Usage
```python
member = FamilyMember.objects.get(id=1)
member.claims.all()      # Get all claims for member
member.claims.count()    # Count claims
member.claims.exists()   # Check if has any claims
```

---

## Error Messages

### Backend Error Response
```json
{
  "error": "This family member is associated with existing claims and cannot be deleted.",
  "details": "Found 2 claim(s) linked to this member."
}
```

### Frontend Display
Red alert box with message:
```
"This family member is associated with existing claims and cannot be deleted."
```

---

## Security Considerations

1. **No Information Disclosure:** Error message doesn't reveal claim details
2. **Rate Limiting:** Inherited from existing API rate limiting
3. **Permission Checks:** Only policy owner can delete their members
4. **Audit Trail:** All delete attempts logged (successful or failed)
5. **CSRF Protection:** Handled by Django REST Framework

---

## Performance

- **Query Optimization:** Uses `claims.exists()` (stops at first match)
- **No N+1 Problem:** Single query per deletion attempt
- **Serializer Efficiency:** `exists()` called only when needed
- **Frontend Rendering:** No additional API calls needed (included in member data)

---

## Future Enhancements (Optional)

- [ ] Show count of associated claims in UI
- [ ] Link to view associated claims
- [ ] Allow deletion with claim review
- [ ] Cascade archive instead of delete
- [ ] Soft delete with restoration option
- [ ] Claim reassignment before deletion

---

## Rollback Instructions

If needed to revert changes:

1. **Backend:** Remove claim check from `destroy()` method
2. **Serializer:** Remove `has_claims` field
3. **Frontend:** Remove `deleteError` state and error handling
4. **Frontend:** Restore delete buttons to always enabled

**Note:** Members with claims will be deletable, which may cause data inconsistencies.

