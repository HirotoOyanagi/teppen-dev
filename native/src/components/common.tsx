import type { ReactNode } from 'react'
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { CardAttribute, CardDefinition } from '@/core/types'

import { resolveNativeCardImage } from '../cards'
import { useNativeNavigation } from '../app/navigation'
import { colors, spacing } from '../theme'

const ATTR_LABELS: Record<CardAttribute | 'all', string> = {
  all: '全',
  red: '赤',
  green: '緑',
  purple: '紫',
  black: '黒',
}

export const ATTR_COLORS: Record<CardAttribute | 'all', string> = {
  all: '#51657a',
  red: colors.red,
  green: colors.green,
  purple: colors.purple,
  black: colors.black,
}

export function ScreenFrame({
  title,
  subtitle,
  onBack,
  footer,
  scroll = true,
  children,
}: {
  title: string
  subtitle?: string
  onBack?: () => void
  footer?: ReactNode
  scroll?: boolean
  children: ReactNode
}) {
  const content = scroll ? (
    <ScrollView contentContainerStyle={styles.scrollContent}>{children}</ScrollView>
  ) : (
    <View style={styles.fixedContent}>{children}</View>
  )

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.background} />
      <View style={styles.header}>
        <View style={styles.headerRow}>
          {onBack ? (
            <Pressable onPress={onBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>戻る</Text>
            </Pressable>
          ) : (
            <View style={styles.backSpacer} />
          )}
          <View style={styles.headerTextGroup}>
            <Text style={styles.headerTitle}>{title}</Text>
            {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
          </View>
        </View>
      </View>
      {content}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  )
}

export function Surface({
  children,
  style,
}: {
  children: ReactNode
  style?: object
}) {
  return <View style={[styles.surface, style]}>{children}</View>
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.primaryButton, disabled ? styles.buttonDisabled : null]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  )
}

export function SecondaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.secondaryButton, disabled ? styles.buttonDisabled : null]}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  )
}

export function Chip({
  label,
  color,
  active,
  onPress,
}: {
  label: string
  color: string
  active?: boolean
  onPress?: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: color, backgroundColor: active ? color : 'rgba(255,255,255,0.04)' },
      ]}
    >
      <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{label}</Text>
    </Pressable>
  )
}

export function AttributeChip({
  attribute,
  active,
  onPress,
}: {
  attribute: CardAttribute | 'all'
  active?: boolean
  onPress: () => void
}) {
  return (
    <Chip
      label={ATTR_LABELS[attribute]}
      color={ATTR_COLORS[attribute]}
      active={active}
      onPress={onPress}
    />
  )
}

function CardHandVisual({
  card,
  count,
  disabled,
  selected,
}: {
  card: CardDefinition
  count?: number
  disabled?: boolean
  selected?: boolean
}) {
  const imageUri = resolveNativeCardImage(card)
  return (
    <View
      style={[
        styles.cardHand,
        disabled ? styles.cardTileDisabled : null,
        selected ? styles.cardTileSelected : null,
      ]}
    >
      <View style={styles.cardVisualHand}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} resizeMode="cover" style={styles.cardImage} />
        ) : (
          <View
            style={[
              styles.cardFallback,
              styles.cardFallbackFill,
              { backgroundColor: ATTR_COLORS[card.attribute] },
            ]}
          />
        )}
        <View style={styles.cardCostBadge}>
          <Text style={styles.cardCostText}>{card.cost}</Text>
        </View>
        {count ? (
          <View style={[styles.cardCountBadge, styles.cardCountBadgeHand]}>
            <Text style={styles.cardCountText}>x{count}</Text>
          </View>
        ) : null}
        <View style={styles.cardHandMeta}>
          <Text style={styles.cardHandName} numberOfLines={2}>
            {card.name}
          </Text>
          <Text style={styles.cardHandType}>
            {card.type === 'unit' && card.unitStats
              ? `${card.unitStats.attack}/${card.unitStats.hp}`
              : 'Action'}
          </Text>
        </View>
        <View style={[styles.cardAttributeStripe, { backgroundColor: ATTR_COLORS[card.attribute] }]} />
      </View>
    </View>
  )
}

