import React, { useEffect, useState, useRef } from "react";

// app.jsx

/*
    GitHub Copilot
    React UI for Arabic flashcard app.
    - Discovers common API endpoints and shows tables (except WordInstance).
    - Click a sentence to edit in a large editor; words are highlighted, hover shows root or "Not found".
    - Click a word opens the Words table and scrolls to that word.
    - Words.frequency displayed as a strength bar.
    - Translation editor box, Create Flashcard, Save, Delete, Add Words buttons (UI-only).
    - Responsive; animated transitions; integrated to fetch from /api/* endpoints (expects Flask API).
*/

const CANDIDATE_ENDPOINTS = [
    { key: "words", path: "/api/words" },
    { key: "sentences", path: "/api/sentences" },
    { key: "roots", path: "/api/roots" },
    { key: "tables", path: "/api/tables" },
    { key: "wordlists", path: "/api/wordlists" },
    { key: "languages", path: "/api/languages" },
];

function injectStyles() {
    if (document.getElementById("learn-arabic-styles")) return;
    const css = `
:root{
    --bg:#0f1724; --panel:#0b1220; --muted:#94a3b8; --accent:#7c3aed; --accent-2:#06b6d4;
    --card:#0b1220; --glass: rgba(255,255,255,0.03);
}
*{box-sizing:border-box}
html,body,#root{height:100%}
body{
    margin:0;font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial;
    background:linear-gradient(180deg,var(--bg), #071023 80%); color:#e6eef8;
    -webkit-font-smoothing:antialiased;
}
.app{
    display:flex;gap:18px;padding:20px;min-height:100vh;align-items:flex-start;
}
.sidebar{
    width:300px; max-width:40vw; background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
    border-radius:12px;padding:14px;backdrop-filter:blur(6px);box-shadow:0 6px 18px rgba(2,6,23,0.6);
    transition:all .3s ease;
}
.header{
    display:flex;align-items:center;gap:10px;margin-bottom:12px;
}
.app-title{font-weight:700;font-size:16px}
.table-list{display:flex;flex-direction:column;gap:8px;max-height:60vh;overflow:auto;padding-right:6px}
.table-button{
    background:transparent;border:1px solid rgba(255,255,255,0.04);padding:10px;border-radius:10px;
    color:var(--muted);cursor:pointer;text-align:left;display:flex;justify-content:space-between;align-items:center;
    transition:all .18s ease;
}
.table-button:hover{transform:translateY(-4px);border-color:rgba(124,58,237,0.45);color:#fff;box-shadow:0 6px 24px rgba(124,58,237,0.06)}
.table-button.active{background:linear-gradient(90deg, rgba(124,58,237,0.12), rgba(6,182,212,0.04));color:#fff;border-color:transparent}
.main{
    flex:1; display:flex;flex-direction:column;gap:14px;
}
.panel{
    background:var(--panel);border-radius:12px;padding:14px;box-shadow:0 6px 18px rgba(3,6,23,0.6);
}
.table-view{
    overflow:auto;max-height:58vh;border-radius:8px;padding:8px;background:linear-gradient(180deg, rgba(255,255,255,0.01), transparent);
    transition:all .25s ease;
}
.table-grid{min-width:900px;border-collapse:collapse;width:100%}
.table-grid th{position:sticky;top:0;background:rgba(2,6,23,0.5);padding:8px;text-align:left;font-weight:600;color:var(--muted);font-size:13px;border-bottom:1px solid rgba(255,255,255,0.03)}
.table-grid td{padding:10px;border-bottom:1px dashed rgba(255,255,255,0.03);vertical-align:middle}
.row-click{cursor:pointer;transition:all .12s ease}
.row-click:hover{background:linear-gradient(90deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));transform:translateY(-2px)}
.freq-bar{
    width:120px;height:10px;background:rgba(255,255,255,0.04);border-radius:999px;overflow:hidden;
}
.freq-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--accent),var(--accent-2));transition:width .35s ease}
.editor{
    display:flex;gap:12px;flex-direction:column;
}
.sentence-box{
    background:var(--glass);border-radius:10px;padding:14px;color:#fff;font-size:20px;min-height:120px;
    display:flex;flex-wrap:wrap;align-items:center;gap:6px;line-height:1.6;transition:box-shadow .18s ease;
}
.word{padding:6px 8px;border-radius:8px;transition:transform .12s ease,background .12s ease}
.word:hover{transform:translateY(-3px);box-shadow:0 8px 20px rgba(2,6,23,0.5)}
.word.found{background:rgba(124,58,237,0.06);border:1px solid rgba(124,58,237,0.08)}
.word.missing{background:rgba(255,255,255,0.02);border:1px dashed rgba(255,255,255,0.04);color:#ffecb3}
.tooltip{
    position:fixed;padding:6px 8px;background:#041022;color:#bfefff;border-radius:6px;font-size:13px;pointer-events:none;z-index:60;
    transform:translate(-50%,-140%);white-space:nowrap;box-shadow:0 6px 20px rgba(2,6,23,0.6)
}
.controls{display:flex;gap:8px;align-items:center}
.btn{
    background:linear-gradient(90deg,var(--accent),var(--accent-2));padding:8px 12px;border-radius:10px;color:white;border:none;cursor:pointer;
    box-shadow:0 8px 20px rgba(124,58,237,0.12);
}
.ghost{background:transparent;border:1px solid rgba(255,255,255,0.06);color:var(--muted)}
.translate-box{background:rgba(255,255,255,0.02);border-radius:8px;padding:10px;color:var(--muted);min-height:48px}
.words-table-row[data-word]{scroll-margin:80px}
@media(max-width:880px){
    .app{flex-direction:column;padding:12px}
    .sidebar{width:100%;max-width:100%}
    .table-grid{min-width:700px}
}
`;
    const s = document.createElement("style");
    s.id = "learn-arabic-styles";
    s.innerHTML = css;
    document.head.appendChild(s);
}

