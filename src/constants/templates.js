export const DEFAULT_AVATARS = {
  lead: '/src/assets/images/avatar_product_lead_1795423499673.jpg',
  engineer: '/src/assets/images/avatar_frontend_eng_1795423499369.jpg',
  ops: '/src/assets/images/avatar_ops_manager_1795423531475.jpg',
};

export const DEFAULT_LIST_TITLES = [
  'Backlog',
  'To Do',
  'In Progress',
  'Review',
  'Done',
];

export const PRIORITIES = {
  low: {
    id: 'low',
    label: 'Low',
    color: '#6B7085',
    bgLight: 'bg-slate-100 text-slate-700',
    bgDark: 'dark:bg-slate-800 dark:text-slate-300',
    dot: '#64748B',
  },
  medium: {
    id: 'medium',
    label: 'Medium',
    color: '#635BFF',
    bgLight: 'bg-indigo-50 text-[#4F46E5]',
    bgDark: 'dark:bg-indigo-950/60 dark:text-indigo-300',
    dot: '#635BFF',
  },
  high: {
    id: 'high',
    label: 'High',
    color: '#F59E0B',
    bgLight: 'bg-amber-50 text-amber-800',
    bgDark: 'dark:bg-amber-950/50 dark:text-amber-300',
    dot: '#F59E0B',
  },
  urgent: {
    id: 'urgent',
    label: 'Urgent',
    color: '#EF4444',
    bgLight: 'bg-red-50 text-red-700',
    bgDark: 'dark:bg-red-950/50 dark:text-red-300',
    dot: '#EF4444',
  },
};

export const WORKSPACE_ROLES = {
  owner: {
    id: 'owner',
    label: 'Owner',
    description: 'Full control over workspace, billing, members, and deletion.',
    canWrite: true,
    canManageMembers: true,
    canDeleteWorkspace: true,
  },
  admin: {
    id: 'admin',
    label: 'Admin',
    description: 'Manage workspace settings, boards, and team members.',
    canWrite: true,
    canManageMembers: true,
    canDeleteWorkspace: false,
  },
  member: {
    id: 'member',
    label: 'Member',
    description: 'Create and manage boards, lists, tasks, and comments.',
    canWrite: true,
    canManageMembers: false,
    canDeleteWorkspace: false,
  },
  viewer: {
    id: 'viewer',
    label: 'Viewer',
    description: 'Read-only access to workspace boards and tasks.',
    canWrite: false,
    canManageMembers: false,
    canDeleteWorkspace: false,
  },
};

export const BOARD_BACKGROUNDS = [
  {
    id: 'slate',
    name: 'Clean Canvas',
    swatch: '#F7F8FC',
    canvasClass: 'bg-[#F7F8FC] dark:bg-[#0D0E14]',
    headerAccent: '#635BFF',
  },
  {
    id: 'indigo',
    name: 'Indigo Mist',
    swatch: '#635BFF',
    canvasClass: 'bg-gradient-to-br from-[#F4F5FF] via-[#F7F8FC] to-[#EEF0FF] dark:from-[#121324] dark:via-[#0D0E14] dark:to-[#14162B]',
    headerAccent: '#635BFF',
  },
  {
    id: 'emerald',
    name: 'Sage Field',
    swatch: '#10B981',
    canvasClass: 'bg-gradient-to-br from-[#F2FBF7] via-[#F7F8FC] to-[#ECF8F2] dark:from-[#0E1B17] dark:via-[#0D0E14] dark:to-[#10201A]',
    headerAccent: '#10B981',
  },
  {
    id: 'amber',
    name: 'Warm Sandstone',
    swatch: '#F59E0B',
    canvasClass: 'bg-gradient-to-br from-[#FFFBF2] via-[#F7F8FC] to-[#FEF6E6] dark:from-[#1D1710] dark:via-[#0D0E14] dark:to-[#211A11]',
    headerAccent: '#D97706',
  },
  {
    id: 'ocean',
    name: 'Nordic Slate',
    swatch: '#0EA5E9',
    canvasClass: 'bg-gradient-to-br from-[#F0F8FF] via-[#F7F8FC] to-[#EAF4FC] dark:from-[#0E1824] dark:via-[#0D0E14] dark:to-[#111D2B]',
    headerAccent: '#0284C7',
  },
  {
    id: 'rose',
    name: 'Dusk Clay',
    swatch: '#F43F5E',
    canvasClass: 'bg-gradient-to-br from-[#FFF5F7] via-[#F7F8FC] to-[#FCEFF2] dark:from-[#1E1216] dark:via-[#0D0E14] dark:to-[#221319]',
    headerAccent: '#E11D48',
  },
];

