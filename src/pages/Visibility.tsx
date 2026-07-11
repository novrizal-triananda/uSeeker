import { useState, useEffect } from 'react';
import { db } from '../lib/db';
import { addApplication, updateStatus, getOutcome, getPipelineStats } from '../lib/pipeline';
import { logEvent } from '../lib/eventLog';
import type { Application, ApplicationStatus, ApplicationOutcome, PipelineStats, JobEntry } from '../types';

const PIPELINE_STAGES: { key: ApplicationStatus; label: string; icon: string }[] = [
  { key: 'applied', label: 'Applied', icon: '📨' },
  { key: 'screen', label: 'Screen', icon: '🔍' },
  { key: 'interview', label: 'Interview', icon: '🎤' },
  { key: 'offer', label: 'Offer', icon: '🎉' },
];

const OUTCOMES: { key: ApplicationOutcome; label: string; icon: string }[] = [
  { key: 'accepted', label: 'Accepted', icon: '✅' },
  { key: 'rejected', label: 'Rejected', icon: '❌' },
  { key: 'ghosted', label: 'Ghosted', icon: '👻' },
  { key: 'withdrawn', label: 'Withdrawn', icon: '🏳️' },
];

const STAGE_COLORS: Record<ApplicationStatus, string> = {
  applied: 'var(--color-status-blue)',
  screen: 'var(--color-status-amber)',
  interview: '#7C3AED',
  offer: 'var(--color-status-green)',
};

interface FormData {
  jobId: string;
  status: ApplicationStatus;
  notes: string;
}

const emptyForm: FormData = { jobId: '', status: 'applied', notes: '' };

