import { useEffect, useState } from 'react';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function SearchBar({ value, onChange }: Props) {
  const [local, setLocal] = useState(value);

  // Sync inbound value (e.g., when filters are cleared) without overwriting user typing.
  useEffect(() => {
    setLocal(value);
  }, [value]);

  // Debounce typing.
  useEffect(() => {
    if (local === value) return;
    const t = window.setTimeout(() => onChange(local), 150);
    return () => window.clearTimeout(t);
  }, [local, value, onChange]);

  return (
    <div className="search">
      <span className="icon" aria-hidden>
        🔍
      </span>
      <input
        type="search"
        placeholder="Search name or spec body (e.g. get_current_epoch, MAX_VALIDATORS)"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
      />
    </div>
  );
}
