import React, { useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { applyTheme, currentTheme } from './theme';

// Keep appearance state here: changing it must not rerender stateful page editors.
export default function AppearanceControl() {
  const [theme, setTheme] = useState(currentTheme);
  return (
    <div className="appearance-control" role="group" aria-label="Appearance"
      onKeyDown={event => event.stopPropagation()}>
      {[['light', 'Light', Sun], ['dark', 'Dark', Moon]].map(([value, label, Icon]) => (
        <button key={value} type="button" aria-pressed={theme === value}
          onClick={() => { applyTheme(value); setTheme(value); }}>
          <Icon className="w-4 h-4" aria-hidden="true" /><span>{label}</span>
        </button>
      ))}
    </div>
  );
}