export const DEFAULT_BOARD_LABELS = [
  { id: 'lbl-design', name: 'Design', color: '#635BFF' },
  { id: 'lbl-frontend', name: 'Frontend', color: '#0EA5E9' },
  { id: 'lbl-backend', name: 'Backend', color: '#10B981' },
  { id: 'lbl-research', name: 'Research', color: '#8B5CF6' },
  { id: 'lbl-urgent', name: 'Blocker', color: '#EF4444' },
  { id: 'lbl-docs', name: 'Docs', color: '#F59E0B' },
];

export const WORKSPACE_COLORS = [
  '#635BFF',
  '#0EA5E9',
  '#10B981',
  '#F59E0B',
  '#EC4899',
  '#334155',
];

export const BOARD_TEMPLATES = [
  {
    id: 'blank',
    name: 'Blank Kanban Board',
    category: 'Custom',
    description: 'Start clean with standard Backlog, To Do, In Progress, Review, and Done lanes.',
    background: 'slate',
    lists: ['Backlog', 'To Do', 'In Progress', 'Review', 'Done'],
    sampleTasks: [],
  },
  {
    id: 'project-management',
    name: 'Project Management',
    category: 'Operations',
    description: 'Coordinate milestones, sprint deliverables, stakeholder reviews, and release checklists.',
    background: 'indigo',
    lists: ['Backlog', 'To Do', 'In Progress', 'Review', 'Done'],
    sampleTasks: [
      { listIndex: 0, title: 'Define Q4 delivery milestones and resource map', priority: 'medium', labelIds: ['lbl-research'], daysOffset: 6 },
      { listIndex: 1, title: 'Finalize vendor SLA and procurement sign-off', priority: 'high', labelIds: ['lbl-docs'], daysOffset: 2 },
      { listIndex: 2, title: 'Run sprint capacity retrospective with team leads', priority: 'high', labelIds: ['lbl-design'], daysOffset: 1 },
      { listIndex: 3, title: 'Review executive stakeholder progress deck', priority: 'medium', labelIds: ['lbl-docs'], daysOffset: 0 },
      { listIndex: 4, title: 'Publish project charter and kickoff notes', priority: 'low', labelIds: ['lbl-docs'], daysOffset: -2 },
    ],
  },
  {
    id: 'website-development',
    name: 'Website Development',
    category: 'Engineering',
    description: 'Ship web products from UX wireframes and API contracts through QA and deployment.',
    background: 'ocean',
    lists: ['Backlog', 'To Do', 'In Progress', 'Review', 'Done'],
    sampleTasks: [
      { listIndex: 0, title: 'Audit Core Web Vitals and bundle splitting strategy', priority: 'low', labelIds: ['lbl-frontend'], daysOffset: 8 },
      { listIndex: 1, title: 'Implement responsive pricing tier comparison table', priority: 'high', labelIds: ['lbl-design', 'lbl-frontend'], daysOffset: 3 },
      { listIndex: 2, title: 'Connect OAuth callback routes and session middleware', priority: 'urgent', labelIds: ['lbl-backend'], daysOffset: 1 },
      { listIndex: 3, title: 'Accessibility pass on keyboard navigation and focus traps', priority: 'medium', labelIds: ['lbl-frontend'], daysOffset: 2 },
      { listIndex: 4, title: 'Configure staging CI pipeline and preview domains', priority: 'medium', labelIds: ['lbl-backend'], daysOffset: -1 },
    ],
  },
  {
    id: 'marketing-campaign',
    name: 'Marketing Campaign',
    category: 'Growth',
    description: 'Plan campaign assets, editorial calendars, ad creatives, and conversion reporting.',
    background: 'rose',
    lists: ['Backlog', 'To Do', 'In Progress', 'Review', 'Done'],
    sampleTasks: [
      { listIndex: 0, title: 'Draft customer case study interview questions', priority: 'low', labelIds: ['lbl-research'], daysOffset: 7 },
      { listIndex: 1, title: 'Prepare product launch newsletter sequence', priority: 'high', labelIds: ['lbl-docs'], daysOffset: 2 },
      { listIndex: 2, title: 'Design social visual kit for launch announcement', priority: 'high', labelIds: ['lbl-design'], daysOffset: 1 },
      { listIndex: 3, title: 'Approve landing page copy and UTM attribution links', priority: 'medium', labelIds: ['lbl-docs'], daysOffset: 0 },
      { listIndex: 4, title: 'Segment active beta users for early access invite', priority: 'medium', labelIds: ['lbl-research'], daysOffset: -3 },
    ],
  },
  {
    id: 'college-assignment',
    name: 'College Assignment',
    category: 'Academic',
    description: 'Organize group research papers, literature reviews, prototype demos, and submission deadlines.',
    background: 'emerald',
    lists: ['Backlog', 'To Do', 'In Progress', 'Review', 'Done'],
    sampleTasks: [
      { listIndex: 0, title: 'Collect 10 peer-reviewed journal references (IEEE)', priority: 'medium', labelIds: ['lbl-research'], daysOffset: 5 },
      { listIndex: 1, title: 'Write methodology and dataset evaluation chapter', priority: 'high', labelIds: ['lbl-docs'], daysOffset: 3 },
      { listIndex: 2, title: 'Build interactive prototype demo for presentation', priority: 'urgent', labelIds: ['lbl-frontend'], daysOffset: 1 },
      { listIndex: 3, title: 'Proofread final report formatting and citations', priority: 'medium', labelIds: ['lbl-docs'], daysOffset: 2 },
      { listIndex: 4, title: 'Submit topic proposal to course supervisor', priority: 'low', labelIds: ['lbl-docs'], daysOffset: -4 },
    ],
  },
  {
    id: 'personal-productivity',
    name: 'Personal Productivity',
    category: 'Personal',
    description: 'Track weekly priorities, reading goals, freelance tasks, and personal milestones.',
    background: 'amber',
    lists: ['Backlog', 'To Do', 'In Progress', 'Review', 'Done'],
    sampleTasks: [
      { listIndex: 0, title: 'Organize digital portfolio case studies for Q4', priority: 'low', labelIds: ['lbl-design'], daysOffset: 9 },
      { listIndex: 1, title: 'Prepare monthly freelance invoice summary', priority: 'high', labelIds: ['lbl-docs'], daysOffset: 2 },
      { listIndex: 2, title: 'Complete distributed systems study notes', priority: 'medium', labelIds: ['lbl-research'], daysOffset: 1 },
      { listIndex: 4, title: 'Plan weekly focus blocks and deep-work schedule', priority: 'low', labelIds: ['lbl-docs'], daysOffset: -1 },
    ],
  },
  {
    id: 'event-management',
    name: 'Event Management',
    category: 'Campus & Events',
    description: 'Coordinate venues, speakers, sponsorship decks, registrations, and run-of-show schedules.',
    background: 'indigo',
    lists: ['Backlog', 'To Do', 'In Progress', 'Review', 'Done'],
    sampleTasks: [
      { listIndex: 0, title: 'Confirm AV equipment checklist with auditorium staff', priority: 'medium', labelIds: ['lbl-backend'], daysOffset: 6 },
      { listIndex: 1, title: 'Send speaker briefing pack and slide deadlines', priority: 'high', labelIds: ['lbl-docs'], daysOffset: 2 },
      { listIndex: 2, title: 'Finalize attendee registration QR check-in flow', priority: 'urgent', labelIds: ['lbl-frontend'], daysOffset: 1 },
      { listIndex: 3, title: 'Verify sponsorship deliverables and stage banners', priority: 'high', labelIds: ['lbl-design'], daysOffset: 3 },
      { listIndex: 4, title: 'Lock main hall booking and catering deposit', priority: 'medium', labelIds: ['lbl-docs'], daysOffset: -2 },
    ],
  },
];

export const FIELD_LIMITS = {
  workspaceName: 100,
  workspaceDesc: 500,
  boardTitle: 120,
  boardDesc: 500,
  listTitle: 80,
  taskTitle: 200,
  taskDesc: 5000,
  commentContent: 2000,
  fullName: 120,
  roleTitle: 80,
  bio: 300,
  maxMembers: 50,
  maxAssignees: 20,
  maxLabels: 10,
  maxChecklists: 10,
  maxAttachments: 10,
};
