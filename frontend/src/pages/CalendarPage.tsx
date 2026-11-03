import { useEffect, useState } from 'react'
import { api } from '../utils/api'
import StatusBadge from '../components/StatusBadge'
import { Calendar, Plus, Trash2, ChevronLeft, ChevronRight, Video, Youtube } from 'lucide-react'

interface CalendarEvent {
  id: string
  title: string
  description: string
  event_type: string
  scheduled_date: string
  product_id: string
  video_job_id: string
  shadowcast_job_id?: string
  status: string
  platform: string
  created_at: string
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [showAddForm, setShowAddForm] = useState(false)
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    scheduled_date: '',
    event_type: 'video_publish',
    platform: 'youtube',
  })

  const fetchEvents = async () => {
    setLoading(true)
    try {
      const data = await api.getCalendar(currentMonth, currentYear)
      setEvents(data.events)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchEvents() }, [currentMonth, currentYear])

  const handleAddEvent = async () => {
    if (!newEvent.title || !newEvent.scheduled_date) return
    try {
      await api.createCalendarEvent(newEvent)
      setShowAddForm(false)
      setNewEvent({ title: '', description: '', scheduled_date: '', event_type: 'video_publish', platform: 'youtube' })
      await fetchEvents()
    } catch (e: any) {
      alert(`Failed: ${e.message}`)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this event?')) return
    try {
      await api.deleteCalendarEvent(id)
      await fetchEvents()
    } catch (e: any) {
      alert(`Failed: ${e.message}`)
    }
  }

  const handleMarkPublished = async (id: string) => {
    if (!confirm('Mark published? This calls ShadowCast schedule/publish using the linked job.')) return
    try {
      await api.updateCalendarStatus(id, 'published')
      await fetchEvents()
    } catch (e: any) {
      alert(`Publish failed: ${e.message}`)
    }
  }

  const prevMonth = () => {
    if (currentMonth === 1) { setCurrentMonth(12); setCurrentYear(currentYear - 1) }
    else setCurrentMonth(currentMonth - 1)
  }

  const nextMonth = () => {
    if (currentMonth === 12) { setCurrentMonth(1); setCurrentYear(currentYear + 1) }
    else setCurrentMonth(currentMonth + 1)
  }

  const monthName = new Date(currentYear, currentMonth - 1).toLocaleString('default', { month: 'long' })

  // Build calendar grid
  const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay()
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()
  const calendarDays: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) calendarDays.push(null)
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d)

  const getEventsForDay = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter((e) => e.scheduled_date.startsWith(dateStr))
  }

  const today = new Date()
  const isToday = (day: number) =>
    day === today.getDate() && currentMonth === today.getMonth() + 1 && currentYear === today.getFullYear()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Content Calendar</h1>
          <p className="text-brand-text-dim text-sm mt-1">Plan and track your YouTube video pipeline</p>
        </div>
        <button onClick={() => setShowAddForm(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Event
        </button>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="btn-secondary p-2"><ChevronLeft className="w-5 h-5" /></button>
        <h2 className="text-lg font-bold">{monthName} {currentYear}</h2>
        <button onClick={nextMonth} className="btn-secondary p-2"><ChevronRight className="w-5 h-5" /></button>
      </div>

      {/* Calendar Grid */}
      <div className="card p-0 overflow-hidden">
        <div className="grid grid-cols-7">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-brand-text-dim border-b border-brand-border bg-brand-surface">
              {d}
            </div>
          ))}
          {calendarDays.map((day, i) => {
            const dayEvents = day ? getEventsForDay(day) : []
            return (
              <div
                key={i}
                className={`min-h-[100px] p-1.5 border-b border-r border-brand-border/50 ${
                  day ? 'hover:bg-brand-surface/50' : 'bg-brand-bg/50'
                } ${isToday(day || 0) ? 'bg-brand-accent/5' : ''}`}
              >
                {day && (
                  <>
                    <span className={`text-xs font-medium ${isToday(day) ? 'text-brand-accent font-bold' : 'text-brand-text-dim'}`}>
                      {day}
                    </span>
                    <div className="mt-1 space-y-1">
                      {dayEvents.map((evt) => (
                        <div
                          key={evt.id}
                          className="group flex items-center gap-1 bg-brand-accent/15 text-brand-accent text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer hover:bg-brand-accent/25"
                          title={evt.title}
                        >
                          <Youtube className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{evt.title}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(evt.id) }}
                            className="hidden group-hover:block ml-auto flex-shrink-0"
                          >
                            <Trash2 className="w-3 h-3 text-brand-error" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Upcoming Events List */}
      <div className="card">
        <h3 className="text-sm font-semibold text-brand-text-dim uppercase tracking-wider mb-3">
          Events This Month ({events.length})
        </h3>
        {events.length === 0 ? (
          <p className="text-brand-text-dim text-sm">No events scheduled for {monthName}.</p>
        ) : (
          <div className="space-y-2">
            {events.map((evt) => (
              <div key={evt.id} className="flex items-center justify-between bg-brand-surface rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-accent/15 flex items-center justify-center">
                    <Video className="w-4 h-4 text-brand-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{evt.title}</p>
                    <p className="text-xs text-brand-text-dim">
                      {new Date(evt.scheduled_date).toLocaleDateString()} · {evt.platform}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={evt.status} />
                  {evt.status === 'scheduled' && evt.shadowcast_job_id && (
                    <button
                      onClick={() => handleMarkPublished(evt.id)}
                      className="btn-secondary text-xs"
                      title="Calls ShadowCast schedule/publish"
                    >
                      Mark published
                    </button>
                  )}
                  <button onClick={() => handleDelete(evt.id)} className="p-1.5 rounded hover:bg-brand-card text-brand-text-dim hover:text-brand-error">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Event Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowAddForm(false)}>
          <div className="bg-brand-card border border-brand-border rounded-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Add Calendar Event</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-brand-text-dim font-semibold">Title</label>
                <input
                  className="input-field w-full mt-1"
                  placeholder="Video title..."
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-brand-text-dim font-semibold">Date</label>
                <input
                  type="date"
                  className="input-field w-full mt-1"
                  value={newEvent.scheduled_date}
                  onChange={(e) => setNewEvent({ ...newEvent, scheduled_date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-brand-text-dim font-semibold">Description</label>
                <textarea
                  className="input-field w-full mt-1"
                  rows={2}
                  placeholder="Optional notes..."
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-brand-text-dim font-semibold">Type</label>
                  <select className="input-field w-full mt-1" value={newEvent.event_type} onChange={(e) => setNewEvent({ ...newEvent, event_type: e.target.value })}>
                    <option value="video_publish">Video Publish</option>
                    <option value="video_shoot">Video Shoot</option>
                    <option value="script_deadline">Script Deadline</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-brand-text-dim font-semibold">Platform</label>
                  <select className="input-field w-full mt-1" value={newEvent.platform} onChange={(e) => setNewEvent({ ...newEvent, platform: e.target.value })}>
                    <option value="youtube">YouTube</option>
                    <option value="tiktok">TikTok</option>
                    <option value="instagram">Instagram</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-5">
              <button onClick={handleAddEvent} className="btn-primary flex-1">Add Event</button>
              <button onClick={() => setShowAddForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
