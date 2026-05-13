'use client'

interface Rate {
  currency: string
  buy:      number
  sell:     number
  mid?:     number
  flag:     string
}

interface Props {
  colors:     { primary: string; accent_gold: string }
  rates:      Rate[]
  sourceName: string
  baseCurrency?: string
}

const getFlagUrl = (code: string) => {
  const mapping: Record<string, string> = {
    'GEL': 'ge',
    'USD': 'us',
    'EUR': 'eu',
    'TRY': 'tr',
    'GBP': 'gb',
    'RUB': 'ru',
    'AED': 'ae'
  }
  const country = mapping[code] || code.substring(0, 2).toLowerCase()
  return `https://flagcdn.com/w80/${country}.png`
}

export default function ExchangeSlide({ colors, rates, sourceName, baseCurrency = 'GEL' }: Props) {
  return (
    <div
      className="w-full h-full flex flex-col relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #050508 0%, #080810 100%)' }}
    >
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px]" style={{ background: `${colors.primary}15` }} />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px]" style={{ background: `${colors.accent_gold}10` }} />

      {/* Top bar */}
      <div className="flex items-end justify-between px-20 pt-16 pb-10 z-10">
        <div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: colors.accent_gold, letterSpacing: '0.25em', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>
            Live Exchange Rates
          </div>
          <div style={{ fontFamily: '"Playfair Display", serif', fontSize: 42, color: 'white', fontWeight: 600 }}>
            Base: {baseCurrency}
          </div>
        </div>
        <div className="text-right">
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
            Source: <span style={{ color: 'rgba(255,255,255,0.7)' }}>{sourceName || 'Global Feed'}</span>
          </div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>
            Updated every 60 minutes
          </div>
        </div>
      </div>

      {/* Column headers */}
      <div className="flex items-center px-20 pb-6 z-10" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ flex: 1, fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600 }}>
          Currency
        </div>
        <div style={{ width: 220, textAlign: 'right', fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600 }}>
          Hotel Buys
        </div>
        <div style={{ width: 220, textAlign: 'right', fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600 }}>
          Hotel Sells
        </div>
      </div>

      {/* Rates */}
      <div className="flex-1 flex flex-col justify-center px-20 z-10 py-8">
        {!rates?.length ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-pulse flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10" />
              <div className="text-sm text-white/20 font-medium tracking-widest uppercase">Fetching live rates...</div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {rates.map((rate, i) => (
              <div
                key={rate.currency}
                className="flex items-center py-6 px-6 rounded-2xl transition-all hover:bg-white/[0.02]"
                style={{
                  background: 'rgba(255,255,255,0.01)',
                  border: '1px solid rgba(255,255,255,0.03)',
                }}
              >
                <div className="flex items-center gap-8" style={{ flex: 1 }}>
                  {rate.flag.includes('http') || true ? (
                    <img src={getFlagUrl(rate.currency)} alt={rate.currency} className="w-12 h-8 object-cover rounded shadow-lg shadow-black/40" />
                  ) : (
                    <span style={{ fontSize: 40 }}>{rate.flag}</span>
                  )}
                  <div>
                    <div style={{ fontFamily: '"Playfair Display", serif', fontSize: 34, color: 'white', fontWeight: 500 }}>
                      {rate.currency}
                    </div>
                  </div>
                </div>
                <div style={{ width: 220, textAlign: 'right' }}>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 32, color: colors.primary, fontWeight: 600 }}>
                    {rate.buy.toFixed(4)}
                  </span>
                </div>
                <div style={{ width: 220, textAlign: 'right' }}>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 32, color: 'var(--tcp-amber)', fontWeight: 600 }}>
                    {rate.sell.toFixed(4)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom note */}
      <div className="px-20 pb-12 z-10 flex items-center justify-between">
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>
          * Rates are indicative. Final rates applied at front desk.
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Live Feed Active
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-1 z-20" style={{ background: `linear-gradient(90deg, transparent, ${colors.accent_gold}44, transparent)` }} />
    </div>
  )
}
