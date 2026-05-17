import type { CSSProperties } from 'react'

export type GameIconName =
  | 'mission'
  | 'notice'
  | 'gift'
  | 'rank'
  | 'settings'
  | 'signal'
  | 'battery'
  | 'colosseum'
  | 'battle'
  | 'cards'
  | 'channel'
  | 'archive'
  | 'deck'
  | 'inspect'
  | 'trash'
  | 'skin'
  | 'attr-red'
  | 'attr-green'
  | 'attr-purple'
  | 'attr-black'
  | 'attack'
  | 'hp'
  | 'shield'
  | 'timer'
  | 'rotate-phone'
  | 'rush'
  | 'flight'
  | 'agility'
  | 'mp-boost'
  | 'veil'
  | 'combo'
  | 'heavy-pierce'
  | 'anti-air'
  | 'revenge'

const GAME_ICON_SRC: Record<GameIconName, string> = {
  mission: '/images/ui/ui-mission.png',
  notice: '/images/ui/ui-notice.png',
  gift: '/images/ui/ui-gift.png',
  rank: '/images/ui/ui-rank.png',
  settings: '/images/ui/ui-settings.png',
  signal: '/images/ui/ui-signal.png',
  battery: '/images/ui/ui-battery.png',
  colosseum: '/images/ui/ui-colosseum.png',
  battle: '/images/ui/ui-battle.png',
  cards: '/images/ui/ui-cards.png',
  channel: '/images/ui/ui-channel.png',
  archive: '/images/ui/ui-archive.png',
  deck: '/images/ui/ui-deck.png',
  inspect: '/images/ui/ui-inspect.png',
  trash: '/images/ui/ui-trash.png',
  skin: '/images/ui/ui-skin.png',
  'attr-red': '/images/ui/ui-attr-red.png',
  'attr-green': '/images/ui/ui-attr-green.png',
  'attr-purple': '/images/ui/ui-attr-purple.png',
  'attr-black': '/images/ui/ui-attr-black.png',
  attack: '/images/ui/ui-attack.png',
  hp: '/images/ui/ui-hp.png',
  shield: '/images/ui/ui-shield.png',
  timer: '/images/ui/ui-timer.png',
  'rotate-phone': '/images/ui/ui-rotate-phone.png',
  rush: '/images/effects/effect-rush.png',
  flight: '/images/effects/effect-flight.png',
  agility: '/images/effects/effect-agility.png',
  'mp-boost': '/images/effects/effect-mp-boost.png',
  veil: '/images/effects/effect-veil.png',
  combo: '/images/effects/effect-combo.png',
  'heavy-pierce': '/images/effects/effect-heavy-pierce.png',
  'anti-air': '/images/effects/effect-anti-air.png',
  revenge: '/images/effects/effect-revenge.png',
}

interface GameIconProps {
  name: GameIconName
  className?: string
  title?: string
  ariaLabel?: string
  decorative?: boolean
  style?: CSSProperties
}

export default function GameIcon({
  name,
  className,
  title,
  ariaLabel,
  decorative = true,
  style,
}: GameIconProps) {
  const alt = decorative ? '' : ariaLabel || title || name

  return (
    <img
      src={GAME_ICON_SRC[name]}
      alt={alt}
      aria-hidden={decorative ? true : undefined}
      title={title}
      className={`inline-block select-none object-contain ${className || ''}`}
      draggable={false}
      style={style}
    />
  )
}
