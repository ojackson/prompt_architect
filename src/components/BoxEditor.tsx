import React, { useRef } from 'react';
import { toList } from '../utils/random';

interface BoxEditorProps {
  value: string;
  setValue: (value: string) => void;
  selected: string[];
  setSelected: (selected: string[]) => void;
  randomOn: boolean;
  setRandomOn: (randomOn: boolean) => void;
  placeholder: string;
}

export const BoxEditor: React.FC<BoxEditorProps> = React.memo(({ 
  value, 
  setValue, 
  selected, 
  setSelected, 
  randomOn, 
  setRandomOn, 
  placeholder 
}) => {
  const options = toList(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function toggle(opt: string) {
    const has = selected.includes(opt);
    if (has) {
      // If clicking a selected option, deselect it
      setSelected(selected.filter((o) => o !== opt));
    } else {
      // If clicking an unselected option, select it and turn off random
      setSelected([...selected, opt]);
      setRandomOn(false);
    }
  }

  // Normalize selections to ensure they match canonical tokenization
  React.useEffect(() => {
    const canonical = new Set(toList(value || "").map(s => s.toLowerCase()));
    const normalizedSelected = (selected || []).filter(s => canonical.has((s ?? "").trim().toLowerCase()));
    if (normalizedSelected.length !== selected.length) {
      setSelected(normalizedSelected);
    }
  }, [value, selected, setSelected]);

  function toggleRandom() {
    const willBeOn = !randomOn;
    setRandomOn(willBeOn);
    if (willBeOn) {
      // If turning random on, clear all selections
      setSelected([]);
    }
  }

  return (
    <div>
      <textarea
        ref={textareaRef}
        className="mono"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        style={{ width: '100%', marginBottom: '8px' }}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
        <button
          onClick={toggleRandom}
          className={`btn btn-sm ${randomOn ? 'btn-primary' : 'btn-outline'}`}
          title="Use a random choice for this box"
        >
          Random
        </button>
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              onClick={() => toggle(opt)}
              className={`btn btn-sm ${active ? 'btn-primary' : 'btn-secondary'}`}
              title={opt}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
});
