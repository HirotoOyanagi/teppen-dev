import type { CardAttribute } from '@/core/types'
import { ATTRIBUTE_FILTER_OPTIONS } from '@/utils/constants'
import styles from './AttributeFilter.module.css'

interface AttributeFilterProps {
  selected: CardAttribute | 'all'
  onChange: (attr: CardAttribute | 'all') => void
  searchTerm?: string
  onSearchChange?: (term: string) => void
}

export default function AttributeFilter({ selected, onChange, searchTerm, onSearchChange }: AttributeFilterProps) {
  return (
    <div className={styles.filterBar}>
      {ATTRIBUTE_FILTER_OPTIONS.map(({ key, color, label }) => (
        <div
          key={key}
          className={`${styles.attrChip} ${selected === key ? styles.active : ''}`}
          style={{ background: color }}
          onClick={() => onChange(key)}
        >
          {label}
        </div>
      ))}
      {onSearchChange && (
        <input
          type="text"
          placeholder="カード名で検索..."
          value={searchTerm || ''}
          onChange={(e) => onSearchChange(e.target.value)}
          className={styles.searchInput}
        />
      )}
    </div>
  )
}
