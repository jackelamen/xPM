import { useState, useRef, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import {
    UploadIcon, XIcon, Loader2Icon, CheckIcon, ArrowRightIcon, ArrowLeftIcon, AlertCircleIcon,
} from "lucide-react";
import toast from "react-hot-toast";

// ─── CSV parsing ────────────────────────────────────────────────────────────
// Proper RFC4180-ish parser: handles quoted fields, embedded commas/newlines/escaped quotes.
function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    const pushField = () => { row.push(field); field = ""; };
    const pushRow = () => { pushField(); rows.push(row); row = []; };

    // Strip BOM if present
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; }
                else inQuotes = false;
            } else {
                field += c;
            }
        } else if (c === '"') {
            inQuotes = true;
        } else if (c === ",") {
            pushField();
        } else if (c === "\n") {
            pushRow();
        } else if (c === "\r") {
            // skip — \n (if present) handles the row break
        } else {
            field += c;
        }
    }
    if (field !== "" || row.length > 0) pushRow();

    return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

const normalize = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// ─── Field definitions per target ───────────────────────────────────────────
const CONTACT_FIELDS = [
    { key: "name", label: "Name", required: true, synonyms: ["name", "fullname", "contactname", "displayname", "firstlastname"] },
    { key: "name_other", label: "Name (Other)", synonyms: ["nameother", "othername", "localname", "nickname"] },
    { key: "email", label: "Email", synonyms: ["email", "emailaddress", "primaryemail", "workemail"] },
    { key: "phone", label: "Phone", synonyms: ["phone", "phonenumber", "mobile", "mobilephone", "cell", "telephone"] },
    { key: "title", label: "Title", synonyms: ["title", "jobtitle", "position", "role"] },
    { key: "company", label: "Company (name)", synonyms: ["company", "companyname", "organization", "org", "account", "accountname"] },
    { key: "linkedin_url", label: "LinkedIn URL", synonyms: ["linkedin", "linkedinurl", "linkedinprofile"] },
    { key: "source", label: "Source", synonyms: ["source", "leadsource", "sourceofcontact"] },
    { key: "last_contacted_at", label: "Last Contacted", synonyms: ["lastcontacted", "lastcontactedat", "lastcontact", "lastactivity"] },
    { key: "notes", label: "Notes", synonyms: ["notes", "note", "description", "comments"] },
];

const COMPANY_FIELDS = [
    { key: "name", label: "Company Name", required: true, synonyms: ["name", "companyname", "company", "organization", "accountname"] },
    { key: "industry", label: "Industry", synonyms: ["industry", "category", "sector"] },
    { key: "brand_names", label: "Brand Name(s)", synonyms: ["brandnames", "brands", "brandname"] },
    { key: "website", label: "Website", synonyms: ["website", "url", "domain", "site", "webaddress"] },
    { key: "linkedin_url", label: "LinkedIn URL", synonyms: ["linkedin", "linkedinurl", "linkedinprofile", "linkedincompanyurl"] },
    { key: "phone", label: "Phone", synonyms: ["phone", "phonenumber", "telephone"] },
    { key: "address", label: "Address", synonyms: ["address", "street", "streetaddress"] },
    { key: "city", label: "City", synonyms: ["city"] },
    { key: "province", label: "Province / State", synonyms: ["province", "state", "region"] },
    { key: "country", label: "Country", synonyms: ["country"] },
    { key: "notes", label: "Notes", synonyms: ["notes", "note", "description", "comments"] },
];

function autoMap(headers, fields) {
    const map = {};
    const usedHeaders = new Set();
    for (const f of fields) {
        const idx = headers.findIndex((h, i) => !usedHeaders.has(i) && f.synonyms.includes(normalize(h)));
        if (idx !== -1) { map[f.key] = idx; usedHeaders.add(idx); }
    }
    return map;
}

