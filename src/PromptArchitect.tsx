import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useLocalStorage, useBatchLocalStorage } from "./hooks/useLocalStorage";
import { useOpenAI } from "./hooks/useAPI";
import {
  CandidatePool,
  pickOneValue
} from "./utils/randomPicker";
import { getPreset, getAvailablePresets, putPreset, DEFAULT_PRESET, PresetData, SectionData, resolvePresetSections } from "./services/presetService";
import { EditableSectionTitle } from "./components/EditableSectionTitle";
import { BoxEditor } from "./components/BoxEditor";
import { PresetSelector } from "./components/PresetSelector";


// ---------------------------------------------
// Prompt Architect — Presets + random-from-selected + retries + guardrails + progress
// ---------------------------------------------

// ---------------------------------------------
// Default preset loading
// ---------------------------------------------
async function loadDefaultPreset(): Promise<PresetData> {
  try {
    const defaultPreset = await getPreset("default");
    return defaultPreset || DEFAULT_PRESET;
  } catch (error) {
    console.warn("Failed to load default preset:", error);
    return DEFAULT_PRESET;
  }
}

// ---------------------------------------------
// UI Components
// ---------------------------------------------

// ---------------------------------------------
// Main Component
// ---------------------------------------------
export default function PromptArchitect() {
  // Presets
  const [presetName, setPresetName] = useLocalStorage("pa_preset", "HWS14");
  const [presetOptions, setPresetOptions] = useState(["default", "HWS14", "ORJ", "Reptile"]);
  const [newPresetName, setNewPresetName] = useState("");
  const [isEditingPresetName, setIsEditingPresetName] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Refs for auto-resize
  const instructionsRef = useRef<HTMLTextAreaElement>(null);
  const postRef = useRef<HTMLTextAreaElement>(null);
  const resultsRef = useRef<HTMLTextAreaElement>(null);

  // Visible system prompt - will be loaded from preset
  const [instructions, setInstructions] = useState("");

  // Dynamic sections - will be loaded from preset
  const [sections, setSections] = useState<SectionData[]>([]);

  // Helper functions for section management
  const handleAddSection = useCallback(() => {
    const newSection: SectionData = {
      id: crypto.randomUUID(),
      title: "New Section",
      list: "",
      selections: [],
      isRandomized: true,
    };
    setSections(prevSections => [...prevSections, newSection]);
  }, []);

  const handleRemoveSection = useCallback((idToRemove: string) => {
    setSections(prevSections => prevSections.filter(section => section.id !== idToRemove));
  }, []);

  const handleSectionTitleChange = useCallback((id: string, newTitle: string) => {
    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) {
      console.warn('Section title cannot be empty');
      return;
    }
    
    setSections(prev => prev.map(s => s.id === id ? {...s, title: trimmedTitle} : s));
  }, []);

  const handleSectionListChange = useCallback((id: string, newList: string) => {
    setSections(prev => prev.map(s => s.id === id ? {...s, list: newList} : s));
  }, []);

  const handleSectionSelectionsChange = useCallback((id: string, newSelections: string[]) => {
    setSections(prev => prev.map(s => s.id === id ? {...s, selections: newSelections} : s));
  }, []);

  const handleSectionRandomToggle = useCallback((id: string, isRandomized: boolean) => {
    setSections(prev => prev.map(s => s.id === id ? {...s, isRandomized} : s));
  }, []);

  // Controls - will be loaded from preset
  const [controls, updateControl] = useBatchLocalStorage({
    seed: -1,
    batch: 1,
    concurrency: 4,
    model: "gpt-4o-mini"
  });

  // Always use pure random mode (true random selection for randomized sections)
  const balancedMode = false;

  // Results + preview + progress
  const [prompts, setPrompts] = useLocalStorage<string[]>('pa_prompts', []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [warn, setWarn] = useState("");
  const [success, setSuccess] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [lastPayloads, setLastPayloads] = useState<any[]>([]);
  const [progress, setProgress] = useState({ total: 0, done: 0, ok: 0, fail: 0 });

  // API key from GUI input
  const [apiKey, setApiKey] = useLocalStorage("pa_api_key", "");
  const openAI = useOpenAI();

  // Load available presets on mount
  useEffect(() => {
    const loadPresets = async () => {
      const availablePresets = await getAvailablePresets();
      setPresetOptions(availablePresets);
    };
    loadPresets();
  }, []);

  // Auto-resize results textarea when prompts change
  useEffect(() => {
    if (resultsRef.current) {
      const textarea = resultsRef.current;
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    }
  }, [prompts]);

  // Auto-resize instructions textarea when instructions change
  useEffect(() => {
    if (instructionsRef.current) {
      const textarea = instructionsRef.current;
      // Small delay to ensure textarea is fully rendered
      setTimeout(() => {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
      }, 10);
    }
  }, [instructions]);

  // Load preset whenever preset changes
  useEffect(() => {
    (async () => {
      try {
        const preset = await getPreset(presetName);
        const presetData = preset || await loadDefaultPreset();

        setInstructions(presetData.instructions || "");
        setSections(resolvePresetSections(presetData));

        const defaults = presetData.defaults || {};
        updateControl('model', defaults.model || "gpt-4o-mini");
        updateControl('seed', Number.isFinite(defaults.seed) ? defaults.seed : -1);
        updateControl('batch', Number.isFinite(defaults.batch) ? defaults.batch : 1);
        updateControl('concurrency', Number.isFinite(defaults.concurrency) ? defaults.concurrency : 4);
      } catch (e) {
        console.warn("Preset load error:", e);
      }
    })();
  }, [presetName, updateControl]);


  // Build one payload — single-draw per section (still returns exactly one value)
  const buildOne = useCallback((batchIndex: number, seedBase: number) => {
    const payload: Record<string, string> = {};
    sections.forEach((section) => {
      if (!section.title?.trim()) return; // skip untitled sections
      
      const pool: CandidatePool = {
        label: section.title,
        listText: section.list,
        selections: section.selections,
        isRandomized: !!section.isRandomized,
      };
      const val = pickOneValue(pool, Number(seedBase), batchIndex, section.id);
      const trimmedVal = val?.trim();
      if (trimmedVal) payload[section.title] = trimmedVal; // only add non-empty values
    });
    return payload;
  }, [sections]);

  // Messages
  const buildLLMMessages = useCallback((payload: any) => {
    // Generate dynamic field names based on current section titles
    const fieldNames = sections.map(section => section.title).join(", ");
    
    const schema =
`The user message is a JSON object with these fields:
${fieldNames}.
Use them verbatim as source tags; rewrite into one cohesive cinematic paragraph.
Do not invent values not present; resolve contradictions by omission only.`;
    const system = `${schema}\n\n${instructions || "You rewrite a structured scene spec into ONE cinematic paragraph for an AI image generator."}`;
    const user = JSON.stringify(payload, null, 2);
    return [{ role: "system", content: system }, { role: "user", content: user }];
  }, [instructions, sections]);

  // Concurrency-limited LLM calls + progress
  const callLLM = useCallback(async (payloads: any[], maxParallel = 4) => {
    if (!apiKey) throw new Error("No API key set. Enter your OpenAI API key to use Send to GPT.");
    const queue = payloads.map((p) => buildLLMMessages(p));

    const results = new Array(queue.length).fill("");
    setProgress({ total: queue.length, done: 0, ok: 0, fail: 0 });

    let index = 0;
    async function worker() {
      while (index < queue.length) {
        const myIndex = index++;
        const messages = queue[myIndex];
        try {
          const result = await openAI.callOpenAI(messages, controls.model, apiKey);
          results[myIndex] = result || "";
          setProgress((p) => ({ ...p, done: p.done + 1, ok: p.ok + 1 }));
        } catch (e) {
          results[myIndex] = "";
          setProgress((p) => ({ ...p, done: p.done + 1, fail: p.fail + 1 }));
        }
      }
    }

    const N = Math.max(1, Math.min(Number(maxParallel) || 1, 10)); // clamp 1..10
    await Promise.all(Array.from({ length: N }, () => worker()));
    return results;
  }, [apiKey, buildLLMMessages, controls.model, openAI]);

  // Save current UI back into the active preset
  const savePresetToDisk = useCallback(async () => {
    const payload = {
      instructions,
      sections,
      defaults: {
        model: controls.model,
        seed: Number(controls.seed),
        batch: Number(controls.batch),
        concurrency: Number(controls.concurrency)
      }
    };
    return await putPreset(presetName, payload);
  }, [instructions, sections, controls, presetName]);

  // Save current preset
  const saveCurrentPreset = useCallback(async () => {
    setIsSaving(true);
    setError("");
    setSuccess("");
    try {
      // Add a small delay to ensure all state updates have been processed
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = await savePresetToDisk();
      if (result.success) {
        console.log('Preset saved successfully:', result.message);
        setSaveSuccess(true);
        // Reset the success state after animation completes
        setTimeout(() => setSaveSuccess(false), 2000);
      } else {
        setError(result.error || 'Failed to save preset');
      }
    } catch (error) {
      console.error('Failed to save preset:', error);
      setError(error instanceof Error ? error.message : 'Failed to save preset');
    } finally {
      setIsSaving(false);
    }
  }, [savePresetToDisk, presetName]);

  // Save as new preset
  const saveAsNewPreset = useCallback(async () => {
    if (!newPresetName.trim()) {
      return;
    }
    
    setIsSaving(true);
    try {
      const payload = {
        instructions,
        sections,
        defaults: {
          model: controls.model,
          seed: Number(controls.seed),
          batch: Number(controls.batch),
          concurrency: Number(controls.concurrency)
        }
      };
      
      await putPreset(newPresetName.trim(), payload);
      
      // Add to preset options if not already there
      if (!presetOptions.includes(newPresetName.trim())) {
        setPresetOptions([...presetOptions, newPresetName.trim()]);
      }
      
      // Switch to the new preset
      setPresetName(newPresetName.trim());
      setNewPresetName("");
      setIsEditingPresetName(false);
    } catch (error) {
      console.error('Failed to save preset:', error);
    } finally {
      setIsSaving(false);
    }
  }, [newPresetName, instructions, sections, controls, presetOptions, setPresetName]);

  // Handle preset name change
  const handlePresetNameChange = useCallback((value: string) => {
    if (value === "add-new") {
      setIsEditingPresetName(true);
      setNewPresetName("");
    } else {
      setPresetName(value);
      setIsEditingPresetName(false);
    }
  }, [setPresetName]);


  // Section reordering handlers
  const moveSectionUp = useCallback((sectionId: string) => {
    const currentIndex = sections.findIndex(s => s.id === sectionId);
    if (currentIndex > 0) {
      const newSections = [...sections];
      [newSections[currentIndex - 1], newSections[currentIndex]] = [newSections[currentIndex], newSections[currentIndex - 1]];
      setSections(newSections);
    }
  }, [sections]);

  const moveSectionDown = useCallback((sectionId: string) => {
    const currentIndex = sections.findIndex(s => s.id === sectionId);
    if (currentIndex < sections.length - 1) {
      const newSections = [...sections];
      [newSections[currentIndex], newSections[currentIndex + 1]] = [newSections[currentIndex + 1], newSections[currentIndex]];
      setSections(newSections);
    }
  }, [sections]);

  // Generate section UI components dynamically
  const renderSection = useCallback((section: SectionData, index: number) => {
    const placeholder = section.title === "Pre" ? "Add entries separated by commas or new lines" : "Add entries…";
    const canMoveUp = index > 0;
    const canMoveDown = index < sections.length - 1;
    
    return (
      <div 
        key={`section-${section.id}`} 
        className="prompt-architect-section"
      >
        <div className="section-header-with-remove">
          <div className="section-title-container">
            <EditableSectionTitle 
              section={section.id} 
              title={section.title} 
              onTitleChange={handleSectionTitleChange} 
            />
          </div>
          <div className="section-actions">
            <div className="section-order-controls">
              <button
                className="btn-order btn-order-up"
                onClick={() => moveSectionUp(section.id)}
                disabled={!canMoveUp}
                title="Move section up"
              >
                ↑
              </button>
              <button
                className="btn-order btn-order-down"
                onClick={() => moveSectionDown(section.id)}
                disabled={!canMoveDown}
                title="Move section down"
              >
                ↓
              </button>
            </div>
            {sections.length > 1 && (
              <button
                className="btn-remove"
                onClick={() => handleRemoveSection(section.id)}
                title="Remove section"
              >
                ×
              </button>
            )}
          </div>
        </div>
        <BoxEditor
          key={`boxeditor-${section.id}`}
          value={section.list} 
          setValue={(value) => handleSectionListChange(section.id, value)}
          selected={section.selections} 
          setSelected={(selected) => handleSectionSelectionsChange(section.id, selected as string[])}
          randomOn={section.isRandomized} 
          setRandomOn={(randomOn) => handleSectionRandomToggle(section.id, randomOn)}
          placeholder={placeholder}
        />
      </div>
    );
  }, [sections, handleSectionTitleChange, handleSectionListChange, handleSectionSelectionsChange, handleSectionRandomToggle, handleRemoveSection, moveSectionUp, moveSectionDown]);

  const onRun = useCallback(async () => {
    setBusy(true);
    setError("");
    setWarn("");
    setProgress({ total: 0, done: 0, ok: 0, fail: 0 });

    try {
      if (!apiKey) throw new Error("Enter your OpenAI API key to generate prompts.");

      // Guardrails (non-blocking)
      const warnings = [];
      if ((Number(controls.batch) || 0) > 250) warnings.push("Large batch: consider ≤ 250 for cost/rate safety.");
      if ((Number(controls.concurrency) || 0) > 8) warnings.push("High concurrency: consider ≤ 8 to avoid rate limits.");
      if (warnings.length) setWarn(warnings.join(" "));

      // Build payloads (BEFORE saving preset, to avoid any chance of state being reset)
      const s = Number(controls.seed);
      const batchSize = Math.max(1, Number(controls.batch) || 1);

      // Quick sanity log for Lens section
      if (import.meta.env.DEV) {
        const lensSec = sections.find(s => s.title.trim().toLowerCase() === "lens");
        console.table({
          title: lensSec?.title,
          isRandomized: lensSec?.isRandomized,
          selections_len: lensSec?.selections?.length ?? 0,
          list_len: (lensSec?.list || "").length,
        });
      }

      // Build payloads using pure random mode (independent draws per section)
      const payloads: any[] = [];
      for (let i = 0; i < batchSize; i++) {
        payloads.push(buildOne(i, s));
      }

      setLastPayloads(payloads);
      setProgress((p) => ({ ...p, total: payloads.length }));

      // Save preset AFTER payloads are computed
      const saveResult = await savePresetToDisk();
      if (!saveResult?.success && saveResult?.error) {
        console.warn("Preset save error:", saveResult.error);
      }

      // Call LLM
      const results = await callLLM(payloads, Number(controls.concurrency) || 4);
      setPrompts(results);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }, [apiKey, controls, sections, savePresetToDisk, callLLM, setPrompts]);

  const downloadTxt = useCallback(() => {
    const blob = new Blob([prompts.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    
    // Format date and time as yyyy_mm_dd_hh_mm_ss
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const dateTime = `${year}_${month}_${day}_${hours}_${minutes}_${seconds}`;
    
    // Create filename: {count}_{preset}_prompts_{datetime}.txt
    const promptCount = prompts.length;
    const filename = `${promptCount}_${presetName}_prompts_${dateTime}.txt`;
    
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [prompts, presetName]);

  const copyToClipboard = useCallback(() => {
    const content = (prompts || []).join("\n");
    
    if (!content.trim()) {
      return;
    }
    
    // Copy to clipboard
    navigator.clipboard.writeText(content).then(() => {
      // Success - could add a toast notification here if desired
    }).catch(err => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = content;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (fallbackErr) {
        // Fallback copy failed
      }
      document.body.removeChild(textArea);
    });
  }, [prompts]);

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <section>
      {/* Header with Preset selector */}
      <PresetSelector
        presetName={presetName}
        presetOptions={presetOptions}
        isEditingPresetName={isEditingPresetName}
        newPresetName={newPresetName}
        isSaving={isSaving}
        saveSuccess={saveSuccess}
        success={success}
        error={error}
        onPresetNameChange={handlePresetNameChange}
        onNewPresetNameChange={setNewPresetName}
        onSaveAsNewPreset={saveAsNewPreset}
        onCancelNewPreset={() => {
          setIsEditingPresetName(false);
          setNewPresetName("");
        }}
        onSaveCurrentPreset={saveCurrentPreset}
      />

      <hr className="section-divider" />

      {/* LLM Instructions */}
      <div className="prompt-architect-section">
        <h3>LLM Instructions</h3>
        <textarea
          ref={instructionsRef}
          className="mono"
          value={instructions}
          onChange={(e) => {
            setInstructions(e.target.value);
            // Auto-resize
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = target.scrollHeight + 'px';
          }}
          onInput={(e) => {
            // Auto-resize on input
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = target.scrollHeight + 'px';
          }}
          rows={1}
          style={{ 
            width: '100%', 
            minHeight: '60px',
            resize: 'none',
            overflow: 'hidden'
          }}
        />
        <div className="muted" style={{ marginTop: '6px', fontSize: '11px' }}>
          Loaded from <code>/src/presets/{presetName}.json</code> (saved back on Send).
        </div>
      </div>

      <hr className="section-divider dotted" />

      {/* Lists */}
      {sections.map((section, index) => renderSection(section, index))}
      
      {/* Add Section Button */}
      <div className="add-section-container">
        <button
          className="btn"
          onClick={handleAddSection}
        >
          + Add Section
        </button>
      </div>

      <hr className="section-divider thick" />

      {/* Run Controls */}
      <div className="prompt-architect-section">
        <div className="section-header">
          <h3>Run Controls</h3>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setShowPreview((v) => !v)}
          >
            {showPreview ? "Hide JSON Preview" : "Show JSON Preview"}
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* First row: Model and API Key */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'start' }}>
            <label>
              <div style={{ fontSize: '12px', marginBottom: '4px' }}>Model</div>
              <select
                value={controls.model}
                onChange={(e) => updateControl('model', e.target.value)}
                style={{ width: '100%' }}
              >
                <option>gpt-4o-mini</option>
                <option>gpt-4o</option>
                <option>gpt-4.1-mini</option>
              </select>
            </label>

            <label>
              <div style={{ fontSize: '12px', marginBottom: '4px' }}>API Key</div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  style={{ 
                    flex: 1,
                    padding: '6px 8px',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontFamily: 'monospace'
                  }}
                />
                {apiKey && (
                  <button
                    className="btn btn-outline btn-xs"
                    onClick={() => setApiKey("")}
                    title="Clear API key"
                    style={{ padding: '4px 6px', fontSize: '10px' }}
                  >
                    ×
                  </button>
                )}
              </div>
            </label>
          </div>

          {/* Second row: Batch, Concurrency, and Seed */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', alignItems: 'start' }}>
            <label>
              <div style={{ fontSize: '12px', marginBottom: '4px' }}>Batch</div>
              <input
                type="number"
                min={1}
                max={500}
                value={controls.batch}
                onChange={(e) => updateControl('batch', Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </label>

            <label>
              <div style={{ fontSize: '12px', marginBottom: '4px' }}>Concurrency</div>
              <input
                type="number"
                min={1}
                max={10}
                value={controls.concurrency}
                onChange={(e) => updateControl('concurrency', Number(e.target.value))}
                title="How many prompts to send in parallel"
                style={{ width: '100%' }}
              />
            </label>

            <label>
              <div style={{ fontSize: '12px', marginBottom: '4px' }}>Seed</div>
              <input
                type="number"
                value={controls.seed}
                onChange={(e) => updateControl('seed', Number(e.target.value))}
                style={{ width: '100%' }}
              />
              <div className="muted" style={{ fontSize: '10px', marginTop: '2px' }}>-1 = fully random</div>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
            <button
              className={`btn btn-primary btn-lg ${busy ? 'disabled' : ''}`}
              onClick={onRun}
              disabled={busy}
            >
              {busy ? "Sending…" : "Send to GPT"}
            </button>
          </div>
        </div>

        {(busy || progress.total > 0 || warn) && (
          <div style={{ marginTop: '16px' }}>
            {warn && (
              <div className="muted" style={{ 
                padding: '8px 12px', 
                backgroundColor: 'var(--bg-subtle)', 
                border: '1px solid var(--border)',
                borderRadius: '4px',
                marginBottom: '8px',
                fontSize: '12px'
              }}>
                {warn}
              </div>
            )}
            {progress.total > 0 && (
              <>
                <progress value={progress.done} max={progress.total} style={{ width: '100%' }} />
                <div className="muted" style={{ marginTop: '4px', fontSize: '12px' }}>
                  {progress.done}/{progress.total} • ok {progress.ok} • fail {progress.fail}
                </div>
              </>
            )}
          </div>
        )}

        {showPreview && (
          <textarea
            className="mono"
            readOnly
            value={
              lastPayloads.length
                ? JSON.stringify(lastPayloads, null, 2)
                : "(No payload yet — click 'Send to GPT' to generate and preview the exact JSON that gets sent.)"
            }
            rows={8}
            style={{ 
              marginTop: '16px',
              width: '100%',
              minHeight: '200px'
            }}
          />
        )}

        {error && (
          <div className="muted" style={{ 
            marginTop: '12px', 
            color: 'var(--error)', 
            fontSize: '12px',
            whiteSpace: 'pre-wrap'
          }}>
            {error}
          </div>
        )}

        {success && (
          <div className="muted" style={{ 
            marginTop: '12px', 
            color: '#10b981', 
            fontSize: '12px',
            whiteSpace: 'pre-wrap'
          }}>
            {success}
          </div>
        )}
      </div>

      <hr className="section-divider" />

      {/* Results */}
      <div className="prompt-architect-section">
        <div className="section-header">
          <h3>Results</h3>
          <div className="section-actions">
            <button
              className="btn btn-primary btn-sm"
              onClick={copyToClipboard}
              disabled={!prompts || prompts.length === 0}
            >
              Copy
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={downloadTxt}
            >
              Download .txt
            </button>
          </div>
        </div>
        <textarea
          ref={resultsRef}
          className="mono"
          readOnly
          value={(prompts || []).join("\n")}
          rows={1}
          style={{ 
            width: '100%',
            minHeight: '120px',
            resize: 'none',
            overflow: 'hidden'
          }}
          onLoad={(e) => {
            // Auto-resize on load
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = target.scrollHeight + 'px';
          }}
        />
        <div className="muted" style={{ marginTop: '16px', fontSize: '12px' }}>
          Presets load from and save to <code>/src/presets/*.json</code>. API key is entered above and stored locally in your browser.
          Each prompt is a separate API call, sent with your chosen concurrency limit.
        </div>
      </div>
    </section>
  );
}
