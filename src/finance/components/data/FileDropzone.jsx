import React from 'react';

/**
 * FileDropzone — dashed drop target + click-to-browse. Calls onFile(File).
 */
export function FileDropzone({ onFile, accept = '.csv', hint = 'CSV files only', style }) {
  const inputRef = React.useRef(null);
  const [over, setOver] = React.useState(false);
  const [name, setName] = React.useState(null);

  const handle = (file) => {
    if (!file) return;
    setName(file.name);
    onFile && onFile(file);
  };

  return (
    <div
      onClick={() => inputRef.current && inputRef.current.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files && e.dataTransfer.files[0]); }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: '40px 24px',
        textAlign: 'center',
        cursor: 'pointer',
        borderRadius: 'var(--radius-lg, 18px)',
        border: `1.5px dashed ${over ? 'var(--accent)' : 'var(--border-strong, var(--border-hairline))'}`,
        background: over ? 'var(--surface-hover)' : 'var(--surface-sunken)',
        transition: 'border-color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out)',
        ...style,
      }}
    >
      <span style={{ display: 'inline-flex', color: 'var(--text-tertiary)' }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
        </svg>
      </span>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
          {name || 'Drop your CSV here, or click to browse'}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 3 }}>{hint}</div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => handle(e.target.files && e.target.files[0])}
      />
    </div>
  );
}
