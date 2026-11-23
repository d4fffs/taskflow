import type { Timestamp, FieldValue } from 'firebase/firestore';

export type DateLike = string | Date | Timestamp | FieldValue | { toDate?: () => Date; toMillis?: () => number } | null | undefined;

export type ThemeMode = 'light' | 'dark' | 'system';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

export type BoardVisibility = 'workspace' | 'private' | 'public';

export type NotificationType =
  | 'assignment'
  | 'mention'
  | 'deadline'
  | 'invitation'
  | 'member_joined'
  | 'task_update';

export type InvitationStatus = 'pending' | 'accepted' | 'declined';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  emailVerified: boolean;
}

export interface UserProfile {
  id?: string;
  uid: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  bio?: string;
  roleTitle?: string;
  theme?: ThemeMode;
  createdAt?: DateLike;
  updatedAt?: DateLike;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  avatarColor?: string;
  ownerId: string;
  memberIds: string[];
  createdAt?: DateLike;
  updatedAt?: DateLike;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  fullName: string;
  avatarUrl?: string;
  role: WorkspaceRole;
  memberIds: string[];
  joinedAt?: DateLike;
}

export interface BoardLabel {
  id: string;
  name: string;
  color: string;
}

export interface Board {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  background: string;
  visibility: BoardVisibility;
  isArchived: boolean;
  ownerId: string;
  memberIds: string[];
  labels?: BoardLabel[];
  createdAt?: DateLike;
  updatedAt?: DateLike;
}

export interface KanbanList {
  id: string;
  boardId: string;
  workspaceId: string;
  title: string;
  position: number;
  ownerId?: string;
  memberIds?: string[];
  createdAt?: DateLike;
  updatedAt?: DateLike;
}

export interface ChecklistItem {
  id: string;
  title: string;
  isCompleted: boolean;
}

export interface Checklist {
  id: string;
  title: string;
  items: ChecklistItem[];
}

export interface Attachment {
  id: string;
  fileName?: string;
  fileUrl?: string;
  name?: string;
  url?: string;
  uploadedBy?: string;
  createdAt?: DateLike;
}

export interface Task {
  id: string;
  boardId: string;
  workspaceId: string;
  listId: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status?: string;
  dueDate?: string | null;
  position: number;
  isArchived: boolean;
  assigneeIds?: string[];
  labelIds?: string[];
  checklists?: Checklist[];
  attachments?: Attachment[];
  commentCount?: number;
  ownerId?: string;
  memberIds?: string[];
  createdAt?: DateLike;
  updatedAt?: DateLike;
}

export interface Comment {
  id: string;
  taskId: string;
  boardId: string;
  workspaceId: string;
  userId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  mentions?: string[];
  memberIds?: string[];
  createdAt?: DateLike;
}

export interface Activity {
  id: string;
  boardId: string;
  workspaceId: string;
  taskId?: string | null;
  userId: string;
  actorName: string;
  action: string;
  metadata?: Record<string, unknown>;
  memberIds?: string[];
  createdAt?: DateLike;
}

export interface NotificationItem {
  id: string;
  userId: string;
  actorId?: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  link?: string;
  createdAt?: DateLike;
}

export interface Invitation {
  id: string;
  workspaceId: string;
  workspaceName: string;
  inviterId: string;
  inviterName: string;
  inviteeEmail: string;
  role: Exclude<WorkspaceRole, 'owner'>;
  status: InvitationStatus;
  createdAt?: DateLike;
}

export interface ToastItem {
  id: string;
  title: string;
  message?: string;
  variant: ToastVariant;
}

export interface PriorityMeta {
  id: TaskPriority;
  label: string;
  color: string;
  bgLight: string;
  bgDark: string;
  dot: string;
}

export interface WorkspaceRoleMeta {
  id: WorkspaceRole;
  label: string;
  description: string;
  canWrite: boolean;
  canManageMembers: boolean;
  canDeleteWorkspace: boolean;
}

export interface BoardBackgroundMeta {
  id: string;
  name: string;
  swatch: string;
  canvasClass: string;
  headerAccent: string;
}

export interface BoardTemplateSampleTask {
  listIndex: number;
  title: string;
  priority: TaskPriority;
  labelIds: string[];
  daysOffset: number;
}

export interface BoardTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  background: string;
  lists: string[];
  sampleTasks: BoardTemplateSampleTask[];
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export interface ListPositionPatch {
  id: string;
  position: number;
}

export interface TaskPositionPatch {
  id: string;
  listId: string;
  status: string;
  position: number;
}

export interface DashboardAnalytics {
  summary: {
    totalWorkspaces: number;
    totalBoards: number;
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    overdueTasks: number;
    completionRate: number;
  };
  tasksByStatus: Array<{ name: string; count: number }>;
  tasksByPriority: Array<{ key: TaskPriority; name: string; count: number }>;
  weeklyTrends: Array<{ day: string; date: string; created: number; completed: number }>;
  upcomingDeadlines: Task[];
}

export interface GuestSeedState {
  user: AppUser;
  profile: UserProfile;
  workspaces: Workspace[];
  workspaceMembers: Record<string, WorkspaceMember[]>;
  boards: Board[];
  lists: KanbanList[];
  tasks: Task[];
  comments: Comment[];
  activities: Activity[];
  notifications: NotificationItem[];
  invitations: Invitation[];
}
