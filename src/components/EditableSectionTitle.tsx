import React, { useState, useEffect } from 'react';

interface EditableSectionTitleProps {
  section: string;
  title: string;
  onTitleChange: (section: string, newTitle: string) => void;
}

export const EditableSectionTitle: React.FC<EditableSectionTitleProps> = React.memo(({ 
  section, 
  title, 
  onTitleChange 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const [hasChanged, setHasChanged] = useState(false);

  // Update editValue when title prop changes
  useEffect(() => {
    setEditValue(title);
    setHasChanged(false);
  }, [title]);

  const handleSave = () => {
    const trimmedValue = editValue.trim();
    if (trimmedValue && trimmedValue !== title) {
      onTitleChange(section, trimmedValue);
      setHasChanged(true);
    }
    setIsEditing(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(title);
      setIsEditing(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {isEditing ? (
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyPress}
          style={{ 
            padding: '4px 8px', 
            fontSize: '16px', 
            fontWeight: 'bold',
            border: '1px solid var(--border)', 
            borderRadius: '4px',
            background: 'var(--bg)',
            color: 'var(--fg)',
            minWidth: '120px'
          }}
          autoFocus
        />
      ) : (
        <h3 
          onClick={() => setIsEditing(true)}
          style={{ 
            cursor: 'pointer', 
            margin: 0,
            padding: '4px 8px',
            borderRadius: '4px',
            transition: 'background-color 0.2s',
            border: hasChanged ? '1px solid #10b981' : '1px solid transparent',
            backgroundColor: hasChanged ? '#f0fdf4' : 'transparent'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hasChanged ? '#f0fdf4' : '#f5f5f5'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = hasChanged ? '#f0fdf4' : 'transparent'}
          title="Click to edit"
        >
          {title}
          {hasChanged && <span style={{ color: '#10b981', fontSize: '12px', marginLeft: '4px' }}>✓</span>}
        </h3>
      )}
    </div>
  );
});
