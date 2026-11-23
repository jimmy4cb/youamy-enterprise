"use client";

import { useEffect, useMemo, useState } from "react";

type ApplicationStatus = "New" | "Reviewed" | "Shortlisted" | "Rejected";
type JobApplication = {
  id: number;
  application_id: string;
  job_title: string;
  destination: string;
  full_name: string;
  phone: string;
  email: string;
  experience: string;
  notes: string;
  cv_name: string;
  cv_type: string;
  cv_size: number;
  status: ApplicationStatus;
  created_at: string;
};
type Analytics = {
  total: number;
  last30Days: number;
  byStatus: Record<ApplicationStatus, number>;
  monthly: Array<{ month: string; count: number }>;
  topJobs: Array<{ job_title: string; destination: string; count: number }>;
};

const statuses: ApplicationStatus[] = ["New", "Reviewed", "Shortlisted", "Rejected"];

function monthLabel(month: string) {
  return new Date(`${month}-01T12:00:00`).toLocaleDateString("en", { month: "short" });
}

function applicationDate(date: string) {
  return new Date(`${date.replace(" ", "T")}Z`).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdminJobApplications() {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | ApplicationStatus>("All");
  const [jobFilter, setJobFilter] = useState("All jobs");

  async function loadApplications(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    setError("");
    try {
      const response = await fetch("/api/admin/job-applications");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load applications.");
      setApplications(result.applications);
      setAnalytics(result.analytics);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load applications.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadApplications();
  }, []);

  const jobOptions = useMemo(
    () => [...new Set(applications.map((application) => application.job_title))],
    [applications],
  );
  const filteredApplications = useMemo(() => {
    const search = query.trim().toLowerCase();
    return applications.filter((application) =>
      (statusFilter === "All" || application.status === statusFilter) &&
      (jobFilter === "All jobs" || application.job_title === jobFilter) &&
      (!search || [
        application.full_name,
        application.email,
        application.phone,
        application.job_title,
        application.destination,
      ].join(" ").toLowerCase().includes(search)),
    );
  }, [applications, jobFilter, query, statusFilter]);

  async function updateStatus(application: JobApplication, status: ApplicationStatus) {
    setError("");
    try {
      const response = await fetch("/api/admin/job-applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: application.id, status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update application.");
      setApplications((current) => current.map((item) =>
        item.id === application.id ? { ...item, status: result.status } : item,
      ));
      if (analytics && application.status !== status) {
        setAnalytics((current) => current ? ({
          ...current,
          byStatus: {
            ...current.byStatus,
            [application.status]: Math.max(0, (current.byStatus[application.status] || 0) - 1),
            [status]: (current.byStatus[status] || 0) + 1,
          },
        }) : current);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update application.");
    }
  }

  const monthlyData = useMemo(() => {
    const counts = new Map((analytics?.monthly || []).map((item) => [item.month, item.count]));
    const now = new Date();
    return Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
      const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
      return { key, label: monthLabel(key), count: counts.get(key) || 0 };
    });
  }, [analytics]);
  const peakMonth = Math.max(1, ...monthlyData.map((item) => item.count));
  const peakJob = Math.max(1, ...(analytics?.topJobs || []).map((job) => job.count));

  return (
    <section className="admin-listings application-analytics" id="job-applications">
      <div className="admin-listings-head">
        <div><p>Recruitment pipeline</p><h2>Application analysis</h2></div>
        <div className="application-header-actions">
          <span className="admin-inquiry-count">{analytics?.total || 0} applications</span>
          <button type="button" className="application-refresh" onClick={() => void loadApplications(true)} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>
      {error && <p className="journey-error application-error" role="alert">{error}</p>}

      <div className="application-overview">
        <article className="application-kpi">
          <span>Applications received</span>
          <strong>{analytics?.total ?? "—"}</strong>
          <small>All submitted applications</small>
        </article>
        <article className="application-kpi">
          <span>New to review</span>
          <strong>{analytics?.byStatus.New ?? "—"}</strong>
          <small>Awaiting first review</small>
        </article>
        <article className="application-kpi">
          <span>Shortlisted</span>
          <strong>{analytics?.byStatus.Shortlisted ?? "—"}</strong>
          <small>Ready for follow-up</small>
        </article>
        <article className="application-kpi">
          <span>Last 30 days</span>
          <strong>{analytics?.last30Days ?? "—"}</strong>
          <small>Recent submissions</small>
        </article>
      </div>

      <div className="application-charts">
        <section className="application-chart" aria-labelledby="application-trend-heading">
          <div className="application-chart-heading">
            <div><h3 id="application-trend-heading">Submission trend</h3><p>Applications received by month</p></div>
            <span>Last 6 months</span>
          </div>
          <div className="application-month-chart">
            {monthlyData.map((month) => (
              <div className="application-month" key={month.key} aria-label={`${month.label}: ${month.count} applications`}>
                <strong>{month.count}</strong>
                <div className="application-month-track">
                  <span style={{ height: `${month.count ? Math.max(8, (month.count / peakMonth) * 100) : 0}%` }} />
                </div>
                <span>{month.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="application-chart" aria-labelledby="application-status-heading">
          <div className="application-chart-heading">
            <div><h3 id="application-status-heading">Review pipeline</h3><p>Current application status</p></div>
          </div>
          <div className="application-status-list">
            {statuses.map((status) => {
              const count = analytics?.byStatus[status] || 0;
              const ratio = analytics?.total ? (count / analytics.total) * 100 : 0;
              return (
                <div className="application-status-row" key={status}>
                  <div><span>{status}</span><strong>{count}</strong></div>
                  <div className="application-status-track"><span className={`status-${status.toLowerCase()}`} style={{ width: `${ratio}%` }} /></div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="application-chart application-top-jobs" aria-labelledby="application-jobs-heading">
          <div className="application-chart-heading">
            <div><h3 id="application-jobs-heading">Most applied-for roles</h3><p>Applications grouped by job listing</p></div>
          </div>
          {(analytics?.topJobs || []).length ? (
            <div className="application-job-list">
              {analytics?.topJobs.map((job) => (
                <div className="application-job-row" key={`${job.job_title}-${job.destination}`}>
                  <div><strong>{job.job_title}</strong><span>{job.destination}</span><b>{job.count}</b></div>
                  <div className="application-status-track"><span style={{ width: `${(job.count / peakJob) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          ) : <p className="application-no-data">Role breakdown will appear when applications arrive.</p>}
        </section>
      </div>

      <div className="application-records-heading">
        <div><h3>Applicant records</h3><p>Showing {filteredApplications.length} of {applications.length} recent applications</p></div>
        <div className="application-filters">
          <label>
            <span className="sr-only">Search applicants</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email or job" />
          </label>
          <label>
            <span className="sr-only">Filter by application status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "All" | ApplicationStatus)}>
              <option value="All">All statuses</option>
              {statuses.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by job</span>
            <select value={jobFilter} onChange={(event) => setJobFilter(event.target.value)}>
              <option>All jobs</option>
              {jobOptions.map((job) => <option key={job}>{job}</option>)}
            </select>
          </label>
        </div>
      </div>
      {analytics && analytics.total > applications.length && (
        <p className="application-record-limit">Showing the 500 most recent records; charts use all applications.</p>
      )}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Applicant</th><th>Job</th><th>Experience</th><th>CV attachment</th><th>Submitted</th><th>Status</th></tr>
          </thead>
          <tbody>
            {filteredApplications.map((application) => (
              <tr key={application.id}>
                <td>
                  <strong>{application.full_name}</strong>
                  <span><a href={`tel:${application.phone}`}>{application.phone}</a></span>
                  {application.email && <span>{application.email}</span>}
                </td>
                <td>
                  <strong>{application.job_title}</strong>
                  <span>{application.destination}</span>
                  {application.notes && <span>{application.notes}</span>}
                </td>
                <td>{application.experience || "—"}</td>
                <td>
                  <a href={`/api/admin/job-applications?download=${encodeURIComponent(application.application_id)}`}>
                    {application.cv_name}
                  </a>
                  <span>{Math.max(1, Math.round(application.cv_size / 1024))} KB</span>
                </td>
                <td>{applicationDate(application.created_at)}</td>
                <td>
                  <select
                    className="admin-appointment-status"
                    aria-label={`Update application status for ${application.full_name}`}
                    value={application.status}
                    onChange={(event) => void updateStatus(application, event.target.value as ApplicationStatus)}
                  >
                    {statuses.map((status) => <option key={status}>{status}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <div className="admin-empty">Loading applications and analytics…</div>}
        {!loading && filteredApplications.length === 0 && !error && (
          <div className="admin-empty">
            {applications.length ? "No applications match these filters." : "Uploaded job applications will appear here."}
          </div>
        )}
      </div>
    </section>
  );
}
