type Props = {
  options: string[];
  value: string;
  onChange: (v: string) => void;
};

export function Dropdown({ options, value, onChange }: Props) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
            className="border px-2 py-1 rounded">
      {options.map(opt => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}
