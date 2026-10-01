interface CategoryGridProps {
  categories: string[];
  selected: string | null;
  onSelect: (category: string | null) => void;
}

export function CategoryGrid({ categories, selected, onSelect }: CategoryGridProps) {
  return (
    <div class="category-grid">
      <button
        type="button"
        class={`category-tile ${selected === null ? 'selected' : ''}`}
        onClick={() => onSelect(null)}
      >
        All
      </button>
      {categories.map((c) => (
        <button
          key={c}
          type="button"
          class={`category-tile ${selected === c ? 'selected' : ''}`}
          onClick={() => onSelect(selected === c ? null : c)}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
