# Manual Test Checklist — Phase 4: Knowledge Base & RAG

Run these after `make up && make migrate`. All tests require a logged-in Builder account.

---

## Prerequisites

- Stack is running (`make up`)
- Migrations 0011 + 0012 applied (`make migrate`)
- Ollama has `bge-m3` pulled (`make pull-models` or `ollama pull bge-m3`)
- ClamAV is healthy (`docker ps` shows `wekala-clamav` healthy — allow up to 2 minutes on first boot)
- You are logged in as a Builder (test account: `test@wekala.dev` / `Wekala@Test2026`)

---

## 1. Create a Knowledge Base

**Steps:**
1. Open `http://localhost:3002/workspaces/<workspaceId>/knowledge-base`
2. Click **+** next to "Knowledge Base"
3. Enter name `"HR Policies"`, description `"Company HR documents"`, scope `workspace`
4. Click **Create**

**Expected:**
- KB appears in the left sidebar immediately
- No error toast

**Evidence:** KB row in `knowledge_bases` table with `status = 'active'`

- [ ] Pass  [ ] Fail

---

## 2. Upload a PDF (happy path)

**Steps:**
1. Select the `HR Policies` KB
2. Drop or click to select a valid PDF (≤ 50 MB)
3. Click **Upload**

**Expected:**
- Response: `202 Accepted` with `status: "pending"`
- Document appears in the list with status **Pending**
- Within ~30 seconds status changes to **Ready**
- `page_count` and `token_count` are populated

**Evidence:**
- `kb_documents` row: `status = 'ready'`
- `kb_chunks` rows exist for the document

- [ ] Pass  [ ] Fail

---

## 3. Upload file > 50 MB

**Steps:**
1. Attempt to upload a file larger than 50 MB

**Expected:**
- Frontend shows `"File exceeds the 50 MB limit."` error immediately (client-side check)
- No request reaches the server

- [ ] Pass  [ ] Fail

---

## 4. Upload disallowed file type

**Steps:**
1. Attempt to upload a `.exe` file

**Expected:**
- Frontend shows `"File type not allowed. Use PDF, DOCX, TXT, MD, or HTML."` error
- No request reaches the server

- [ ] Pass  [ ] Fail

---

## 5. Upload file with EICAR test string (malware detection)

**Steps:**
1. Create a file named `eicar.txt` containing exactly:
   ```
   X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*
   ```
2. Upload it via the API (or UI)

**Expected:**
- Response: `422 Unprocessable Entity` — `"File failed virus scan"`
- No document record created in DB

**Evidence:** No row in `kb_documents` for this upload

- [ ] Pass  [ ] Fail

---

## 6. Duplicate file deduplication

**Steps:**
1. Upload the same PDF twice to the same KB

**Expected:**
- Second upload returns `duplicate: true` and the existing document's ID
- No second processing job runs
- Only one document appears in the list

**Evidence:** Single `kb_documents` row with matching `content_hash`

- [ ] Pass  [ ] Fail

---

## 7. Search returns relevant chunks

**Steps:**
1. After a document is `ready`, enter a query related to its content in the search box
2. Click **Search**

**Expected:**
- Results appear with content excerpts and source citations (filename + page number)
- Scores are shown
- Results are scoped to the selected KB

- [ ] Pass  [ ] Fail

---

## 8. Cross-workspace isolation

**Steps:**
1. Create a KB in Workspace A and upload a document
2. Log in as a user in Workspace B (different workspace)
3. Attempt to call `GET /v1/workspaces/<WS_B_ID>/kbs/<WS_A_KB_ID>`

**Expected:**
- `404 Not Found` — KB from Workspace A is not visible in Workspace B context
- RLS prevents the row from appearing

- [ ] Pass  [ ] Fail

---

## 9. Viewer cannot upload (OPA enforcement)

**Steps:**
1. Log in as a Viewer role user in the workspace
2. Attempt to upload a document via `POST /v1/workspaces/{wid}/kbs/{kbId}/documents`

**Expected:**
- `403 Forbidden` — `"Access denied"` or `"Insufficient role"`

- [ ] Pass  [ ] Fail

---

## 10. Delete document

**Steps:**
1. Select a `ready` document and click **Delete**, then confirm
2. Confirm the deletion dialog

**Expected:**
- Document disappears from the list
- `kb_chunks` rows for that document are deleted
- Storage file is removed from Supabase Storage bucket

**Evidence:**
- No rows in `kb_chunks` for the deleted `document_id`
- Supabase Studio > Storage > `wekala-documents` bucket: path no longer exists

- [ ] Pass  [ ] Fail

---

## 11. Upload corrupt / unreadable file

**Steps:**
1. Create a file with `.pdf` extension but contents `NOTAPDF`
2. Upload it

**Expected:**
- Document is accepted (202) — type check passes (text content, no magic bytes)
- Background processing fails gracefully
- Document status becomes **Failed** with an `error_detail` message
- No crash, no partial state left in DB

- [ ] Pass  [ ] Fail

---

## 12. Scanned (image-only) PDF — OCR fallback

**Steps:**
1. Upload a PDF that contains only scanned images (no text layer)

**Expected:**
- Processing succeeds (may take longer — OCR runs)
- Status reaches **Ready**
- Search returns results from the OCR-extracted text

*Note: requires `tesseract-ocr` installed in the API container (`apt install tesseract-ocr`). Skip if not available in the POC environment.*

- [ ] Pass  [ ] Fail  [ ] Skipped (no Tesseract)

---

## 13. ClamAV unreachable — fail-closed

**Steps:**
1. Stop the ClamAV container: `docker stop wekala-clamav`
2. Attempt to upload any document

**Expected:**
- `503 Service Unavailable` — `"Virus scanner unavailable"`
- No document is stored

3. Restart ClamAV: `docker start wekala-clamav`

- [ ] Pass  [ ] Fail

---

## 14. `make test-phase-4` automated check

**Steps:**
```bash
make test-phase-4
```

**Expected:**
- All Phase 4 required files present (✓ for each)
- `pytest tests/test_kb.py` — 22 passed, 0 failed

- [ ] Pass  [ ] Fail

---

## Summary

| # | Scenario | Result |
|---|---|---|
| 1 | Create KB | |
| 2 | Upload PDF (happy path) | |
| 3 | File > 50 MB rejected | |
| 4 | Wrong file type rejected | |
| 5 | EICAR malware rejected | |
| 6 | Duplicate deduplication | |
| 7 | Search returns citations | |
| 8 | Cross-workspace isolation | |
| 9 | Viewer cannot upload | |
| 10 | Delete document | |
| 11 | Corrupt file → Failed status | |
| 12 | OCR fallback (if available) | |
| 13 | ClamAV down → 503 | |
| 14 | `make test-phase-4` | |

**Tester:** _______________  **Date:** _______________