const safeDate = (val) => {
    if (!val) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

const selectCls = "w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-gray-400";

export default function CRMImport({ isOpen, onClose, workspaceId, target = "contacts", onImported }) {
    const { user } = useAuth();
    const fileRef = useRef(null);

    const [step, setStep] = useState("upload"); // upload | map | preview | importing | done
    const [fileName, setFileName] = useState("");
    const [headers, setHeaders] = useState([]);
    const [dataRows, setDataRows] = useState([]);
    const [mapping, setMapping] = useState({}); // fieldKey -> column index
    const [createMissingCompanies, setCreateMissingCompanies] = useState(true);
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const [result, setResult] = useState({ imported: 0, skipped: 0, errors: 0 });

    const fields = target === "companies" ? COMPANY_FIELDS : CONTACT_FIELDS;
    const label = target === "companies" ? "Companies" : "Contacts";

    const records = useMemo(() => {
        return dataRows.map((row) => {
            const rec = {};
            for (const f of fields) {
                const idx = mapping[f.key];
                rec[f.key] = idx !== undefined ? (row[idx] || "").replace(/^"|"$/g, "").trim() : "";
            }
            return rec;
        }).filter((r) => r.name);
    }, [dataRows, mapping, fields]);

    const handleFile = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.name.toLowerCase().endsWith(".csv")) {
            toast.error("Please upload a .csv file");
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            const rows = parseCSV(ev.target.result);
            if (rows.length < 2) {
                toast.error("No data rows found in this CSV");
                return;
            }
            const hdrs = rows[0].map((h) => h.trim());
            const rest = rows.slice(1);
            setHeaders(hdrs);
            setDataRows(rest);
            setMapping(autoMap(hdrs, fields));
            setFileName(file.name);
            setStep("map");
        };
        reader.readAsText(file);
    };

    const handleMapChange = (fieldKey, colIdxStr) => {
        setMapping((prev) => {
            const next = { ...prev };
            if (colIdxStr === "") { delete next[fieldKey]; return next; }
            const colIdx = parseInt(colIdxStr, 10);
            // A column can only map to one field — clear any other field currently using it
            for (const k of Object.keys(next)) {
                if (next[k] === colIdx) delete next[k];
            }
            next[fieldKey] = colIdx;
            return next;
        });
    };

    const requiredField = fields.find((f) => f.required);
    const hasRequiredMapped = mapping[requiredField?.key] !== undefined;

    const handleImport = async () => {
        if (!workspaceId || !hasRequiredMapped) return;
        setImporting(true);
        setStep("importing");
        setProgress({ done: 0, total: records.length });

        try {
            let imported = 0, skipped = 0, errors = 0;

            if (target === "companies") {
                const { data: existing } = await supabase.from("companies").select("id, name").eq("workspace_id", workspaceId);
                const existingNames = new Set((existing || []).map((c) => normalize(c.name)));

                const toInsert = [];
                for (const rec of records) {
                    if (existingNames.has(normalize(rec.name))) { skipped++; continue; }
                    existingNames.add(normalize(rec.name));
                    toInsert.push({
                        workspace_id: workspaceId,
                        owner_id: user.id,
                        name: rec.name,
                        industry: rec.industry || null,
                        brand_names: rec.brand_names || null,
                        website: rec.website || null,
                        linkedin_url: rec.linkedin_url || null,
                        phone: rec.phone || null,
                        address: rec.address || null,
                        city: rec.city || null,
                        province: rec.province || null,
                        country: rec.country || null,
                        notes: rec.notes || null,
                    });
                }

                const CHUNK = 200;
                for (let i = 0; i < toInsert.length; i += CHUNK) {
                    const chunk = toInsert.slice(i, i + CHUNK);
                    const { error } = await supabase.from("companies").insert(chunk);
                    if (error) { errors += chunk.length; } else { imported += chunk.length; }
                    setProgress({ done: Math.min(i + CHUNK, toInsert.length), total: toInsert.length });
                }
            } else {
                const [{ data: existingContacts }, { data: existingCompanies }] = await Promise.all([
                    supabase.from("contacts").select("id, name, email").eq("workspace_id", workspaceId),
                    supabase.from("companies").select("id, name").eq("workspace_id", workspaceId),
                ]);

                const existingEmails = new Set((existingContacts || []).filter((c) => c.email).map((c) => normalize(c.email)));
                const existingNamesNoEmail = new Set((existingContacts || []).filter((c) => !c.email).map((c) => normalize(c.name)));
                const companyByName = new Map((existingCompanies || []).map((c) => [normalize(c.name), c.id]));

                const toInsert = [];
                for (const rec of records) {
                    const emailKey = rec.email ? normalize(rec.email) : null;
                    if (emailKey && existingEmails.has(emailKey)) { skipped++; continue; }
                    if (!emailKey && existingNamesNoEmail.has(normalize(rec.name))) { skipped++; continue; }
                    if (emailKey) existingEmails.add(emailKey); else existingNamesNoEmail.add(normalize(rec.name));

                    let companyId = null;
                    if (rec.company) {
                        const key = normalize(rec.company);
                        if (companyByName.has(key)) {
                            companyId = companyByName.get(key);
                        } else if (createMissingCompanies) {
                            const { data: newCo, error: coErr } = await supabase.from("companies")
                                .insert({ workspace_id: workspaceId, owner_id: user.id, name: rec.company })
                                .select().single();
                            if (!coErr && newCo) { companyId = newCo.id; companyByName.set(key, newCo.id); }
                        }
                    }

                    toInsert.push({
                        workspace_id: workspaceId,
                        owner_id: user.id,
                        name: rec.name,
                        name_other: rec.name_other || null,
                        email: rec.email || null,
                        phone: rec.phone || null,
                        title: rec.title || null,
                        company_id: companyId,
                        linkedin_url: rec.linkedin_url || null,
                        source: rec.source || null,
                        last_contacted_at: safeDate(rec.last_contacted_at),
                        notes: rec.notes || null,
                    });
                }

                const CHUNK = 200;
                for (let i = 0; i < toInsert.length; i += CHUNK) {
                    const chunk = toInsert.slice(i, i + CHUNK);
                    const { error } = await supabase.from("contacts").insert(chunk);
                    if (error) { errors += chunk.length; } else { imported += chunk.length; }
                    setProgress({ done: Math.min(i + CHUNK, toInsert.length), total: toInsert.length });
                }
            }

            setResult({ imported, skipped, errors });
            setStep("done");
            if (errors === 0) {
                toast.success(`Imported ${imported} ${label.toLowerCase()}${skipped ? `, ${skipped} skipped as duplicates` : ""}`);
            } else {
                toast.error(`Imported ${imported}, ${errors} failed — see summary`);
            }
            onImported?.();
        } catch (err) {
            toast.error(err.message || "Import failed");
            setStep("preview");
        } finally {
            setImporting(false);
        }
    };

    const handleClose = () => {
        onClose();
        setStep("upload");
        setFileName("");
        setHeaders([]);
        setDataRows([]);
        setMapping({});
        setResult({ imported: 0, skipped: 0, errors: 0 });
        if (fileRef.current) fileRef.current.value = "";
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 w-full max-w-xl shadow-xl max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white">Import {label} from CSV</h2>
                        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                            {fileName || `Upload a CSV to bulk-import ${label.toLowerCase()}`}
                        </p>
                    </div>
                    <button onClick={handleClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition">
                        <XIcon className="size-4 text-gray-400" />
                    </button>
                </div>

                {step === "upload" && (
                    <div className="space-y-4">
                        <div
                            onClick={() => fileRef.current?.click()}
                            className="border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-xl p-8 text-center cursor-pointer hover:border-gray-400 dark:hover:border-zinc-500 transition"
                        >
                            <UploadIcon className="size-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">Click to upload a CSV file</p>
                            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
                                Works with exports from HubSpot, Salesforce, Google Contacts, Excel, or any spreadsheet
                            </p>
                            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
                        </div>
                    </div>
                )}

                {step === "map" && (
                    <div className="space-y-4">
                        <div className="bg-gray-50 dark:bg-zinc-900 rounded-lg p-3 text-xs text-gray-500 dark:text-zinc-400">
                            <p className="font-medium text-gray-700 dark:text-zinc-300 mb-1">
                                {dataRows.length} rows detected. Map each CSV column to a {label.slice(0, -1)} field.
                            </p>
                            <p>Columns set to "Don't import" are ignored. {requiredField.label} is required.</p>
                        </div>
                        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                            {headers.map((h, i) => (
                                <div key={i} className="grid grid-cols-2 gap-2 items-center">
                                    <span className="text-xs text-gray-600 dark:text-zinc-400 truncate" title={h}>{h || `Column ${i + 1}`}</span>
                                    <select
                                        className={selectCls}
                                        value={Object.keys(mapping).find((k) => mapping[k] === i) || ""}
                                        onChange={(e) => {
                                            const fieldKey = e.target.value;
                                            setMapping((prev) => {
                                                const next = { ...prev };
                                                for (const k of Object.keys(next)) if (next[k] === i) delete next[k];
                                                if (fieldKey) next[fieldKey] = i;
                                                return next;
                                            });
                                        }}
                                    >
                                        <option value="">Don't import</option>
                                        {fields.map((f) => (
                                            <option key={f.key} value={f.key} disabled={mapping[f.key] !== undefined && mapping[f.key] !== i}>
                                                {f.label}{f.required ? " *" : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                        {target === "contacts" && mapping.company !== undefined && (
                            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-zinc-400">
                                <input type="checkbox" checked={createMissingCompanies} onChange={(e) => setCreateMissingCompanies(e.target.checked)} />
                                Create new company records for companies not already in the CRM
                            </label>
                        )}
                        {!hasRequiredMapped && (
                            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                                <AlertCircleIcon className="size-3.5" /> Map a column to "{requiredField.label}" to continue
                            </div>
                        )}
                        <div className="flex justify-between gap-3 pt-2">
                            <button onClick={() => setStep("upload")} className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition">
                                <ArrowLeftIcon className="size-3.5" /> Back
                            </button>
                            <button
                                onClick={() => setStep("preview")}
                                disabled={!hasRequiredMapped}
                                className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium disabled:opacity-50 hover:opacity-90 transition"
                            >
                                Preview <ArrowRightIcon className="size-3.5" />
                            </button>
                        </div>
                    </div>
                )}

                {step === "preview" && (
                    <div className="space-y-4">
                        <div className="bg-gray-50 dark:bg-zinc-900 rounded-lg p-3">
                            <p className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
                                {records.length} {label.toLowerCase()} ready to import
                            </p>
                            <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 dark:divide-zinc-800">
                                {records.slice(0, 25).map((r, i) => (
                                    <div key={i} className="py-1.5 text-xs text-gray-600 dark:text-zinc-400 flex items-center gap-2">
                                        <span className="font-medium text-gray-800 dark:text-zinc-200 truncate">{r.name}</span>
                                        {target === "contacts" && r.company && <span className="text-gray-400 dark:text-zinc-500 truncate">· {r.company}</span>}
                                        {target === "contacts" && r.email && <span className="text-gray-400 dark:text-zinc-500 truncate">· {r.email}</span>}
                                        {target === "companies" && r.industry && <span className="text-gray-400 dark:text-zinc-500 truncate">· {r.industry}</span>}
                                    </div>
                                ))}
                                {records.length > 25 && (
                                    <p className="text-xs text-gray-400 dark:text-zinc-500 pt-1.5">+{records.length - 25} more</p>
                                )}
                            </div>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-zinc-500">
                            Rows matching an existing {target === "companies" ? "company name" : "email (or name, if no email)"} will be skipped as duplicates.
                        </p>
                        <div className="flex justify-between gap-3 pt-2">
                            <button onClick={() => setStep("map")} className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition">
                                <ArrowLeftIcon className="size-3.5" /> Back
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={records.length === 0}
                                className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium disabled:opacity-50 hover:opacity-90 transition"
                            >
                                Import {records.length} {label}
                            </button>
                        </div>
                    </div>
                )}

                {step === "importing" && (
                    <div className="text-center py-10">
                        <Loader2Icon className="size-8 animate-spin text-gray-400 mx-auto mb-3" />
                        <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">Importing {label.toLowerCase()}...</p>
                        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">{progress.done} of {progress.total} processed</p>
                        <div className="w-full bg-gray-200 dark:bg-zinc-800 rounded-full h-1.5 mt-3 max-w-xs mx-auto">
                            <div className="h-1.5 bg-gray-900 dark:bg-white rounded-full transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
                        </div>
                    </div>
                )}

                {step === "done" && (
                    <div className="text-center py-10">
                        <div className="size-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto mb-3">
                            <CheckIcon className="size-6 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">Import complete</p>
                        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
                            {result.imported} imported
                            {result.skipped ? `, ${result.skipped} skipped as duplicates` : ""}
                            {result.errors ? `, ${result.errors} failed` : ""}
                        </p>
                        <button onClick={handleClose} className="mt-4 px-4 py-2 text-sm rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium hover:opacity-90 transition">
                            Done
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