export function CardTile({
  card,
  count,
  disabled,
  selected,
  compact,
  variant = 'row',
  onPress,
  onLongPress,
  /** true のとき手札見た目のみ（親の PanResponder でドラッグ／タップを処理） */
  handNonInteractive,
}: {
  card: CardDefinition
  count?: number
  disabled?: boolean
  selected?: boolean
  compact?: boolean
  variant?: 'row' | 'hand'
  onPress?: () => void
  onLongPress?: () => void
  handNonInteractive?: boolean
}) {
  const imageUri = resolveNativeCardImage(card)

  if (variant === 'hand') {
    if (handNonInteractive) {
      return <CardHandVisual card={card} count={count} disabled={disabled} selected={selected} />
    }
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={240}
        style={[
          styles.cardHand,
          disabled ? styles.cardTileDisabled : null,
          selected ? styles.cardTileSelected : null,
        ]}
      >
        <View style={styles.cardVisualHand}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} resizeMode="cover" style={styles.cardImage} />
          ) : (
            <View
              style={[
                styles.cardFallback,
                styles.cardFallbackFill,
                { backgroundColor: ATTR_COLORS[card.attribute] },
              ]}
            />
          )}
          <View style={styles.cardCostBadge}>
            <Text style={styles.cardCostText}>{card.cost}</Text>
          </View>
          {count ? (
            <View style={[styles.cardCountBadge, styles.cardCountBadgeHand]}>
              <Text style={styles.cardCountText}>x{count}</Text>
            </View>
          ) : null}
          <View style={styles.cardHandMeta}>
            <Text style={styles.cardHandName} numberOfLines={2}>
              {card.name}
            </Text>
            <Text style={styles.cardHandType}>
              {card.type === 'unit' && card.unitStats
                ? `${card.unitStats.attack}/${card.unitStats.hp}`
                : 'Action'}
            </Text>
          </View>
          <View style={[styles.cardAttributeStripe, { backgroundColor: ATTR_COLORS[card.attribute] }]} />
        </View>
      </Pressable>
    )
  }

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={240}
      style={[
        styles.cardTile,
        compact ? styles.cardTileCompact : null,
        disabled ? styles.cardTileDisabled : null,
        selected ? styles.cardTileSelected : null,
        { borderLeftColor: ATTR_COLORS[card.attribute] },
      ]}
    >
      <View style={styles.cardVisual}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} resizeMode="cover" style={styles.cardImage} />
        ) : (
          <View style={[styles.cardFallback, { backgroundColor: ATTR_COLORS[card.attribute] }]} />
        )}
        <View style={styles.cardCostBadge}>
          <Text style={styles.cardCostText}>{card.cost}</Text>
        </View>
        {count ? (
          <View style={styles.cardCountBadge}>
            <Text style={styles.cardCountText}>x{count}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={2}>
          {card.name}
        </Text>
        <Text style={styles.cardMeta}>
          {card.type === 'unit' && card.unitStats
            ? `${card.unitStats.attack}/${card.unitStats.hp}`
            : 'Action'}
        </Text>
      </View>
    </Pressable>
  )
}

export function CardDetailModal({
  card,
  onClose,
}: {
  card: CardDefinition | null
  onClose: () => void
}) {
  if (!card) {
    return null
  }

  const imageUri = resolveNativeCardImage(card)

  return (
    <Modal animationType="fade" transparent visible onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalPanel}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{card.name}</Text>
            <Pressable onPress={onClose} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>×</Text>
            </Pressable>
          </View>
          {imageUri ? (
            <Image source={{ uri: imageUri }} resizeMode="cover" style={styles.modalImage} />
          ) : (
            <View style={[styles.modalImage, styles.modalFallbackImage]} />
          )}
          <View style={styles.modalStatsRow}>
            <Chip label={`${card.cost} MP`} color={colors.accent} active />
            <Chip label={ATTR_LABELS[card.attribute]} color={ATTR_COLORS[card.attribute]} active />
            <Chip label={card.rarity === 'legend' ? 'Legend' : 'Normal'} color={colors.borderStrong} active />
          </View>
          {card.unitStats ? (
            <Text style={styles.modalBodyText}>
              ATK {card.unitStats.attack} / HP {card.unitStats.hp}
            </Text>
          ) : null}
          <Text style={styles.modalBodyText}>{card.description || '効果テキストなし'}</Text>
        </View>
      </View>
    </Modal>
  )
}