function useTooltip() {
    const [tip, setTip] = useState(null); // {text,x,y}
    useEffect(() => {
        const onMove = (e) => {
            if (!tip) return;
            setTip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : null);
        };
        window.addEventListener("mousemove", onMove);
        return () => window.removeEventListener("mousemove", onMove);
    }, [tip]);
    return { tip, setTip };
}

export default function App() {
    injectStyles();
    const [available, setAvailable] = useState([]);
    const [tables, setTables] = useState({}); // key -> rows array
    const [activeTable, setActiveTable] = useState(null);
    const [selectedSentence, setSelectedSentence] = useState(null);
    const [wordsMap, setWordsMap] = useState({}); // normalized->word entry
    const [activeWord, setActiveWord] = useState(null);
    const wordsTableRef = useRef(null);
    const { tip, setTip } = useTooltip();

    useEffect(() => {
        // probe endpoints and fetch data for those that exist
        (async () => {
            const found = [];
            const fetched = {};
            for (const e of CANDIDATE_ENDPOINTS) {
                try {
                    const res = await fetch(e.path);
                    if (!res.ok) continue;
                    const data = await res.json();
                    if (!Array.isArray(data)) continue;
                    // exclude WordInstance if present
                    if (e.key.toLowerCase().includes("wordinstance")) continue;
                    found.push(e.key);
                    fetched[e.key] = data;
                } catch (err) {
                    // ignore
                }
            }
            setAvailable(found);
            setTables(fetched);
            // build words map if words table present
            if (fetched.words) {
                const map = {};
                for (const w of fetched.words) {
                    const key = (w.surface || w.word || w.text || "").toString().trim().toLowerCase();
                    if (!key) continue;
                    if (!map[key]) map[key] = w;
                }
                setWordsMap(map);
            }
            // default active table = sentences if present else first
            if (found.includes("sentences")) setActiveTable("sentences");
            else setActiveTable(found[0] || null);
        })();
    }, []);

    useEffect(() => {
        if (!activeWord || !tables.words) return;
        // open words table
        setActiveTable("words");
        // scroll to the corresponding row after small delay
        setTimeout(() => {
            const el = document.querySelector(`[data-word="${CSS.escape(activeWord.toLowerCase())}"]`);
            if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 200);
    }, [activeWord, tables]);

    function displayValue(v) {
        if (v === null || v === undefined) return "";
        if (typeof v === "object") return JSON.stringify(v);
        return String(v);
    }

    function onSentenceClick(sentence) {
        setSelectedSentence(sentence);
        // ensure sentences table stays active
        setActiveTable("sentences");
    }

    function parseWordsFromText(text) {
        // naive split preserving punctuation as separate tokens
        // Arabic support: split on whitespace and keep punctuation
        const tokens = text.split(/(\s+|[،.؟!,:;«»"()\-——…])/g).filter(Boolean);
        return tokens;
    }

    function wordNormalized(token) {
        return token.replace(/[^\p{L}]/gu, "").toLowerCase();
    }

    function handleWordHover(token, e) {
        const key = wordNormalized(token);
        if (!key) {
            setTip(null);
            return;
        }
        const entry = wordsMap[key];
        const text = entry ? `Root: ${entry.root || entry.lemma || entry.root_word || "—"}` : "Not found";
        setTip({ text, x: e.clientX, y: e.clientY });
    }

    function handleWordLeave() {
        setTip(null);
    }

    function handleWordClick(token) {
        const key = wordNormalized(token);
        if (!key) return;
        setActiveWord(key);
    }

    return (
        <div className="app" role="application" aria-label="Learn Arabic flashcards app UI">
            <div className="sidebar panel">
                <div className="header">
                    <div style={{ flex: 1 }}>
                        <div className="app-title">Learn Arabic — Tables</div>
                        <div style={{ color: "var(--muted)", fontSize: 12 }}>Connected to backend: instance/demo.db</div>
                    </div>
                </div>
                <div className="table-list" role="navigation" aria-label="Tables list">
                    {available.length === 0 && (
                        <div style={{ color: "var(--muted)", padding: 8 }}>No API tables found. Expected endpoints: /api/words, /api/sentences, /api/roots, ...</div>
                    )}
                    {available.map((k) => (
                        <button
                            key={k}
                            className={"table-button" + (activeTable === k ? " active" : "")}
                            onClick={() => setActiveTable(k)}
                            aria-pressed={activeTable === k}
                        >
                            <span style={{ textTransform: "capitalize" }}>{k}</span>
                            <span style={{ color: "var(--muted)", fontSize: 12 }}>{(tables[k] || []).length}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="main">
                <div className="panel">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{activeTable ? activeTable.toUpperCase() : "No table selected"}</div>
                        <div style={{ color: "var(--muted)", fontSize: 13 }}>{activeTable && `${(tables[activeTable] || []).length} rows`}</div>
                    </div>

                    <div className="table-view" role="region" aria-label="Table data">
                        {activeTable && tables[activeTable] ? (
                            <table className="table-grid" aria-hidden={false}>
                                <thead>
                                    <tr>
                                        {(() => {
                                            const rows = tables[activeTable];
                                            const keys = rows.length ? Object.keys(rows[0]) : [];
                                            return keys.map((k) => <th key={k}>{k}</th>);
                                        })()}
                                    </tr>
                                </thead>
                                <tbody>
                                    {tables[activeTable].map((row, idx) => {
                                        const keys = Object.keys(row);
                                        const isSentence = activeTable === "sentences";
                                        return (
                                            <tr
                                                key={idx}
                                                className={"row-click"}
                                                onClick={() => isSentence ? onSentenceClick(row) : null}
                                                title={isSentence ? "Click to edit sentence" : undefined}
                                            >
                                                {keys.map((k) => {
                                                    const val = row[k];
                                                    if (activeTable === "words" && k === "frequency") {
                                                        const max = 100;
                                                        const pct = Math.min(100, Math.round((Number(val) || 0) / max * 100));
                                                        const normalized = Math.max(0, Math.min(100, pct));
                                                        return (
                                                            <td key={k}>
                                                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                                    <div className="freq-bar" aria-hidden>
                                                                        <div className="freq-fill" style={{ width: `${normalized}%` }} />
                                                                    </div>
                                                                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{val}</div>
                                                                </div>
                                                            </td>
                                                        );
                                                    }
                                                    return <td key={k}>{displayValue(val)}</td>;
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <div style={{ color: "var(--muted)", padding: 12 }}>Select a table to view its rows.</div>
                        )}
                    </div>
                </div>

                <div className="panel editor">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontWeight: 700 }}>Sentence Editor</div>
                        <div className="controls">
                            <button className="btn ghost" onClick={() => { /* placeholder */ }}>Save</button>
                            <button className="btn ghost" onClick={() => { /* placeholder */ }}>Delete</button>
                            <button className="btn ghost" onClick={() => { /* placeholder */ }}>Add Words</button>
                        </div>
                    </div>

                    <div className="sentence-box" role="textbox" aria-label="Sentence text">
                        {selectedSentence ? (
                            parseWordsFromText(selectedSentence.text || selectedSentence.sentence || "").map((tok, i) => {
                                const normalized = wordNormalized(tok);
                                const found = normalized && wordsMap[normalized];
                                const cls = "word " + (found ? "found" : (normalized ? "missing" : ""));
                                return (
                                    <span
                                        key={i}
                                        className={cls}
                                        onMouseEnter={(e) => handleWordHover(tok, e)}
                                        onMouseMove={(e) => handleWordHover(tok, e)}
                                        onMouseLeave={() => handleWordLeave()}
                                        onClick={() => handleWordClick(tok)}
                                        style={{ cursor: normalized ? "pointer" : "default" }}
                                    >
                                        {tok}
                                    </span>
                                );
                            })
                        ) : (
                            <div style={{ color: "var(--muted)" }}>Click a sentence row on the Sentences table to edit it here.</div>
                        )}
                    </div>

                    <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>Translation</div>
                            <div className="translate-box" contentEditable suppressContentEditableWarning>
                                {selectedSentence ? (selectedSentence.translation || selectedSentence.trans || "") : "No sentence selected"}
                            </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <button className="btn" onClick={() => { /* placeholder create flashcard */ }}>Create Flashcard</button>
                        </div>
                    </div>
                </div>

                <div className="panel">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ fontWeight: 700 }}>Words Table</div>
                        <div style={{ color: "var(--muted)", fontSize: 13 }}>{(tables.words || []).length} words</div>
                    </div>
                    <div className="table-view" ref={wordsTableRef}>
                        {tables.words ? (
                            <table className="table-grid" aria-label="Words">
                                <thead>
                                    <tr>
                                        {tables.words.length ? Object.keys(tables.words[0]).map(k => <th key={k}>{k}</th>) : <th>---</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {tables.words.map((w, i) => {
                                        const surface = (w.surface || w.word || w.text || "").toString();
                                        const dataWord = surface.toLowerCase();
                                        return (
                                            <tr key={i} className="words-table-row" data-word={dataWord}>
                                                {Object.keys(w).map((k) => {
                                                    if (k === "frequency") {
                                                        const val = w[k];
                                                        const max = 100;
                                                        const pct = Math.min(100, Math.round((Number(val) || 0) / max * 100));
                                                        return (
                                                            <td key={k}>
                                                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                                    <div className="freq-bar"><div className="freq-fill" style={{ width: `${pct}%` }} /></div>
                                                                    <div style={{ color: "var(--muted)", fontSize: 12 }}>{val}</div>
                                                                </div>
                                                            </td>
                                                        );
                                                    }
                                                    return <td key={k}>{displayValue(w[k])}</td>;
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <div style={{ color: "var(--muted)", padding: 12 }}>Words table not available.</div>
                        )}
                    </div>
                </div>
            </div>

            {tip && <div className="tooltip" style={{ left: tip.x + "px", top: tip.y + "px" }}>{tip.text}</div>}
        </div>
    );
}