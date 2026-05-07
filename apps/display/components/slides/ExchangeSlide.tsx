'use client'

interface Rate {
  currency: string
  buy:      number
  sell:     number
  flag:     string
}

interface Props {
  colors:     { primary: string; accent_gold: string }
  rates:      Rate[]
  sourceName: string
}

const DEFAULT_RATES: Rate[] = [
  { currency: 'USD', buy: 2.65, sell: 2.73, flag: '🇺🇸' },
  { currency: 'EUR', buy: 3.12, sell: 3.22, flag: '🇪🇺' },
  { currency: 'GBP', buy: 3.55, sell: 3.68, flag: '🇬🇧' },
  { currency: 'TRY', buy: 0.082, sell: 0.088, flag: '🇹🇷' },
  { currency: 'RUB', buy: 0.028, sell: 0.033, flag: '🇷🇺' },
]

export default function ExchangeSlide({ colors, rates, sourceName }: Props) {
  const displayRates = rates?.length ? rates : DEFAULT_RATES

  return (
    <div
      className="w-full h-full flex flex-col relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #050508 0%, #080810 100%)' }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-16 pt-12 pb-8">
        <div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: colors.accent_gold, letterSpacing: '0.2em', fontWeight: 600, textTransform: 'uppercase' }}>
            Exchange Rates
          </div>
          <div style={{ fontFamily: '"Playfair Display", serif', fontSize: 28, color: 'white', marginTop: 4 }}>
            Georgian Lari (GEL)
          </div>
        </div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
          {sourceName || 'National Bank of Georgia'}
        </div>
      </div>

      {/* Column headers */}
      <div className="flex items-center px-16 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ flex: 1, fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          Currency
        </div>
        <div style={{ width: 200, textAlign: 'right', fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          Buy
        </div>
        <div style={{ width: 200, textAlign: 'right', fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          Sell
        </div>
      </div>

      {/* Rates */}
      <div className="flex-1 flex flex-col justify-center px-16">
        {displayRates.map((rate, i) => (
          <div
            key={rate.currency}
            className="flex items-center py-5"
            style={{
              borderBottom: i < displayRates.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            }}
          >
            <div className="flex items-center gap-5" style={{ flex: 1 }}>
              <span style={{ fontSize: 32 }}>{rate.flag}</span>
              <div>
                <div style={{ fontFamily: '"Playfair Display", serif', fontSize: 28, color: 'white', fontWeight: 500 }}>
                  {rate.currency}
                </div>
              </div>
            </div>
            <div style={{ width: 200, textAlign: 'right' }}>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 26, color: colors.primary, fontWeight: 500 }}>
                {rate.buy.toFixed(3)}
              </span>
            </div>
            <div style={{ width: 200, textAlign: 'right' }}>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 26, color: 'var(--tcp-amber)', fontWeight: 500 }}>
                {rate.sell.toFixed(3)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom note */}
      <div className="px-16 pb-8" style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>
        Rates are indicative. For accurate rates please enquire at the front desk.
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: `linear-gradient(90deg, transparent, ${colors.accent_gold}88, transparent)` }} />
    </div>
  )
}
