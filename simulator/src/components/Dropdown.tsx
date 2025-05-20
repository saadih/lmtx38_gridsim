type DropdownProps<T extends string> = {
  options: T[];
  value: T;
  onChange: (v: T) => void;
};

export function Dropdown<T extends string>({ options, value, onChange }: DropdownProps<T>) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="border px-2 py-1 rounded"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}
