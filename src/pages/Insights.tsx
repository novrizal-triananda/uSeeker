import { useState, useEffect } from 'react';
import { db } from '../lib/db';
import {
  getOutcomeDistribution,
  getStageBocor,
  getSkillGapFrequency,
  getSampleWarning,
  getLearningPoints,
  getLocationInsights,
  getEmploymentTypeInsights,
  getFitScoreInsights,
  getJobSearchHealth,
} from '../lib/insights';
import type { Application, FitScore, JobEntry } from '../types';
import type { OutcomeDistribution, StageBocor, SkillGapEntry, LearningPoint, LocationInsight, EmploymentTypeInsight, FitScoreInsight } from '../lib/insights';

export default function Insights() {
  const [, setApplications] = useState<Application[]>([]);
  const [, setFitScores] = useState<FitScore[]>([]);
  const [, setJobs] = useState<JobEntry[]>([]);
  const [distribution, setDistribution] = useState<OutcomeDistribution>({ accepted: 0, rejected: 0, ghosted: 0, withdrawn: 0 });
  const [stageBocor, setStageBocor] = useState<StageBocor | null>(null);
  const [skillGaps, setSkillGaps] = useState<SkillGapEntry[]>([]);
  const [learningPoints, setLearningPoints] = useState<LearningPoint[]>([]);
  const [sampleWarning, setSampleWarning] = useState<string | null>(null);
  const [locationInsights, setLocationInsights] = useState<LocationInsight[]>([]);
  const [employmentInsights, setEmploymentInsights] = useState<EmploymentTypeInsight[]>([]);
  const [fitScoreInsights, setFitScoreInsights] = useState<FitScoreInsight[]>([]);
  const [healthScore, setHealthScore] = useState<{ score: number; factors: { name: string; score: number; weight: number }[] } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [apps, scores, allJobs] = await Promise.all([
      db.applications.toArray(),
      db.fitScores.toArray(),
      db.jobEntries.toArray(),
    ]);
    setApplications(apps);
    setFitScores(scores);
    setJobs(allJobs);

    setDistribution(getOutcomeDistribution(apps));
    setStageBocor(getStageBocor(apps));
    setSkillGaps(getSkillGapFrequency(apps, scores));
    setLearningPoints(getLearningPoints(apps));
    setLocationInsights(getLocationInsights(apps, allJobs));
    setEmploymentInsights(getEmploymentTypeInsights(apps, allJobs));
    setFitScoreInsights(getFitScoreInsights(apps, scores));
    setHealthScore(getJobSearchHealth(apps, scores));

    const warning = getSampleWarning(apps);
    setSampleWarning(warning ? warning.message : null);
  }

  const totalOutcomes = distribution.accepted + distribution.rejected + distribution.ghosted + distribution.withdrawn;
  const hasData = totalOutcomes > 0;

  const barColors: Record<string, string> = {
    accepted: 'var(--color-status-green)',
    rejected: 'var(--color-status-red)',
    ghosted: 'var(--color-status-amber)',
    withdrawn: 'var(--color-text-muted)',
  };

  const barLabels: Record<string, string> = {
    accepted: 'Diterima',
    rejected: 'Ditolak',
    ghosted: 'Ghosted',
    withdrawn: 'Ditarik',
  };

  return (
    <section style={{ padding: 'var(--space-6)' }}>
      <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
        💡 Insights & Analisis
      </h2>

      {!hasData ? (
        <div style={{
          textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-text-muted)',
          background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
        }}>
          <p style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-2)' }}>
            Belum cukup data untuk analisis
          </p>
          <p>Minimal butuh 10 outcome untuk menghasilkan insight yang berguna.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Sample Warning */}
          {sampleWarning && (
            <div style={{
              padding: 'var(--space-4)',
              background: '#FEF3C7', border: '1px solid #FCD34D',
              borderRadius: 'var(--radius-md)',
              color: '#92400E', fontSize: 'var(--font-size-sm)',
            }}>
              ⚠️ {sampleWarning}
            </div>
          )}

          {/* Outcome Distribution Chart */}
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)',
          }}>
            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
              📊 Distribusi Outcome
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {(Object.keys(distribution) as (keyof OutcomeDistribution)[]).map((key) => {
                const count = distribution[key];
                const pct = totalOutcomes > 0 ? Math.round((count / totalOutcomes) * 100) : 0;
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span style={{ width: 100, fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                      {barLabels[key]}
                    </span>
                    <div style={{ flex: 1, height: 24, background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: barColors[key],
                        borderRadius: 'var(--radius-sm)',
                        transition: 'width 0.5s ease',
                        minWidth: pct > 0 ? 4 : 0,
                      }} />
                    </div>
                    <span style={{ width: 60, textAlign: 'right', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                      {count} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stage Bocor */}
          {stageBocor && (
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6)',
            }}>
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
                🔍 Analisis Stage Bocor
              </h3>
              <div style={{
                padding: 'var(--space-4)',
                background: '#FEF2F2',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #FECACA',
              }}>
                <p style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>
                  Stage dengan rejection rate tertinggi:
                </p>
                <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-status-red)' }}>
                  {stageBocor.stage} — {stageBocor.rejectionRate}%
                </p>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
                  {stageBocor.rejectionRate >= 50
                    ? '⚠️ Lebih dari setengah kandidat ditolak di stage ini.'
                    : 'Tingkat rejection cukup signifikan di stage ini.'}
                </p>
              </div>
            </div>
          )}

          {/* Skill Gap Frequency */}
          {skillGaps.length > 0 && (
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6)',
            }}>
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
                🎯 Frekuensi Skill Gap
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {skillGaps.slice(0, 15).map((entry) => (
                  <div key={entry.skill} style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                    padding: 'var(--space-2) var(--space-3)',
                    background: 'var(--color-bg)', borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                  }}>
                    <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>{entry.skill}</span>
                    <span style={{
                      padding: 'var(--space-1) var(--space-2)',
                      background: 'var(--color-status-red)', color: '#FFFFFF',
                      borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)', fontWeight: 600,
                    }}>{entry.count}x</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Learning Points */}
          {learningPoints.length > 0 && (
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6)',
            }}>
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
                💡 Poin Pembelajaran
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {learningPoints.map((point, i) => {
                  const icon = point.category === 'stage' ? '🎯' : point.category === 'skill' ? '🛠️' : '📈';
                  return (
                    <div key={i} style={{
                      padding: 'var(--space-4)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                        <span style={{ fontSize: 'var(--font-size-xl)' }}>{icon}</span>
                        <div>
                          <p style={{ fontWeight: 600, marginBottom: 'var(--space-1)' }}>{point.insight}</p>
                          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)' }}>
                            💡 {point.recommendation}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Job Search Health Score */}
          {healthScore && (
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6)',
            }}>
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
                🏆 Job Search Health Score
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', marginBottom: 'var(--space-4)' }}>
                <div style={{
                  fontSize: '3rem',
                  fontWeight: 700,
                  color: healthScore.score >= 70 ? '#16A34A' : healthScore.score >= 40 ? '#CA8A04' : '#DC2626',
                }}>
                  {healthScore.score}
                </div>
                <div style={{ flex: 1 }}>
                  {healthScore.factors.map((factor, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                      <span style={{ fontSize: 'var(--font-size-sm)', width: '120px' }}>{factor.name}</span>
                      <div style={{ flex: 1, height: '8px', background: 'var(--color-border)', borderRadius: '4px' }}>
                        <div style={{ width: `${factor.score}%`, height: '100%', background: factor.score >= 70 ? '#16A34A' : factor.score >= 40 ? '#CA8A04' : '#DC2626', borderRadius: '4px' }} />
                      </div>
                      <span style={{ fontSize: 'var(--font-size-sm)', width: '40px', textAlign: 'right' }}>{Math.round(factor.score)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                {healthScore.score >= 70 ? 'Great progress! Keep up the momentum.' :
                 healthScore.score >= 40 ? 'Good foundation. Focus on improving weak areas.' :
                 'Early stage. Focus on building momentum and learning from feedback.'}
              </p>
            </div>
          )}

          {/* Location Insights */}
          {locationInsights.length > 0 && (
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6)',
            }}>
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
                📍 Success by Location
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                      <th style={{ textAlign: 'left', padding: 'var(--space-2)' }}>Location</th>
                      <th style={{ textAlign: 'right', padding: 'var(--space-2)' }}>Jobs</th>
                      <th style={{ textAlign: 'right', padding: 'var(--space-2)' }}>Apps</th>
                      <th style={{ textAlign: 'right', padding: 'var(--space-2)' }}>Response</th>
                      <th style={{ textAlign: 'right', padding: 'var(--space-2)' }}>Accepted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locationInsights.slice(0, 10).map((loc, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: 'var(--space-2)' }}>{loc.location}</td>
                        <td style={{ textAlign: 'right', padding: 'var(--space-2)' }}>{loc.totalJobs}</td>
                        <td style={{ textAlign: 'right', padding: 'var(--space-2)' }}>{loc.totalApplications}</td>
                        <td style={{ textAlign: 'right', padding: 'var(--space-2)', color: loc.responseRate >= 50 ? '#16A34A' : '#CA8A04' }}>{loc.responseRate}%</td>
                        <td style={{ textAlign: 'right', padding: 'var(--space-2)', color: loc.acceptanceRate >= 30 ? '#16A34A' : '#CA8A04' }}>{loc.acceptanceRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Employment Type Insights */}
          {employmentInsights.length > 0 && (
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6)',
            }}>
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
                📄 Success by Employment Type
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                      <th style={{ textAlign: 'left', padding: 'var(--space-2)' }}>Type</th>
                      <th style={{ textAlign: 'right', padding: 'var(--space-2)' }}>Jobs</th>
                      <th style={{ textAlign: 'right', padding: 'var(--space-2)' }}>Apps</th>
                      <th style={{ textAlign: 'right', padding: 'var(--space-2)' }}>Response</th>
                      <th style={{ textAlign: 'right', padding: 'var(--space-2)' }}>Accepted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employmentInsights.map((type, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: 'var(--space-2)' }}>{type.type}</td>
                        <td style={{ textAlign: 'right', padding: 'var(--space-2)' }}>{type.totalJobs}</td>
                        <td style={{ textAlign: 'right', padding: 'var(--space-2)' }}>{type.totalApplications}</td>
                        <td style={{ textAlign: 'right', padding: 'var(--space-2)', color: type.responseRate >= 50 ? '#16A34A' : '#CA8A04' }}>{type.responseRate}%</td>
                        <td style={{ textAlign: 'right', padding: 'var(--space-2)', color: type.acceptanceRate >= 30 ? '#16A34A' : '#CA8A04' }}>{type.acceptanceRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Fit Score vs Response Rate */}
          {fitScoreInsights.length > 0 && (
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-6)',
            }}>
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
                📊 Fit Score vs Response Rate
              </h3>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
                Does a better fit score lead to more responses?
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                {fitScoreInsights.map((insight, i) => (
                  <div key={i} style={{
                    flex: '1 1 120px',
                    padding: 'var(--space-4)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
                      Fit Score {insight.range}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>
                      {insight.count}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>applications</div>
                    <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-sm)' }}>
                      <span style={{ color: insight.avgResponseRate >= 50 ? '#16A34A' : '#CA8A04' }}>
                        {insight.avgResponseRate}% response
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
