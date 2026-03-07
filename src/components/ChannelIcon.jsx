const ICONS = {
  discord: { color: 'text-purple-400', symbol: '#' },
  telegram: { color: 'text-blue-400', symbol: '✈' },
  cron: { color: 'text-amber-400', symbol: '⏰' },
  direct: { color: 'text-slate-400', symbol: '›' },
  other: { color: 'text-slate-500', symbol: '·' },
};

export default function ChannelIcon({ channel }) {
  const { color, symbol } = ICONS[channel] || ICONS.other;
  return <span className={`${color} text-[11px] font-bold leading-none`}>{symbol}</span>;
}