export function BottomTabs() {
  const { currentScreen, navigate } = useNativeNavigation()

  return (
    <View style={styles.bottomTabs}>
      <BottomTabButton
        label="バトル"
        active={currentScreen.name === 'home' || currentScreen.name === 'deck-select' || currentScreen.name === 'battle' || currentScreen.name === 'matchmaking'}
        onPress={() => navigate({ name: 'home' })}
      />
      <BottomTabButton
        label="カード"
        active={currentScreen.name === 'cards' || currentScreen.name === 'card-list' || currentScreen.name === 'deck-list' || currentScreen.name === 'deck-edit' || currentScreen.name === 'deck-view'}
        onPress={() => navigate({ name: 'cards' })}
      />
    </View>
  )
}

function BottomTabButton({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable onPress={onPress} style={[styles.bottomTabButton, active ? styles.bottomTabActive : null]}>
      <Text style={[styles.bottomTabText, active ? styles.bottomTabTextActive : null]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backSpacer: {
    width: 52,
  },
  backButton: {
    width: 52,
    paddingVertical: spacing.xs,
  },
  backButtonText: {
    color: colors.accentStrong,
    fontWeight: '700',
  },
  headerTextGroup: {
    flex: 1,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  headerSubtitle: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 13,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  fixedContent: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  surface: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#271a06',
    fontWeight: '800',
    fontSize: 16,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 16,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#06101a',
  },
  cardTile: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 5,
    backgroundColor: colors.panelSoft,
  },
  cardTileCompact: {
    minHeight: 82,
  },
  cardTileDisabled: {
    opacity: 0.4,
  },
  cardTileSelected: {
    borderColor: colors.accentStrong,
    backgroundColor: colors.panelElevated,
  },
  cardVisual: {
    width: 60,
    height: 86,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#24364b',
  },
  cardHand: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.panelSoft,
  },
  cardVisualHand: {
    width: 64,
    height: 90,
  },
  cardHandMeta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: 'rgba(5, 11, 18, 0.84)',
  },
  cardHandName: {
    color: colors.text,
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
  },
  cardHandType: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '700',
  },
  cardAttributeStripe: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  cardFallback: {
    flex: 1,
    opacity: 0.85,
  },
  cardFallbackFill: {
    width: '100%',
    height: '100%',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardCostBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    minWidth: 24,
    paddingHorizontal: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center',
  },
  cardCostText: {
    color: colors.accentStrong,
    fontSize: 12,
    fontWeight: '800',
  },
  cardCountBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    borderRadius: 999,
    paddingHorizontal: 6,
    backgroundColor: 'rgba(8,16,26,0.92)',
  },
  cardCountText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  cardCountBadgeHand: {
    top: 6,
    right: 6,
    bottom: 'auto',
  },
  cardInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  cardName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  cardMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalPanel: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 20,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panelSoft,
  },
  modalCloseText: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 24,
  },
  modalImage: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    backgroundColor: colors.backgroundMuted,
  },
  modalFallbackImage: {
    opacity: 0.6,
  },
  modalStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalBodyText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  bottomTabs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  bottomTabButton: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelSoft,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  bottomTabActive: {
    borderColor: colors.accentStrong,
    backgroundColor: colors.panelElevated,
  },
  bottomTabText: {
    color: colors.textMuted,
    fontWeight: '700',
  },
  bottomTabTextActive: {
    color: colors.text,
  },
})
