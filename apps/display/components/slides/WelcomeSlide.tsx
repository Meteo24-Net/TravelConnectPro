'use client'

interface Props {
  hotelName:   string
  greeting:    string
  subtext:     string
  highlight:   string
  logoUrl:     string | null
  colors:      { primary: string; accent_gold: string; background: string }
  timeOfDay:   'morning' | 'afternoon' | 'evening' | 'night'
}

const GREETING_DEFAULTS = {
  morning:   'Good morning',
  afternoon: 'Good afternoon',
  evening:   'Good evening',
  night:     'Good night',
}

export default function WelcomeSlide({ hotelName, greeting, subtext, highlight, logoUrl, colors, timeOfDay }: Props) {
  const displayGreeting = greeting || GREETING_DEFAULTS[timeOfDay]

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden bg-transparent">
      
      {/* Decorative center logo / brand */}
      <div className="flex flex-col items-center text-center px-12">
        {logoUrl && (
          <img src={logoUrl} className="h-24 object-contain brightness-0 invert mb-12" alt="Logo" />
        )}
        
        <div className="flex items-center gap-6 mb-8 opacity-50">
          <div className="h-[1px] w-16 bg-gradient-to-r from-transparent to-[#c5a059]" />
          <div className="w-2 h-2 bg-[#c5a059] rotate-45" />
          <div className="h-[1px] w-16 bg-gradient-to-l from-transparent to-[#c5a059]" />
        </div>

        <h1 className="text-8xl font-serif text-white leading-tight mb-6 drop-shadow-2xl">
          {displayGreeting}
        </h1>

        <p className="text-2xl font-light text-white/50 tracking-wide max-w-2xl leading-relaxed">
          {subtext}
        </p>

        {/* Highlight offer box */}
        {highlight && (
          <div className="mt-16 glass-panel px-12 py-6 rounded-3xl border-2 border-[#c5a059]/40 bg-[#c5a059]/10">
            <div className="text-[10px] font-black text-[#c5a059] uppercase tracking-[0.4em] mb-3">Today's Highlight</div>
            <div className="text-2xl font-serif text-white italic">"{highlight}"</div>
          </div>
        )}
      </div>

    </div>
  )
}
