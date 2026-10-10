import { THEME_NAMES, THEMES } from '../../lib/diagram/themes';
import type { ThemeName } from '../../lib/diagram/types';

export default function ThemePicker({ value, onChange }: { value: ThemeName; onChange: (theme: ThemeName) => void }) {
  return (
    <div className="theme-picker" role="radiogroup" aria-label="Colour theme">
      {THEME_NAMES.map((name) => {
        const theme = THEMES[name];
        return (
          <button
            key={name}
            role="radio"
            aria-checked={value === name}
            aria-label={theme.label}
            title={theme.label}
            className={`swatch${value === name ? ' active' : ''}`}
            style={{ background: `linear-gradient(135deg, ${theme.levels[0].bg} 50%, ${theme.levels[2].bg} 50%)` }}
            onClick={() => onChange(name)}
          />
        );
      })}
    </div>
  );
}
