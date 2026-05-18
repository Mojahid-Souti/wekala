"use client";

import type { CategoryOut } from "@/lib/api";

type Props = {
  categories: CategoryOut[];
  selected: string[];
  onChange: (ids: string[]) => void;
  label: string;
};

export function CategoryFilter({ categories, selected, onChange, label }: Props) {
  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  if (categories.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-gray-500">{label}:</span>
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          onClick={() => toggle(cat.id)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            selected.includes(cat.id)
              ? "border-indigo-600 bg-indigo-600 text-white"
              : "border-gray-300 text-gray-600 hover:border-indigo-400"
          }`}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}
