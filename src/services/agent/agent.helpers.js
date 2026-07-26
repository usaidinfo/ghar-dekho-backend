

const EXPERIENCE_BUCKETS = [
  { label: '0-5 Years', min: 0, max: 4, years: 3 },
  { label: '5-10 Years', min: 5, max: 9, years: 7 },
  { label: '10-15 Years', min: 10, max: 14, years: 12 },
  { label: '15+ Years', min: 15, max: Infinity, years: 15 },
];

export const LEAD_STAGES = [
  'NEW',
  'CONTACTED',
  'INTERESTED',
  'VISIT_SCHEDULED',
  'NEGOTIATION',
  'CONVERTED',
  'LOST',
];

export const TEAM_PERMISSIONS = ['ADMIN', 'BILLING', 'EDITOR', 'ANALYTICS', 'VIEWER'];

export function formatInr(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  return `₹${Number(amount).toLocaleString('en-IN')}`;
}

export function maskPhone(phone) {
  if (!phone) return '••••••••';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 4) return '••••••••';
  return `••••••${digits.slice(-4)}`;
}

export function yearsToExperienceLabel(years) {
  if (years == null || Number.isNaN(Number(years))) return '';
  const y = Number(years);
  const bucket = EXPERIENCE_BUCKETS.find((b) => y >= b.min && y <= b.max);
  return bucket?.label || '15+ Years';
}

export function experienceLabelToYears(labelOrYears) {
  if (labelOrYears == null || labelOrYears === '') return null;
  if (typeof labelOrYears === 'number') return labelOrYears;
  const bucket = EXPERIENCE_BUCKETS.find((b) => b.label === labelOrYears);
  if (bucket) return bucket.years;
  const parsed = parseInt(String(labelOrYears), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export function languagesToString(languages) {
  if (!Array.isArray(languages) || languages.length === 0) return '';
  return languages.join(', ');
}

export function languagesToArray(value) {
  if (Array.isArray(value)) {
    return value.map((s) => String(s).trim()).filter(Boolean);
  }
  if (typeof value !== 'string' || !value.trim()) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

export function initialsFromName(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

export function mapLeadStatusToStage(status) {
  if (status === 'NOT_INTERESTED') return 'LOST';
  if (LEAD_STAGES.includes(status)) return status;
  return 'NEW';
}

export function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(from, days) {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

export function daysBetween(from, to = new Date()) {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function parsePeriodDays(period = '30D') {
  const raw = String(period || '30D').toUpperCase();
  if (raw === '7D' || raw === '7') return 7;
  if (raw === '90D' || raw === '90') return 90;
  if (raw === '30D' || raw === '30') return 30;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 365) : 30;
}

export function normalizePermissions(permissions) {
  if (!permissions) return ['VIEWER'];
  let list = permissions;
  if (typeof permissions === 'string') {
    try {
      list = JSON.parse(permissions);
    } catch {
      list = [permissions];
    }
  }
  if (!Array.isArray(list)) return ['VIEWER'];
  const cleaned = list
    .map((p) => String(p).toUpperCase())
    .filter((p) => TEAM_PERMISSIONS.includes(p));
  return cleaned.length ? cleaned : ['VIEWER'];
}

export function propertyLocation(property) {
  if (!property) return '';
  const parts = [property.locality, property.city].filter(Boolean);
  return parts.join(', ');
}

export function primaryImageUrl(property) {
  const images = property?.images;
  if (!Array.isArray(images) || images.length === 0) return null;
  const primary = images.find((img) => img.isPrimary) || images[0];
  return primary?.thumbnailUrl || primary?.imageUrl || null;
}

export function intentScoreFromLead(lead) {
  const priorityScore = {
    URGENT: 95,
    HIGH: 80,
    MEDIUM: 60,
    LOW: 40,
  }[lead.priority] ?? 50;

  const stageBoost = {
    NEW: 0,
    CONTACTED: 5,
    INTERESTED: 15,
    VISIT_SCHEDULED: 25,
    NEGOTIATION: 30,
    CONVERTED: 40,
    LOST: -20,
    NOT_INTERESTED: -20,
  }[lead.status] ?? 0;

  return Math.max(0, Math.min(100, priorityScore + stageBoost));
}

export function tierLabelFromPlan(plan, profileType) {
  if (!plan) {
    if (profileType === 'BUILDER') return 'Builder';
    if (profileType === 'BROKER') return 'Broker';
    return 'Agent';
  }
  const account = plan.accountType
    ? String(plan.accountType).charAt(0) + String(plan.accountType).slice(1).toLowerCase()
    : 'Agent';
  const tier = plan.planTier
    ? String(plan.planTier).charAt(0) + String(plan.planTier).slice(1).toLowerCase()
    : '';
  return [account, tier, 'Plan'].filter(Boolean).join(' ');
}

export function listingStatusForUi(status) {
  if (status === 'INACTIVE' || status === 'UNDER_VERIFICATION' || status === 'REJECTED') {
    return status === 'UNDER_VERIFICATION' ? 'DRAFT' : status === 'REJECTED' ? 'EXPIRED' : 'DRAFT';
  }
  if (['ACTIVE', 'DRAFT', 'SOLD', 'RENTED', 'EXPIRED'].includes(status)) return status;
  return 'DRAFT';
}
