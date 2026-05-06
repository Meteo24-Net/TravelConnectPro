// Shared placeholder for tabs not yet implemented

interface Props {
  title:    string
  subtitle: string
  icon:     string
}

export default function ComingSoon({ title, subtitle, icon }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-bold" style={{ fontSize: 22 }}>{title}</h1>
        <p className="text-secondary" style={{ fontSize: 13, marginTop: 2 }}>{subtitle}</p>
      </div>

      <div className="section-card">
        <div className="section-body">
          <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <span style={{ fontSize: 48 }}>{icon}</span>
            <div>
              <div className="font-semibold text-primary mb-1">{title} — coming next</div>
              <div className="text-sm text-secondary max-w-sm">
                This section is in the prototype. The live implementation is being built
                from <code className="font-mono text-xs bg-panel-2 px-1 rounded">admin-v1_4.html</code>.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
