import { useState, useRef, useEffect } from 'react';
import { Search, Check } from 'lucide-react';

interface Student {
  id: string;
  student_name: string;
  index_number: string;
  grade: string;
}

interface StudentSearchSelectProps {
  students: Student[];
  value: string;
  onChange: (studentId: string) => void;
  placeholder?: string;
  required?: boolean;
}

export function StudentSearchSelect({
  students,
  value,
  onChange,
  placeholder = 'Search and select student...',
  required = false,
}: StudentSearchSelectProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = students.find((s) => s.id === value) || null;

  const filtered = students.filter((s) => {
    const q = query.toLowerCase();
    return (
      s.student_name.toLowerCase().includes(q) ||
      s.index_number.toLowerCase().includes(q) ||
      s.grade.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectStudent = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery('');
    setHighlight(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlight]) selectStudent(filtered[highlight].id);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={open ? query : selected ? `${selected.student_name} (${selected.index_number}) - ${selected.grade}` : ''}
        placeholder={placeholder}
        required={required && !value}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => {
          setOpen(true);
          setQuery('');
        }}
        onKeyDown={handleKeyDown}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
      />
      {selected && !open && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600">
          <Check className="w-4 h-4" />
        </span>
      )}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
              <Search className="w-4 h-4" />
              No students found
            </div>
          ) : (
            filtered.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => selectStudent(s.id)}
                className={`w-full text-left px-4 py-2 text-sm transition ${
                  i === highlight ? 'bg-blue-50' : 'hover:bg-gray-50'
                } ${s.id === value ? 'text-blue-700 font-medium' : 'text-gray-700'}`}
              >
                <span className="flex items-center justify-between">
                  <span>{s.student_name} ({s.index_number}) - {s.grade}</span>
                  {s.id === value && <Check className="w-4 h-4 text-blue-600" />}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