export default function Visibility() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<JobEntry[]>([]);
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    try {
      const [apps, allJobs] = await Promise.all([
        db.applications.toArray(),
        db.jobEntries.toArray(),
      ]);
      const sorted = apps.sort(
        (a, b) => new Date(b.dateApplied).getTime() - new Date(a.dateApplied).getTime()
      );
      setApplications(sorted);
      setJobs(allJobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
      setStats(getPipelineStats(sorted));
    } catch {
      setApplications([]);
      setJobs([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.jobId) return;

    setSubmitting(true);
    try {
      const selectedJob = jobs.find(j => j.id === form.jobId);
      if (!selectedJob) return;

      await addApplication({
        jobId: selectedJob.id,
        company: selectedJob.company,
        roleTitle: selectedJob.roleTitle,
        status: form.status,
        notes: form.notes.trim() || undefined,
      });

      await logEvent('add_application', { jobId: selectedJob.id, company: selectedJob.company });
      setForm(emptyForm);
      setShowForm(false);
      await loadData();
    } catch {
      alert('Gagal menambahkan lamaran.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(id: string, newStatus: ApplicationStatus) {
    try {
      await updateStatus(id, newStatus);
      await logEvent('update_status', { applicationId: id, status: newStatus });
      await loadData();
    } catch {
      alert('Gagal memperbarui status.');
    }
  }

  async function handleOutcomeChange(id: string, outcome: ApplicationOutcome | undefined) {
    try {
      await getOutcome(id, outcome);
      await logEvent('update_status', { applicationId: id, outcome: outcome ?? null });
      await loadData();
    } catch {
      alert('Gagal memperbarui outcome.');
    }
  }

  async function handleDeleteApp(id: string) {
    if (!confirm('Hapus lamaran ini?')) return;
    await db.applications.delete(id);
    await loadData();
  }

  if (loading) {
    return (
      <div className="loading-state" style={styles.container}>
        <div className="loading-spinner" />
        <p>Memuat pipeline...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.heading}>Pipeline Lamaran</h2>
          <p style={styles.subtitle}>Pantau progres setiap lamaran kerja.</p>
        </div>
        <button style={styles.addButton} onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Tutup' : '＋ Tambah Lamaran'}
        </button>
      </div>

      {/* Add Application Form */}
      {showForm && (
        <form onSubmit={handleAdd} style={styles.form}>
          {jobs.length === 0 ? (
            <div style={{ padding: 'var(--space-4)', background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-warning-text)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-4)' }}>
              ⚠️ Belum ada lowongan. Tambah lowongan melalui tab <strong>Triage</strong> terlebih dahulu.
            </div>
          ) : (
            <div style={styles.formGrid}>
              <div style={styles.formField}>
                <label style={styles.label}>Pilih Lowongan *</label>
                <select
                  value={form.jobId}
                  onChange={(e) => setForm({ ...form, jobId: e.target.value })}
                  style={styles.select}
                  required
                >
                  <option value="">— Pilih lowongan dari Triage —</option>
                  {jobs.map(job => (
                    <option key={job.id} value={job.id}>{job.company} — {job.roleTitle}</option>
                  ))}
                </select>
              </div>
              <div style={styles.formField}>
                <label style={styles.label}>Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as ApplicationStatus })}
                  style={styles.select}
                >
                  {PIPELINE_STAGES.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div style={styles.formField}>
                <label style={styles.label}>Catatan</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Catatan opsional..."
                  style={styles.input}
                />
              </div>
            </div>
          )}
          <button
            type="submit"
            style={styles.submitButton}
            disabled={submitting || !form.jobId}
          >
            {submitting ? 'Menyimpan...' : '💾 Simpan Lamaran'}
          </button>
        </form>
      )}

      {/* Pipeline Stats */}
      {stats && stats.total > 0 && (
        <div style={styles.statsBar}>
          <div style={styles.statItem}>
            <span style={styles.statValue}>{stats.total}</span>
            <span style={styles.statLabel}>Total</span>
          </div>
          {PIPELINE_STAGES.map((stage) => (
            <div key={stage.key} style={styles.statItem}>
              <span style={{ ...styles.statValue, color: STAGE_COLORS[stage.key] }}>
                {stats.byStatus[stage.key]}
              </span>
              <span style={styles.statLabel}>{stage.label}</span>
            </div>
          ))}
          <div style={styles.statItem}>
            <span style={styles.statValue}>{stats.responseRate}%</span>
            <span style={styles.statLabel}>Response Rate</span>
          </div>
        </div>
      )}

      {/* Pipeline Board */}
      {applications.length === 0 ? (
        <div style={styles.emptyState}>
          <span style={styles.emptyIcon} aria-hidden="true">📋</span>
          <p style={styles.emptyTitle}>Belum ada lamaran</p>
          <p style={styles.emptyDesc}>
            Tambahkan lamaran pertama Anda untuk mulai memantau pipeline.
          </p>
        </div>
      ) : (
        <div style={styles.board}>
          {PIPELINE_STAGES.map((stage) => {
            const stageApps = applications.filter((a) => a.status === stage.key);
            return (
              <div key={stage.key} style={styles.column}>
                <div style={styles.columnHeader}>
                  <span style={styles.columnIcon}>{stage.icon}</span>
                  <span style={styles.columnTitle}>{stage.label}</span>
                  <span style={{
                    ...styles.columnCount,
                    backgroundColor: STAGE_COLORS[stage.key],
                  }}>
                    {stageApps.length}
                  </span>
                </div>
                <div style={styles.columnCards}>
                  {stageApps.length === 0 ? (
                    <p style={styles.noCards}>Kosong</p>
                  ) : (
                    stageApps.map((app) => {
                        const job = jobs.find(j => j.id === app.jobId);
                        return (
                        <div key={app.id} style={styles.card}>
                          <div style={styles.cardHeader}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={styles.cardCompany}>{app.company}</div>
                              <div style={styles.cardRole}>{app.roleTitle}</div>
                              {(job?.location || job?.salaryRange || job?.employmentType) && (
                                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-1)', flexWrap: 'wrap' }}>
                                  {job.location && (
                                    <span style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                                      📍 {job.location}
                                    </span>
                                  )}
                                  {job.salaryRange && (
                                    <span style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                                      💰 {job.salaryRange}
                                    </span>
                                  )}
                                  {job.employmentType && (
                                    <span style={{ fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                                      📄 {job.employmentType}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => handleDeleteApp(app.id)}
                              style={styles.deleteBtn}
                              title="Hapus lamaran"
                            >✕</button>
                          </div>
                          {app.notes && (
                            <div style={styles.cardNotes}>{app.notes}</div>
                          )}
                          <div style={styles.cardMeta}>
                            <time style={styles.cardDate}>
                              {new Date(app.dateApplied).toLocaleDateString('id-ID', {
                                day: 'numeric', month: 'short', year: 'numeric',
                              })}
                            </time>
                            {app.outcome && (
                              <span style={{
                                padding: '1px 6px', borderRadius: 'var(--radius-sm)',
                                fontSize: '0.65rem', fontWeight: 600,
                                background: app.outcome === 'accepted' ? 'var(--color-success-bg)' : app.outcome === 'rejected' ? 'var(--color-error-bg)' : app.outcome === 'ghosted' ? 'var(--color-bg)' : 'var(--color-warning-bg)',
                                color: app.outcome === 'accepted' ? 'var(--color-success-text)' : app.outcome === 'rejected' ? 'var(--color-error-text)' : app.outcome === 'ghosted' ? '#6B7280' : 'var(--color-warning-text)',
                              }}>
                                {OUTCOMES.find(o => o.key === app.outcome)?.icon} {app.outcome}
                              </span>
                            )}
                          </div>
                          <div style={styles.cardControls}>
                            <select
                              value={app.status}
                              onChange={(e) => handleStatusChange(app.id, e.target.value as ApplicationStatus)}
                              style={styles.statusSelect}
                            >
                              {PIPELINE_STAGES.map((s) => (
                                <option key={s.key} value={s.key}>{s.label}</option>
                              ))}
                            </select>
                            <select
                              value={app.outcome || ''}
                              onChange={(e) => {
                                const val = e.target.value as ApplicationOutcome | '';
                                handleOutcomeChange(app.id, val || undefined);
                              }}
                              style={styles.statusSelect}
                            >
                              <option value="">Outcome...</option>
                              {OUTCOMES.map((o) => (
                                <option key={o.key} value={o.key}>{o.icon} {o.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                      })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 'var(--space-6)',
    maxWidth: 1100,
    margin: '0 auto',
  },
  loading: {
    textAlign: 'center',
    color: 'var(--color-text-muted)',
    padding: 'var(--space-12)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 'var(--space-4)',
    marginBottom: 'var(--space-6)',
    flexWrap: 'wrap',
  },
  heading: {
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 700,
    marginBottom: 'var(--space-1)',
  },
  subtitle: {
    color: 'var(--color-text-muted)',
    fontSize: 'var(--font-size-sm)',
  },
  addButton: {
    padding: 'var(--space-3) var(--space-5)',
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-surface)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: 'var(--font-size-sm)',
    whiteSpace: 'nowrap',
  },

  /* Form */
  form: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-6)',
    marginBottom: 'var(--space-6)',
    boxShadow: 'var(--shadow-sm)',
    border: '1px solid var(--color-border)',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 'var(--space-4)',
    marginBottom: 'var(--space-4)',
  },
  formField: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-1)',
  },
  label: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 500,
    color: 'var(--color-text)',
  },
  input: {
    padding: 'var(--space-2) var(--space-3)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--font-size-sm)',
    backgroundColor: 'var(--color-bg)',
    color: 'var(--color-text)',
  },
  select: {
    padding: 'var(--space-2) var(--space-3)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--font-size-sm)',
    backgroundColor: 'var(--color-input-bg)',
    color: 'var(--color-text)',
  },
  submitButton: {
    padding: 'var(--space-3) var(--space-5)',
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-surface)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: 'var(--font-size-sm)',
  },

  /* Stats */
  statsBar: {
    display: 'flex',
    gap: 'var(--space-4)',
    flexWrap: 'wrap',
    marginBottom: 'var(--space-6)',
    padding: 'var(--space-4)',
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-sm)',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: 60,
  },
  statValue: {
    fontSize: 'var(--font-size-xl)',
    fontWeight: 700,
  },
  statLabel: {
    fontSize: '0.7rem',
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },

  /* Empty State */
  emptyState: {
    textAlign: 'center',
    padding: 'var(--space-12) var(--space-6)',
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-sm)',
  },
  emptyIcon: {
    fontSize: '3rem',
    display: 'block',
    marginBottom: 'var(--space-4)',
  },
  emptyTitle: {
    fontSize: 'var(--font-size-xl)',
    fontWeight: 600,
    marginBottom: 'var(--space-2)',
  },
  emptyDesc: {
    color: 'var(--color-text-muted)',
    marginBottom: 'var(--space-6)',
  },
  ctaButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: 'var(--space-3) var(--space-5)',
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-surface)',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: 'var(--font-size-sm)',
  },

  /* Board */
  board: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 'var(--space-3)',
    overflowX: 'auto',
  },
  column: {
    minWidth: 160,
  },
  columnHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: 'var(--space-3)',
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
    borderBottom: '2px solid var(--color-border)',
  },
  columnIcon: {
    fontSize: '1rem',
  },
  columnTitle: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
    flex: 1,
  },
  columnCount: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    borderRadius: '50%',
    color: 'var(--color-surface)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 700,
  },
  columnCards: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-2)',
    padding: 'var(--space-2)',
    minHeight: 80,
    backgroundColor: 'var(--color-bg)',
    borderRadius: '0 0 var(--radius-md) var(--radius-md)',
  },
  noCards: {
    textAlign: 'center',
    color: 'var(--color-text-muted)',
    fontSize: 'var(--font-size-sm)',
    padding: 'var(--space-4)',
  },
  card: {
    padding: 'var(--space-3)',
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-sm)',
    border: '1px solid var(--color-border)',
    overflow: 'hidden',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 'var(--space-2)',
    marginBottom: 'var(--space-1)',
  },
  cardCompany: {
    fontWeight: 600,
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text)',
    lineHeight: 1.3,
  },
  cardRole: {
    fontSize: '0.75rem',
    color: 'var(--color-text-muted)',
    lineHeight: 1.3,
  },
  cardNotes: {
    fontSize: '0.7rem',
    color: 'var(--color-text-muted)',
    fontStyle: 'italic',
    marginBottom: 'var(--space-1)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    marginBottom: 'var(--space-2)',
    flexWrap: 'wrap',
  },
  cardDate: {
    fontSize: '0.65rem',
    color: 'var(--color-text-muted)',
  },
  cardControls: {
    display: 'flex',
    gap: 'var(--space-1)',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--color-text-muted)',
    cursor: 'pointer',
    fontSize: '0.7rem',
    padding: '2px 4px',
    borderRadius: 'var(--radius-sm)',
    lineHeight: 1,
    flexShrink: 0,
  },
  statusSelect: {
    fontSize: '0.65rem',
    padding: '2px 4px',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--color-input-bg)',
    color: 'var(--color-text)',
    cursor: 'pointer',
    flex: 1,
    minWidth: 0,
  },
};
