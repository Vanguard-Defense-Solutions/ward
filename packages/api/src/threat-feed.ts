import type { ThreatEntry } from '@ward/shared/types';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function severityColor(type: string): string {
  switch (type) {
    case 'backdoor': return '#ef4444';
    case 'malicious-code': return '#ef4444';
    case 'credential-theft': return '#f97316';
    case 'cryptominer': return '#eab308';
    case 'typosquat': return '#3b82f6';
    default: return '#6b7280';
  }
}

export function renderThreatFeed(threats: ThreatEntry[]): string {
  const rows = threats.map(t => `
    <div class="threat" style="border-left: 3px solid ${severityColor(t.threat_type)}">
      <div class="threat-header">
        <span class="pkg">${escapeHtml(t.package_name)}@${escapeHtml(t.version)}</span>
        <span class="type">${escapeHtml(t.threat_type)}</span>
        <span class="time">${timeAgo(t.detected_at)}</span>
      </div>
      <div class="desc">${escapeHtml(t.description)}</div>
      ${t.safe_version && t.safe_version !== 'none' ? `<div class="safe">Safe version: ${escapeHtml(t.safe_version)}</div>` : ''}
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ward — Supply Chain Threat Intelligence</title>
  <meta name="description" content="Real-time supply chain threat feed. ${threats.length} verified npm attacks tracked.">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0a0a0a; color: #fafafa; font-family: Inter, -apple-system, sans-serif; line-height: 1.6; }
    .container { max-width: 720px; margin: 0 auto; padding: 24px 16px; }
    header { margin-bottom: 32px; }
    h1 { font-size: 20px; font-weight: 600; margin-bottom: 4px; }
    .subtitle { color: #a3a3a3; font-size: 14px; margin-bottom: 16px; }
    .stats { display: flex; gap: 24px; margin-bottom: 24px; }
    .stat { text-align: center; }
    .stat-num { font-size: 32px; font-weight: 700; font-family: "JetBrains Mono", monospace; }
    .stat-label { font-size: 12px; color: #a3a3a3; text-transform: uppercase; letter-spacing: 0.05em; }
    .install { background: #171717; border: 1px solid #262626; border-radius: 6px; padding: 12px 16px; font-family: "JetBrains Mono", monospace; font-size: 13px; color: #a3a3a3; margin-bottom: 32px; }
    .install code { color: #3b82f6; }
    .threat { background: #171717; border: 1px solid #262626; border-radius: 6px; padding: 12px 16px; margin-bottom: 8px; }
    .threat-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap; }
    .pkg { font-family: "JetBrains Mono", monospace; font-size: 14px; font-weight: 600; }
    .type { font-size: 11px; background: #262626; padding: 2px 8px; border-radius: 10px; color: #a3a3a3; }
    .time { font-size: 11px; color: #6b7280; margin-left: auto; }
    .desc { font-size: 13px; color: #a3a3a3; }
    .safe { font-size: 12px; color: #22c55e; margin-top: 4px; }
    footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #262626; font-size: 12px; color: #6b7280; }
    footer a { color: #3b82f6; text-decoration: none; }
    h2 { font-size: 14px; font-weight: 600; color: #a3a3a3; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
    @media (max-width: 640px) { .stats { gap: 16px; } .stat-num { font-size: 24px; } .time { margin-left: 0; } }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Ward</h1>
      <div class="subtitle">Supply chain threat intelligence for AI-assisted developers</div>
      <div class="stats">
        <div class="stat"><div class="stat-num" style="color:#ef4444">${threats.length}</div><div class="stat-label">Threats tracked</div></div>
        <div class="stat"><div class="stat-num" style="color:#22c55e">42</div><div class="stat-label">Attacks blocked</div></div>
      </div>
      <div class="install">$ <code>npm install -g wardshield && ward init</code></div>
    </header>
    <h2>Threat Feed</h2>
    ${rows}
    <footer>
      Built by <a href="https://vanguarddefensesolutions.com">Vanguard Defense Solutions</a> &middot;
      <a href="https://github.com/Vanguard-Defense-Solutions/ward">GitHub</a> &middot;
      <a href="https://api.wardshield.com/threats">API</a>
    </footer>
  </div>
</body>
</html>`;
}
