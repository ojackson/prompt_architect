import React from 'react';

interface PresetSelectorProps {
  presetName: string;
  presetOptions: string[];
  isEditingPresetName: boolean;
  newPresetName: string;
  isSaving: boolean;
  saveSuccess?: boolean;
  success?: string;
  error?: string;
  onPresetNameChange: (value: string) => void;
  onNewPresetNameChange: (value: string) => void;
  onSaveAsNewPreset: () => void;
  onCancelNewPreset: () => void;
  onSaveCurrentPreset: () => void;
}

export const PresetSelector: React.FC<PresetSelectorProps> = React.memo(({
  presetName,
  presetOptions,
  isEditingPresetName,
  newPresetName,
  isSaving,
  saveSuccess,
  success,
  error,
  onPresetNameChange,
  onNewPresetNameChange,
  onSaveAsNewPreset,
  onCancelNewPreset,
  onSaveCurrentPreset
}) => {
  return (
    <div className="section sticky-header">
      <div className="section-header">
        <h2 className="section-title header-title">
          <span style={{ textTransform: 'uppercase' }}>PROMPT ARCHITECT V2.0.1 (20250929)</span> - owen.jackson@framestore.com
        </h2>
        <div className="section-actions" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label className="muted">Preset</label>
            {isEditingPresetName ? (
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={newPresetName}
                  onChange={(e) => onNewPresetNameChange(e.target.value)}
                  placeholder="Enter preset name"
                  style={{ padding: '4px 8px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '4px' }}
                  onKeyPress={(e) => e.key === 'Enter' && onSaveAsNewPreset()}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={onSaveAsNewPreset}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={onCancelNewPreset}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <select
                value={presetName}
                onChange={(e) => onPresetNameChange(e.target.value)}
              >
                {presetOptions.map(n => <option key={n} value={n}>{n}</option>)}
                <option value="add-new">+ Add New Preset</option>
              </select>
            )}
          </div>
          <button
            className={`btn btn-sm ${saveSuccess ? 'btn-success' : 'btn-secondary'}`}
            onClick={onSaveCurrentPreset}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
      {(success || error) && (
        <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '4px', fontSize: '12px' }}>
          {success && (
            <div style={{ color: '#10b981' }}>
              {success}
            </div>
          )}
          {error && (
            <div style={{ color: '#ef4444' }}>
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
