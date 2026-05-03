interface CardProps {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-4 ${className}`}>
      {children}
    </div>
  )
}

export function AlertCard({ children, type = 'warning' }: { children: React.ReactNode; type?: 'warning' | 'danger' | 'info' | 'success' }) {
  const styles = {
    warning: 'bg-amber-50 border-amber-300 text-amber-800',
    danger:  'bg-red-50 border-red-300 text-red-800',
    info:    'bg-sky-50 border-sky-300 text-sky-800',
    success: 'bg-green-50 border-green-300 text-green-800',
  }
  return (
    <div className={`rounded-2xl border-2 p-4 ${styles[type]}`}>
      {children}
    </div>
  )
}
