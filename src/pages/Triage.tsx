import { useState, useEffect } from 'react';
import { db } from '../lib/db';
import { generateFitScore } from '../lib/fitScoring';
import type { JobEntry, MasterResume, FitScore } from '../types';

interface JobWithScore {
  job: JobEntry;
  fitScore: FitScore | null;
}

export default function Triage() {
  const [jobs, setJobs] = useState<JobWithScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [jobEntries, fitScores] = await Promise.all([
          db.jobEntries.toArray(),
          db.fitScores.toArray(),
        ]);

        const scoresByJob = new Map<string, FitScore>();
        for (const score of fitScores) {
          scoresByJob.set(score.jobId, score);
        }

        const jobList: JobWithScore[] = jobEntries
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((job) => ({
            job,
            fitScore: scoresByJob.get(job.id) || null,
          }));

        setJobs(jobList);
      } catch {
        setJobs([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleGenerateScore(jobId: string) {
    setGeneratingId(jobId);
    try {
      const masterResume = await db.masterResume.toCollection().first();
      if (!masterResume) {
        alert('Silakan impor CV terlebih dahulu.');
        return;
      }

      const job = await db.jobEntries.get(jobId);
      if (!job) return;

      const fitScore = generateFitScore(
        masterResume,
        job.jobDescription,
        jobId,
        job.expectedSalary,
        job.salaryRange,
      );

      await db.fitScores.put(fitScore);

      setJobs((prev) =>
        prev.map((item) =>
          item.job.id === jobId ? { ...item, fitScore } : item
        )
      );

      if (selectedJobId === jobId) {
        setSelectedJobId(null);
        setTimeout(() => setSelectedJobId(jobId), 0);
      }
    } catch {
      alert('Gagal menghitung skor. Pastikan CV sudah diimpor.');
    } finally {
      setGeneratingId(null);
    }
  }

  function getScoreColor(score: number): string {
    if (score >= 70) return 'var(--color-status-green)';
    if (score >= 40) return 'var(--color-status-amber)';
    return 'var(--color-status-red)';
  }

  const selectedJob = selectedJobId ? jobs.find((j) => j.job.id === selectedJobId) : null;

  if (loading) {
    return (
      <div style={styles.container}>
        <p style={styles.loading}>Memuat data pekerjaan...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Triage Pekerjaan</h2>
      <p style={styles.subtitle}>Lihat skor kesesuaian untuk setiap lowongan.</p>

      {jobs.length === 0 ? (
        <div style={styles.emptyState}>
          <span style={styles.emptyIcon} aria-hidden="true">💼</span>
          <p style={styles.emptyTitle}>Belum ada pekerjaan</p>
          <p style={styles.emptyDesc}>
            Tambahkan pekerjaan terlebih dahulu untuk melihat skor triage.
          </p>
          <a href="#layer-2" style={styles.ctaButton}>
            💼 Tambah Pekerjaan
          </a>
        </div>
      ) : (
        <div style={styles.content}>
          {/* Job List */}
          <div style={styles.jobList}>
            {jobs.map((item) => (
              <button
                key={item.job.id}
                style={{
                  ...styles.jobCard,
                  ...(selectedJobId === item.job.id ? styles.jobCardActive : {}),
                }}
                onClick={() => setSelectedJobId(
                  selectedJobId === item.job.id ? null : item.job.id
                )}
              >
                <div style={styles.jobInfo}>
                  <div style={styles.jobTitle}>{item.job.roleTitle}</div>
                  <div style={styles.jobCompany}>{item.job.company}</div>
                </div>
                <div style={styles.jobScoreArea}>
                  {item.fitScore ? (
                    <div style={{
                      ...styles.scoreBadge,
                      backgroundColor: getScoreColor(item.fitScore.overallScore),
                    }}>
                      {item.fitScore.overallScore}%
                    </div>
                  ) : (
                    <button
                      style={styles.generateBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGenerateScore(item.job.id);
                      }}
                      disabled={generatingId === item.job.id}
                    >
                      {generatingId === item.job.id ? '...' : 'Hitung'}
                    </button>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Fit Score Breakdown */}
          {selectedJob && selectedJob.fitScore && (
            <div style={styles.breakdown}>
              <h3 style={styles.breakdownTitle}>Rincian Skor</h3>
              <p style={styles.breakdownJob}>
                {selectedJob.job.roleTitle} — {selectedJob.job.company}
              </p>

              {/* Score bars */}
              <div style={styles.scoreBars}>
                <ScoreBar label="Kecocokan Skill" value={selectedJob.fitScore.skillMatch} />
                <ScoreBar label="Kecocokan Pengalaman" value={selectedJob.fitScore.experienceMatch} />
                <ScoreBar label="Kecocokan Preferensi" value={selectedJob.fitScore.preferenceMatch} />
                <ScoreBar label="Skor Keseluruhan" value={selectedJob.fitScore.overallScore} highlight />
              </div>

              {/* Matched & Missing Skills */}
              <div style={styles.skillsSection}>
                {selectedJob.fitScore.matchedSkills.length > 0 && (
                  <div>
                    <h4 style={styles.skillsTitle}>✅ Skill yang Cocok</h4>
                    <div style={styles.skillTags}>
                      {selectedJob.fitScore.matchedSkills.map((skill) => (
                        <span key={skill} style={styles.skillTagGreen}>{skill}</span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedJob.fitScore.missingSkills.length > 0 && (
                  <div style={{ marginTop: 'var(--space-4)' }}>
                    <h4 style={styles.skillsTitle}>❌ Skill yang Kurang</h4>
                    <div style={styles.skillTags}>
                      {selectedJob.fitScore.missingSkills.map((skill) => (
                        <span key={skill} style={styles.skillTagRed}>{skill}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Recalculate button */}
              <button
                style={styles.recalcButton}
                onClick={() => handleGenerateScore(selectedJob.job.id)}
                disabled={generatingId === selectedJob.job.id}
              >
                {generatingId === selectedJob.job.id ? 'Menghitung...' : '🔄 Hitung Ulang Skor'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreBar({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  const barColor = highlight
    ? value >= 70 ? 'var(--color-status-green)' : value >= 40 ? 'var(--color-status-amber)' : 'var(--color-status-red)'
    : 'var(--color-primary)';

  return (
    <div style={styles.scoreBar}>
      <div style={styles.scoreBarHeader}>
        <span style={{
          ...styles.scoreBarLabel,
          fontWeight: highlight ? 600 : 400,
        }}>{label}</span>
        <span style={styles.scoreBarValue}>{value}%</span>
      </div>
      <div style={styles.scoreBarTrack}>
        <div style={{
          ...styles.scoreBarFill,
          width: `${value}%`,
          backgroundColor: barColor,
        }} />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 'var(--space-6)',
    maxWidth: 900,
    margin: '0 auto',
  },
  loading: {
    textAlign: 'center',
    color: 'var(--color-text-muted)',
    padding: 'var(--space-12)',
  },
  heading: {
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 700,
    marginBottom: 'var(--space-2)',
  },
  subtitle: {
    color: 'var(--color-text-muted)',
    marginBottom: 'var(--space-6)',
  },
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
    color: '#FFFFFF',
    borderRadius: 'var(--radius-md)',
    textDecoration: 'none',
    fontWeight: 500,
    fontSize: 'var(--font-size-sm)',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-6)',
  },
  jobList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-2)',
  },
  jobCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--space-4) var(--space-5)',
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    transition: 'border-color 0.15s',
    boxShadow: 'var(--shadow-sm)',
  },
  jobCardActive: {
    borderColor: 'var(--color-primary)',
    boxShadow: '0 0 0 2px rgba(37, 99, 235, 0.15)',
  },
  jobInfo: {
    flex: 1,
  },
  jobTitle: {
    fontWeight: 600,
    fontSize: 'var(--font-size-base)',
    color: 'var(--color-text)',
  },
  jobCompany: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--color-text-muted)',
    marginTop: 'var(--space-1)',
  },
  jobScoreArea: {
    marginLeft: 'var(--space-4)',
  },
  scoreBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--space-1) var(--space-3)',
    borderRadius: 'var(--radius-sm)',
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: 'var(--font-size-sm)',
    minWidth: 48,
  },
  generateBtn: {
    padding: 'var(--space-2) var(--space-4)',
    backgroundColor: 'var(--color-primary)',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: 'var(--font-size-sm)',
  },
  breakdown: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-6)',
    boxShadow: 'var(--shadow-sm)',
    border: '1px solid var(--color-border)',
  },
  breakdownTitle: {
    fontSize: 'var(--font-size-xl)',
    fontWeight: 600,
    marginBottom: 'var(--space-1)',
  },
  breakdownJob: {
    color: 'var(--color-text-muted)',
    fontSize: 'var(--font-size-sm)',
    marginBottom: 'var(--space-6)',
  },
  scoreBars: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-4)',
    marginBottom: 'var(--space-6)',
  },
  scoreBar: {
    width: '100%',
  },
  scoreBarHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 'var(--space-1)',
  },
  scoreBarLabel: {
    fontSize: 'var(--font-size-sm)',
  },
  scoreBarValue: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
  },
  scoreBarTrack: {
    width: '100%',
    height: 8,
    backgroundColor: 'var(--color-bg)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 4,
    transition: 'width 0.3s ease',
  },
  skillsSection: {
    marginBottom: 'var(--space-4)',
  },
  skillsTitle: {
    fontSize: 'var(--font-size-sm)',
    fontWeight: 600,
    marginBottom: 'var(--space-2)',
  },
  skillTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'var(--space-2)',
  },
  skillTagGreen: {
    display: 'inline-block',
    padding: '2px 10px',
    backgroundColor: '#DCFCE7',
    color: 'var(--color-status-green)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 500,
  },
  skillTagRed: {
    display: 'inline-block',
    padding: '2px 10px',
    backgroundColor: '#FEE2E2',
    color: 'var(--color-status-red)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 500,
  },
  recalcButton: {
    padding: 'var(--space-2) var(--space-4)',
    backgroundColor: 'transparent',
    color: 'var(--color-primary)',
    border: '1px solid var(--color-primary)',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: 'var(--font-size-sm)',
  },
};
