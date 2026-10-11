import { useEffect, useState } from 'react';

// A controlled number input strands a typed leading zero. Typing "0" in front
// of "1" puts "01" in the box, that parses back to 1, React compares 1 to the 1
// it already held, decides nothing changed and never rewrites the field, so
// "01" stays on screen. Holding the typed text here keeps what is displayed and
// what the caller holds in step.
export function NumberField({ value, onChange, min = 1, max, id, maxLength, className, disabled, placeholder }: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  id?: string;
  maxLength?: number;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState(String(value));

  // Follows the value when it changes from somewhere else, such as reopening a
  // saved build or carrying a recommendation into the planner.
  useEffect(() => { setText(String(value)); }, [value]);

  function change(raw: string) {
    const digits = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    setText(digits);
    if (!digits) return;
    const next = Number(digits);
    if (next >= min && (max === undefined || next <= max)) onChange(next);
  }

  // An empty box is a normal thing to pass through while retyping, so it is
  // only corrected once the field is left.
  function settle() {
    if (!text) { setText(String(value)); return; }
    let next = Math.max(min, Number(text));
    if (max !== undefined) next = Math.min(max, next);
    setText(String(next));
    if (next !== value) onChange(next);
  }

  return <input id={id} type="text" inputMode="numeric" autoComplete="off"
    className={className} value={text} maxLength={maxLength} disabled={disabled}
    placeholder={placeholder} onChange={event => change(event.target.value)} onBlur={settle}/>;
}