import { CaretDown, Check, CircleHalf, Moon, Sun, type Icon } from '@phosphor-icons/react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useThemePreference, type ThemePreference } from '../../lib/theme';

const OPTIONS: { value: ThemePreference; label: string; icon: Icon }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'Auto', icon: CircleHalf },
];

/** A macOS-style menu for choosing Light, Dark or Auto appearance. */
export default function AppearanceMenu() {
  const [preference, setPreference] = useThemePreference();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const current = OPTIONS.find((o) => o.value === preference)!;

  // Close when clicking anywhere else.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Focus the checked item when the menu opens.
  useEffect(() => {
    if (open) rootRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const items = [...(rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus();
    }
  }

  return (
    <div className="appearance" ref={rootRef}>
      <button
        ref={buttonRef}
        className="nav-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Appearance: ${current.label}`}
        onClick={() => setOpen((o) => !o)}
      >
        <current.icon aria-hidden />
        <span className="nav-label">{current.label}</span>
        <CaretDown className="nav-caret" size={11} weight="bold" aria-hidden />
      </button>
      {open && (
        <div className="appearance-menu" role="menu" aria-label="Appearance" onKeyDown={onMenuKeyDown}>
          <p className="appearance-heading">Appearance</p>
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              role="menuitemradio"
              aria-checked={o.value === preference}
              onClick={() => {
                setPreference(o.value);
                close();
              }}
            >
              <span className="menu-check">{o.value === preference && <Check size={13} weight="bold" aria-hidden />}</span>
              <o.icon aria-hidden />
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
