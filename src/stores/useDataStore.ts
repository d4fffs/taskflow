import { create } from 'zustand';
import type { Unsubscribe } from 'firebase/firestore';
import { supabase, isSupabaseConfigured } from '../services/supabase/client';
import { createGuestSeedState } from '../services/sandbox/guestSeed';
import {
  subscribeUserWorkspaces,
  subscribeWorkspaceMembers,
  subscribeUserInvitations,
  createWorkspace as fbCreateWorkspace,
  updateWorkspace as fbUpdateWorkspace,
  deleteWorkspace as fbDeleteWorkspace,
  inviteMemberToWorkspace as fbInviteMember,
  updateWorkspaceMemberRole as fbUpdateMemberRole,
  removeWorkspaceMember as fbRemoveMember,
} from '../services/workspace/workspaceService';
import {
  subscribeUserBoards,
  subscribeUserLists,
  createBoard as fbCreateBoard,
  updateBoard as fbUpdateBoard,
  deleteBoard as fbDeleteBoard,
  createList as fbCreateList,
  updateList as fbUpdateList,
  deleteList as fbDeleteList,
  batchPersistListPositions,
} from '../services/board/boardService';
import {
  subscribeUserTasks,
  subscribeUserActivities,
  subscribeUserNotifications,
  createTask as fbCreateTask,
  updateTask as fbUpdateTask,
  deleteTask as fbDeleteTask,
  batchPersistTaskPositions,
  createComment as fbCreateComment,
  deleteComment as fbDeleteComment,
  markNotificationRead as fbMarkNotifRead,
  markAllNotificationsRead as fbMarkAllNotifsRead,
  logActivity,
  type CreateTaskInput,
} from '../services/task/taskService';
import {
  BOARD_TEMPLATES,
  DEFAULT_BOARD_LABELS,
  WORKSPACE_ROLES,
} from '../constants/templates';
import {
  calculateNextPosition,
  generateId,
  moveTaskInBoard,
  parseMentions,
  POSITION_STEP,
  reorderLists,
} from '../utils/kanban';
import { useAuthStore } from './useAuthStore';
import { useToastStore } from './useToastStore';
import type {
  Activity,
  Board,
  BoardLabel,
  BoardVisibility,
  Comment,
  Invitation,
  KanbanList,
  NotificationItem,
  Task,
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
} from '../types';

let activeUnsubs: Unsubscribe[] = [];
let memberUnsubs: Record<string, Unsubscribe> = {};
let didAutoBootstrap = false;

function clearAllSubscriptions(): void {
  activeUnsubs.forEach((fn) => fn && fn());
  activeUnsubs = [];
  Object.values(memberUnsubs).forEach((fn) => fn && fn());
  memberUnsubs = {};
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export interface DataState {
  loading: boolean;
  error: string | null;
  activeWorkspaceId: string | null;
  workspaces: Workspace[];
  workspaceMembers: Record<string, WorkspaceMember[]>;
  boards: Board[];
  lists: KanbanList[];
  tasks: Task[];
  comments: Comment[];
  activities: Activity[];
  notifications: NotificationItem[];
  invitations: Invitation[];

  setActiveWorkspaceId: (id: string | null) => void;
  resetData: () => void;
  startSync: () => void;
  syncFromSupabase: () => Promise<void>;
  getWorkspaceRole: (workspaceId: string | null | undefined) => WorkspaceRole;
  canWriteWorkspace: (workspaceId: string | null | undefined) => boolean;

  createWorkspace: (params: {
    name: string;
    description?: string;
    avatarColor?: string;
  }) => Promise<Workspace | null>;
  updateWorkspace: (
    workspaceId: string,
    updates: { name?: string; description?: string; avatarColor?: string }
  ) => Promise<void>;
  deleteWorkspace: (workspaceId: string) => Promise<void>;
  inviteMember: (
    workspaceId: string,
    email: string,
    role: Exclude<WorkspaceRole, 'owner'>
  ) => Promise<Invitation | null>;
  updateMemberRole: (
    workspaceId: string,
    memberId: string,
    role: Exclude<WorkspaceRole, 'owner'>
  ) => Promise<void>;
  removeMember: (workspaceId: string, memberId: string) => Promise<void>;

  createBoard: (params: {
    workspaceId: string;
    title: string;
    description?: string;
    background?: string;
    visibility?: BoardVisibility;
    templateId?: string;
  }) => Promise<Board | null>;
  updateBoard: (
    boardId: string,
    updates: Partial<{
      title: string;
      description: string;
      background: string;
      visibility: BoardVisibility;
      isArchived: boolean;
      labels: BoardLabel[];
      memberIds: string[];
    }>
  ) => Promise<void>;
  deleteBoard: (boardId: string) => Promise<void>;

  createList: (boardId: string, title: string) => Promise<KanbanList | null>;
  renameList: (listId: string, title: string) => Promise<void>;
  deleteList: (listId: string) => Promise<void>;
  reorderBoardLists: (boardId: string, activeId: string, overId: string) => Promise<void>;

  createTask: (
    boardId: string,
    listId: string,
    data: CreateTaskInput
  ) => Promise<Task | null>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  duplicateTask: (task: Task) => Promise<Task | null>;
  moveTask: (activeTaskId: string, targetListId: string, targetIndex: number) => Promise<void>;

  addComment: (task: Task, content: string) => Promise<Comment | string | null>;
  removeComment: (commentId: string, taskId: string) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
}

export const useDataStore = create<DataState>((set, get) => ({
  loading: true,
  error: null,
  activeWorkspaceId: null,
  workspaces: [],
  workspaceMembers: {},
  boards: [],
  lists: [],
  tasks: [],
  comments: [],
  activities: [],
  notifications: [],
  invitations: [],

  setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),

  resetData: () => {
    clearAllSubscriptions();
    didAutoBootstrap = false;
    set({
      loading: false,
      error: null,
      activeWorkspaceId: null,
      workspaces: [],
      workspaceMembers: {},
      boards: [],
      lists: [],
      tasks: [],
      comments: [],
      activities: [],
      notifications: [],
      invitations: [],
    });
  },

  startSync: () => {
    clearAllSubscriptions();
    const { user, profile, isGuestMode, authProvider } = useAuthStore.getState();

    if (!user) {
      get().resetData();
      return;
    }

    if (isGuestMode) {
      const seed = createGuestSeedState();
      set({
        loading: false,
        error: null,
        activeWorkspaceId: seed.workspaces[0]?.id || null,
        workspaces: seed.workspaces,
        workspaceMembers: seed.workspaceMembers,
        boards: seed.boards,
        lists: seed.lists,
        tasks: seed.tasks,
        comments: seed.comments,
        activities: seed.activities,
        notifications: seed.notifications,
        invitations: seed.invitations,
      });
      return;
    }

    if (authProvider === 'supabase') {
      void get().syncFromSupabase();
      return;
    }

    set({ loading: true, error: null });

    const uid = user.uid;

    const unsubWorkspaces = subscribeUserWorkspaces(
      uid,
      async (workspaces) => {
        // Bootstrap a real starter workspace for newly signed-in verified users
        if (workspaces.length === 0 && !didAutoBootstrap && user.emailVerified) {
          didAutoBootstrap = true;
          try {
            const ws = await fbCreateWorkspace({
              user,
              profile,
              name: `${profile?.fullName?.split(' ')[0] || 'My'} Workspace`,
              description: 'Primary collaborative workspace for projects and sprints.',
              avatarColor: '#635BFF',
            });
            if (ws) {
              await fbCreateBoard({
                workspace: ws,
                user,
                title: 'Getting Started Board',
                description: 'Organize tasks, drag cards across lanes, and track deadlines.',
                background: 'indigo',
                visibility: 'workspace',
                templateId: 'project-management',
              });
            }
          } catch (err) {
            console.error('Initial workspace setup failed:', err);
          }
        }

        // Sync member listeners for every workspace the user belongs to
        workspaces.forEach((ws) => {
          if (!memberUnsubs[ws.id]) {
            memberUnsubs[ws.id] = subscribeWorkspaceMembers(ws.id, uid, (members) => {
              set((state) => ({
                workspaceMembers: {
                  ...state.workspaceMembers,
                  [ws.id]: members,
                },
              }));
            });
          }
        });

        set((state) => ({
          workspaces,
          loading: false,
          activeWorkspaceId:
            state.activeWorkspaceId && workspaces.some((w) => w.id === state.activeWorkspaceId)
              ? state.activeWorkspaceId
              : workspaces[0]?.id || null,
        }));
      },
      (err) => set({ error: err.message, loading: false })
    );

    const unsubBoards = subscribeUserBoards(uid, (boards) => set({ boards }));
    const unsubLists = subscribeUserLists(uid, (lists) => set({ lists }));
    const unsubTasks = subscribeUserTasks(uid, (tasks) => set({ tasks }));
    const unsubActivities = subscribeUserActivities(uid, (activities) => set({ activities }));
    const unsubNotifications = subscribeUserNotifications(uid, (notifications) =>
      set({ notifications })
    );
    const unsubInvitations = subscribeUserInvitations(uid, user.email || '', (invitations) =>
      set({ invitations })
    );

    activeUnsubs = [
      unsubWorkspaces,
      unsubBoards,
      unsubLists,
      unsubTasks,
      unsubActivities,
      unsubNotifications,
      unsubInvitations,
    ];
  },

  syncFromSupabase: async () => {
    const { user, profile } = useAuthStore.getState();
    if (!user || !supabase || !isSupabaseConfigured()) {
      set({ loading: false });
      return;
    }
    set({ loading: true, error: null });
    const uid = user.uid;

    try {
      // 1. Fetch workspaces owned or joined by user
      const { data: memberRows } = await supabase
        .from('workspace_members')
        .select('workspace_id, role, joined_at')
        .eq('user_id', uid);

      const wsIds: string[] = (memberRows || []).map((m: { workspace_id: string }) => m.workspace_id);

      const { data: ownedWs } = await supabase
        .from('workspaces')
        .select('*')
        .eq('owner_id', uid);

      if (ownedWs) {
        ownedWs.forEach((w: { id: string }) => {
          if (!wsIds.includes(w.id)) wsIds.push(w.id);
        });
      }

      let loadedWorkspaces: Workspace[] = [];

      if (wsIds.length > 0) {
        const { data: wsData } = await supabase
          .from('workspaces')
          .select('*')
          .in('id', wsIds);

        if (wsData && wsData.length > 0) {
          loadedWorkspaces = wsData.map((w: Record<string, any>) => ({
            id: w.id,
            name: w.name,
            description: w.description || '',
            avatarColor: w.avatar_color || '#635BFF',
            ownerId: w.owner_id,
            memberIds: [uid],
            createdAt: w.created_at,
            updatedAt: w.updated_at,
          }));
        }
      }

      // If user has no workspaces yet, bootstrap a starter workspace in Supabase
      if (loadedWorkspaces.length === 0) {
        const wsName = `${profile?.fullName?.split(' ')[0] || 'My'} Workspace`;
        const { data: newWs, error: newWsErr } = await supabase
          .from('workspaces')
          .insert({
            name: wsName,
            description: 'Primary collaborative workspace for projects and sprints.',
            avatar_color: '#635BFF',
            owner_id: uid,
          })
          .select()
          .single();

        if (newWs && !newWsErr) {
          await supabase.from('workspace_members').insert({
            workspace_id: newWs.id,
            user_id: uid,
            role: 'owner',
          });

          loadedWorkspaces = [
            {
              id: newWs.id,
              name: newWs.name,
              description: newWs.description || '',
              avatarColor: newWs.avatar_color || '#635BFF',
              ownerId: newWs.owner_id,
              memberIds: [uid],
              createdAt: newWs.created_at,
              updatedAt: newWs.updated_at,
            },
          ];

          // Create starter board
          const { data: newBoard } = await supabase
            .from('boards')
            .insert({
              workspace_id: newWs.id,
              title: 'Getting Started Board',
              description: 'Organize tasks, drag cards across lanes, and track deadlines.',
              background: 'indigo',
              visibility: 'workspace',
              created_by: uid,
              labels: DEFAULT_BOARD_LABELS,
            })
            .select()
            .single();

          if (newBoard) {
            await supabase.from('lists').insert([
              { board_id: newBoard.id, title: 'To Do', position: 1000 },
              { board_id: newBoard.id, title: 'In Progress', position: 2000 },
              { board_id: newBoard.id, title: 'Done', position: 3000 },
            ]);
          }
        }
      }

      const activeWsId = loadedWorkspaces[0]?.id || null;
      let boards: Board[] = [];
      let lists: KanbanList[] = [];
      let tasks: Task[] = [];

      if (loadedWorkspaces.length > 0) {
        const allWsIds = loadedWorkspaces.map((w) => w.id);
        const { data: bData } = await supabase
          .from('boards')
          .select('*')
          .in('workspace_id', allWsIds);

        if (bData) {
          boards = bData.map((b: Record<string, any>) => ({
            id: b.id,
            workspaceId: b.workspace_id,
            title: b.title,
            description: b.description || '',
            background: b.background || 'indigo',
            visibility: b.visibility || 'workspace',
            isArchived: b.is_archived || false,
            ownerId: b.created_by || uid,
            memberIds: [uid],
            labels: b.labels || DEFAULT_BOARD_LABELS,
            createdAt: b.created_at,
            updatedAt: b.updated_at,
          }));
        }

        const boardWorkspaceMap = new Map<string, string>();
        boards.forEach((b) => boardWorkspaceMap.set(b.id, b.workspaceId));

        const boardIds = boards.map((b) => b.id);
        if (boardIds.length > 0) {
          const { data: lData } = await supabase
            .from('lists')
            .select('*')
            .in('board_id', boardIds)
            .order('position', { ascending: true });

          if (lData) {
            lists = lData.map((l: Record<string, any>) => ({
              id: l.id,
              boardId: l.board_id,
              workspaceId: boardWorkspaceMap.get(l.board_id) || '',
              title: l.title,
              position: l.position,
              ownerId: uid,
              memberIds: [uid],
              createdAt: l.created_at,
              updatedAt: l.updated_at,
            }));
          }

          const { data: tData } = await supabase
            .from('tasks')
            .select('*')
            .in('board_id', boardIds)
            .order('position', { ascending: true });

          if (tData) {
            tasks = tData.map((t: Record<string, any>) => ({
              id: t.id,
              boardId: t.board_id,
              workspaceId: boardWorkspaceMap.get(t.board_id) || '',
              listId: t.list_id,
              title: t.title,
              description: t.description || '',
              priority: t.priority || 'medium',
              position: t.position,
              dueDate: t.due_date || null,
              isArchived: false,
              labelIds: [],
              assigneeIds: [],
              checklists: [],
              attachments: [],
              commentCount: 0,
              ownerId: t.created_by || uid,
              memberIds: [uid],
              createdAt: t.created_at,
              updatedAt: t.updated_at,
            }));
          }
        }
      }

      set({
        loading: false,
        error: null,
        workspaces: loadedWorkspaces,
        activeWorkspaceId: activeWsId,
        boards,
        lists,
        tasks,
      });
    } catch (err) {
      console.warn('Error loading Supabase user data, falling back gracefully:', err);
      const seed = createGuestSeedState();
      set({
        loading: false,
        error: null,
        workspaces: seed.workspaces,
        activeWorkspaceId: seed.workspaces[0]?.id || null,
        boards: seed.boards,
        lists: seed.lists,
        tasks: seed.tasks,
        comments: seed.comments,
        activities: seed.activities,
        notifications: seed.notifications,
        invitations: seed.invitations,
      });
    }
  },

  getWorkspaceRole: (workspaceId) => {
    const { user } = useAuthStore.getState();
    if (!user || !workspaceId) return 'viewer';
    const members = get().workspaceMembers[workspaceId] || [];
    const found = members.find((m) => m.userId === user.uid || m.id === user.uid);
    if (found) return found.role;
    const ws = get().workspaces.find((w) => w.id === workspaceId);
    if (ws?.ownerId === user.uid) return 'owner';
    return 'viewer';
  },

  canWriteWorkspace: (workspaceId) => {
    const role = get().getWorkspaceRole(workspaceId);
    return Boolean(WORKSPACE_ROLES[role]?.canWrite);
  },

  // ==================== WORKSPACES ====================
  createWorkspace: async ({ name, description = '', avatarColor = '#635BFF' }) => {
    const { user, profile, isGuestMode } = useAuthStore.getState();
    const toast = useToastStore.getState().addToast;
    if (!user) return null;

    if (isGuestMode) {
      const id = generateId('ws');
      const nowIso = new Date().toISOString();
      const ws: Workspace = {
        id,
        name: name.trim(),
        description: description.trim(),
        avatarColor,
        ownerId: user.uid,
        memberIds: [user.uid],
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      const ownerMember: WorkspaceMember = {
        id: user.uid,
        workspaceId: id,
        userId: user.uid,
        fullName: profile?.fullName || user.displayName || 'Owner',
        avatarUrl: profile?.avatarUrl || '',
        role: 'owner',
        memberIds: [user.uid],
        joinedAt: nowIso,
      };
      set((state) => ({
        workspaces: [...state.workspaces, ws],
        activeWorkspaceId: id,
        workspaceMembers: { ...state.workspaceMembers, [id]: [ownerMember] },
      }));
      toast({ title: 'Workspace created', message: `"${ws.name}" is ready.`, variant: 'success' });
      return ws;
    }

    try {
      const ws = await fbCreateWorkspace({ user, profile, name, description, avatarColor });
      if (ws) {
        set({ activeWorkspaceId: ws.id });
        toast({
          title: 'Workspace created',
          message: `"${ws.name}" saved to cloud.`,
          variant: 'success',
        });
      }
      return ws;
    } catch (err) {
      toast({
        title: 'Could not create workspace',
        message: errMessage(err),
        variant: 'error',
      });
      return null;
    }
  },

  updateWorkspace: async (workspaceId, updates) => {
    const { isGuestMode } = useAuthStore.getState();
    const toast = useToastStore.getState().addToast;
    const prev = get().workspaces;

    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.id === workspaceId ? { ...w, ...updates, updatedAt: new Date().toISOString() } : w
      ),
    }));

    if (isGuestMode) {
      toast({ title: 'Workspace updated', variant: 'success' });
      return;
    }

    try {
      await fbUpdateWorkspace(workspaceId, updates);
      toast({ title: 'Workspace updated', variant: 'success' });
    } catch (err) {
      set({ workspaces: prev });
      toast({ title: 'Update failed', message: errMessage(err), variant: 'error' });
    }
  },

  deleteWorkspace: async (workspaceId) => {
    const { isGuestMode } = useAuthStore.getState();
    const toast = useToastStore.getState().addToast;
    const prevWorkspaces = get().workspaces;

    set((state) => {
      const nextWorkspaces = state.workspaces.filter((w) => w.id !== workspaceId);
      return {
        workspaces: nextWorkspaces,
        boards: state.boards.filter((b) => b.workspaceId !== workspaceId),
        lists: state.lists.filter((l) => l.workspaceId !== workspaceId),
        tasks: state.tasks.filter((t) => t.workspaceId !== workspaceId),
        activeWorkspaceId:
          state.activeWorkspaceId === workspaceId
            ? nextWorkspaces[0]?.id || null
            : state.activeWorkspaceId,
      };
    });

    if (isGuestMode) {
      toast({ title: 'Workspace deleted', variant: 'info' });
      return;
    }

    try {
      await fbDeleteWorkspace(workspaceId);
      toast({ title: 'Workspace deleted', variant: 'info' });
    } catch (err) {
      set({ workspaces: prevWorkspaces });
      toast({ title: 'Delete failed', message: errMessage(err), variant: 'error' });
    }
  },

  inviteMember: async (workspaceId, email, role) => {
    const { user, profile, isGuestMode } = useAuthStore.getState();
    const toast = useToastStore.getState().addToast;
    const workspace = get().workspaces.find((w) => w.id === workspaceId);
    if (!workspace || !user) return null;

    if (isGuestMode) {
      const inv: Invitation = {
        id: generateId('inv'),
        workspaceId,
        workspaceName: workspace.name,
        inviterId: user.uid,
        inviterName: profile?.fullName || user.displayName || 'Team Member',
        inviteeEmail: email.trim().toLowerCase(),
        role,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      const notif: NotificationItem = {
        id: generateId('ntf'),
        userId: user.uid,
        actorId: user.uid,
        title: 'Workspace invitation sent',
        message: `Invited ${inv.inviteeEmail} to "${workspace.name}" as ${role}.`,
        type: 'invitation',
        isRead: false,
        link: `/workspace/${workspaceId}`,
        createdAt: new Date().toISOString(),
      };
      set((state) => ({
        invitations: [inv, ...state.invitations],
        notifications: [notif, ...state.notifications],
      }));
      toast({
        title: 'Invitation sent',
        message: `Invited ${inv.inviteeEmail} as ${role}.`,
        variant: 'success',
      });
      return inv;
    }

    try {
      const inv = await fbInviteMember({ workspace, inviter: user, profile, email, role });
      toast({
        title: 'Invitation sent',
        message: `Invited ${email} as ${role}.`,
        variant: 'success',
      });
      return inv;
    } catch (err) {
      toast({ title: 'Invitation failed', message: errMessage(err), variant: 'error' });
      return null;
    }
  },

  updateMemberRole: async (workspaceId, memberId, role) => {
    const { isGuestMode } = useAuthStore.getState();
    const toast = useToastStore.getState().addToast;
    const prev = get().workspaceMembers[workspaceId] || [];

    set((state) => ({
      workspaceMembers: {
        ...state.workspaceMembers,
        [workspaceId]: (state.workspaceMembers[workspaceId] || []).map((m) =>
          m.id === memberId || m.userId === memberId ? { ...m, role } : m
        ),
      },
    }));

    if (isGuestMode) {
      toast({ title: 'Member role updated', variant: 'success' });
      return;
    }

    try {
      await fbUpdateMemberRole(workspaceId, memberId, role);
      toast({ title: 'Member role updated', variant: 'success' });
    } catch (err) {
      set((state) => ({
        workspaceMembers: { ...state.workspaceMembers, [workspaceId]: prev },
      }));
      toast({ title: 'Role update failed', message: errMessage(err), variant: 'error' });
    }
  },

  removeMember: async (workspaceId, memberId) => {
    const { isGuestMode } = useAuthStore.getState();
    const toast = useToastStore.getState().addToast;
    const workspace = get().workspaces.find((w) => w.id === workspaceId);
    if (!workspace) return;
    const prevMembers = get().workspaceMembers[workspaceId] || [];

    set((state) => ({
      workspaceMembers: {
        ...state.workspaceMembers,
        [workspaceId]: prevMembers.filter((m) => m.id !== memberId && m.userId !== memberId),
      },
    }));

    if (isGuestMode) {
      toast({ title: 'Member removed', variant: 'info' });
      return;
    }

    try {
      await fbRemoveMember(workspace, memberId);
      toast({ title: 'Member removed', variant: 'info' });
    } catch (err) {
      set((state) => ({
        workspaceMembers: { ...state.workspaceMembers, [workspaceId]: prevMembers },
      }));
      toast({ title: 'Remove failed', message: errMessage(err), variant: 'error' });
    }
  },

  // ==================== BOARDS & LISTS ====================
  createBoard: async ({
    workspaceId,
    title,
    description = '',
    background,
    visibility = 'workspace',
    templateId = 'blank',
  }) => {
    const { user, isGuestMode } = useAuthStore.getState();
    const toast = useToastStore.getState().addToast;
    const workspace = get().workspaces.find((w) => w.id === workspaceId);
    if (!workspace || !user) return null;

    if (isGuestMode) {
      const template = BOARD_TEMPLATES.find((t) => t.id === templateId) || BOARD_TEMPLATES[0];
      const boardId = generateId('brd');
      const nowIso = new Date().toISOString();
      const memberIds = workspace.memberIds || [user.uid];

      const board: Board = {
        id: boardId,
        workspaceId,
        title: title.trim(),
        description: (description || template.description).trim(),
        background: background || template.background || 'slate',
        visibility,
        isArchived: false,
        ownerId: user.uid,
        memberIds,
        labels: DEFAULT_BOARD_LABELS,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const newLists: KanbanList[] = template.lists.map((listTitle, idx) => ({
        id: generateId('lst'),
        boardId,
        workspaceId,
        title: listTitle,
        position: (idx + 1) * POSITION_STEP,
        ownerId: user.uid,
        memberIds,
        createdAt: nowIso,
        updatedAt: nowIso,
      }));

      const now = new Date();
      const newTasks: Task[] = (template.sampleTasks || []).map((sample, idx) => {
        const targetList = newLists[sample.listIndex] || newLists[0];
        const due = new Date(now.getTime() + (sample.daysOffset || 0) * 86400000);
        return {
          id: generateId('tsk'),
          boardId,
          workspaceId,
          listId: targetList.id,
          title: sample.title,
          description: '',
          priority: sample.priority || 'medium',
          status: targetList.title,
          dueDate: due.toISOString().slice(0, 10),
          position: (idx + 1) * POSITION_STEP,
          isArchived: false,
          assigneeIds: [user.uid],
          labelIds: sample.labelIds || [],
          checklists: [],
          attachments: [],
          commentCount: 0,
          ownerId: user.uid,
          memberIds,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
      });

      set((state) => ({
        boards: [board, ...state.boards],
        lists: [...state.lists, ...newLists],
        tasks: [...state.tasks, ...newTasks],
      }));
      toast({ title: 'Board created', message: `"${board.title}" is live.`, variant: 'success' });
      return board;
    }

    try {
      const board = await fbCreateBoard({
        workspace,
        user,
        title,
        description,
        background,
        visibility,
        templateId,
      });
      toast({
        title: 'Board created',
        message: `"${title}" saved to database.`,
        variant: 'success',
      });
      return board;
    } catch (err) {
      toast({ title: 'Failed to create board', message: errMessage(err), variant: 'error' });
      return null;
    }
  },

  updateBoard: async (boardId, updates) => {
    const { isGuestMode } = useAuthStore.getState();
    const toast = useToastStore.getState().addToast;
    const prev = get().boards;

    set((state) => ({
      boards: state.boards.map((b) =>
        b.id === boardId ? { ...b, ...updates, updatedAt: new Date().toISOString() } : b
      ),
    }));

    if (isGuestMode) {
      toast({ title: 'Board updated', variant: 'success' });
      return;
    }

    try {
      await fbUpdateBoard(boardId, updates);
      toast({ title: 'Board updated', variant: 'success' });
    } catch (err) {
      set({ boards: prev });
      toast({ title: 'Board update failed', message: errMessage(err), variant: 'error' });
    }
  },

  deleteBoard: async (boardId) => {
    const { isGuestMode } = useAuthStore.getState();
    const toast = useToastStore.getState().addToast;
    const prev = get().boards;

    set((state) => ({
      boards: state.boards.filter((b) => b.id !== boardId),
      lists: state.lists.filter((l) => l.boardId !== boardId),
      tasks: state.tasks.filter((t) => t.boardId !== boardId),
    }));

    if (isGuestMode) {
      toast({ title: 'Board deleted', variant: 'info' });
      return;
    }

    try {
      await fbDeleteBoard(boardId);
      toast({ title: 'Board deleted', variant: 'info' });
    } catch (err) {
      set({ boards: prev });
      toast({ title: 'Delete failed', message: errMessage(err), variant: 'error' });
    }
  },

  createList: async (boardId, title) => {
    const { user, isGuestMode } = useAuthStore.getState();
    const toast = useToastStore.getState().addToast;
    const board = get().boards.find((b) => b.id === boardId);
    if (!board || !user) return null;

    const boardLists = get().lists.filter((l) => l.boardId === boardId);
    const nextPos = calculateNextPosition(boardLists);

    if (isGuestMode) {
      const list: KanbanList = {
        id: generateId('lst'),
        boardId,
        workspaceId: board.workspaceId,
        title: title.trim(),
        position: nextPos,
        ownerId: user.uid,
        memberIds: board.memberIds || [user.uid],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      set((state) => ({ lists: [...state.lists, list] }));
      return list;
    }

    try {
      return await fbCreateList({ board, user, title, position: nextPos });
    } catch (err) {
      toast({ title: 'Failed to create list', message: errMessage(err), variant: 'error' });
      return null;
    }
  },

  renameList: async (listId, title) => {
    const { isGuestMode } = useAuthStore.getState();
    const toast = useToastStore.getState().addToast;
    const prev = get().lists;

    set((state) => ({
      lists: state.lists.map((l) => (l.id === listId ? { ...l, title: title.trim() } : l)),
    }));

    if (isGuestMode) return;

    try {
      await fbUpdateList(listId, { title });
    } catch (err) {
      set({ lists: prev });
      toast({ title: 'Rename failed', message: errMessage(err), variant: 'error' });
    }
  },

  deleteList: async (listId) => {
    const { isGuestMode } = useAuthStore.getState();
    const toast = useToastStore.getState().addToast;
    const prevLists = get().lists;
    const prevTasks = get().tasks;

    set((state) => ({
      lists: state.lists.filter((l) => l.id !== listId),
      tasks: state.tasks.filter((t) => t.listId !== listId),
    }));

    if (isGuestMode) {
      toast({ title: 'List removed', variant: 'info' });
      return;
    }

    try {
      await fbDeleteList(listId);
      toast({ title: 'List removed', variant: 'info' });
    } catch (err) {
      set({ lists: prevLists, tasks: prevTasks });
      toast({ title: 'Could not delete list', message: errMessage(err), variant: 'error' });
    }
  },

  reorderBoardLists: async (boardId, activeId, overId) => {
    const { isGuestMode } = useAuthStore.getState();
    const toast = useToastStore.getState().addToast;
    const prevLists = get().lists;

    const boardLists = prevLists.filter((l) => l.boardId === boardId);
    const otherLists = prevLists.filter((l) => l.boardId !== boardId);
    const { nextLists, patches } = reorderLists(boardLists, activeId, overId);

    if (!patches.length) return;

    // Optimistic UI update
    set({ lists: [...otherLists, ...nextLists] });

    if (isGuestMode) return;

    try {
      await batchPersistListPositions(patches);
    } catch (err) {
      // Rollback optimistic update on failure
      set({ lists: prevLists });
      toast({
        title: 'List reorder failed — reverted',
        message: errMessage(err),
        variant: 'error',
      });
    }
  },

  // ==================== TASKS & DRAG-AND-DROP ====================
  createTask: async (boardId, listId, data) => {
    const { user, profile, isGuestMode } = useAuthStore.getState();
    const toast = useToastStore.getState().addToast;
    const board = get().boards.find((b) => b.id === boardId);
    const list = get().lists.find((l) => l.id === listId);
    if (!board || !list || !user) return null;

    const listTasks = get().tasks.filter((t) => t.listId === listId && !t.isArchived);
    const nextPos = calculateNextPosition(listTasks);

    if (isGuestMode) {
      const nowIso = new Date().toISOString();
      const task: Task = {
        id: generateId('tsk'),
        boardId,
        workspaceId: board.workspaceId,
        listId,
        title: data.title.trim(),
        description: (data.description || '').trim(),
        priority: data.priority || 'medium',
        status: list.title,
        dueDate: data.dueDate || null,
        position: nextPos,
        isArchived: false,
        assigneeIds: data.assigneeIds?.length ? data.assigneeIds : [user.uid],
        labelIds: data.labelIds || [],
        checklists: data.checklists || [],
        attachments: data.attachments || [],
        commentCount: 0,
        ownerId: user.uid,
        memberIds: board.memberIds || [user.uid],
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      const activity: Activity = {
        id: generateId('act'),
        boardId,
        workspaceId: board.workspaceId,
        taskId: task.id,
        userId: user.uid,
        actorName: profile?.fullName || user.displayName || 'Member',
        action: `created "${task.title}" in ${list.title}`,
        metadata: {},
        memberIds: task.memberIds,
        createdAt: nowIso,
      };
      set((state) => ({
        tasks: [...state.tasks, task],
        activities: [activity, ...state.activities],
      }));
      return task;
    }

    try {
      return await fbCreateTask({ board, list, user, profile, data, position: nextPos });
    } catch (err) {
      toast({ title: 'Could not create task', message: errMessage(err), variant: 'error' });
      return null;
    }
  },

  updateTask: async (taskId, updates) => {
    const { user, profile, isGuestMode } = useAuthStore.getState();
    const toast = useToastStore.getState().addToast;
    const prevTasks = get().tasks;
    const existingTask = prevTasks.find((t) => t.id === taskId);
    if (!existingTask) return;

    // Sync status label if listId changed
    const resolvedUpdates: Partial<Task> = { ...updates };
    if (updates.listId && updates.listId !== existingTask.listId) {
      const targetList = get().lists.find((l) => l.id === updates.listId);
      if (targetList) resolvedUpdates.status = targetList.title;
    }

    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, ...resolvedUpdates, updatedAt: new Date().toISOString() } : t
      ),
    }));

    if (isGuestMode) {
      if (resolvedUpdates.listId && resolvedUpdates.listId !== existingTask.listId && user) {
        set((state) => ({
          activities: [
            {
              id: generateId('act'),
              boardId: existingTask.boardId,
              workspaceId: existingTask.workspaceId,
              taskId,
              userId: user.uid,
              actorName: profile?.fullName || user.displayName || 'Member',
              action: `moved "${existingTask.title}" to ${resolvedUpdates.status || ''}`,
              metadata: {},
              memberIds: existingTask.memberIds,
              createdAt: new Date().toISOString(),
            },
            ...state.activities,
          ],
        }));
      }
      return;
    }

    try {
      await fbUpdateTask(taskId, resolvedUpdates);
    } catch (err) {
      set({ tasks: prevTasks });
      toast({ title: 'Failed to save task changes', message: errMessage(err), variant: 'error' });
    }
  },

  deleteTask: async (taskId) => {
    const { isGuestMode } = useAuthStore.getState();
    const toast = useToastStore.getState().addToast;
    const prevTasks = get().tasks;

    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId),
    }));

    if (isGuestMode) {
      toast({ title: 'Task deleted', variant: 'info' });
      return;
    }

    try {
      await fbDeleteTask(taskId);
      toast({ title: 'Task deleted', variant: 'info' });
    } catch (err) {
      set({ tasks: prevTasks });
      toast({ title: 'Delete failed', message: errMessage(err), variant: 'error' });
    }
  },

  duplicateTask: async (task) => {
    return get().createTask(task.boardId, task.listId, {
      title: `${task.title} (Copy)`,
      description: task.description,
      priority: task.priority,
      dueDate: task.dueDate,
      assigneeIds: task.assigneeIds,
      labelIds: task.labelIds,
      checklists: (task.checklists || []).map((cl) => ({
        ...cl,
        id: generateId('cl'),
        items: (cl.items || []).map((item) => ({ ...item, id: generateId('ci') })),
      })),
      attachments: task.attachments || [],
    });
  },

  moveTask: async (activeTaskId, targetListId, targetIndex) => {
    const { user, profile, isGuestMode } = useAuthStore.getState();
    const toast = useToastStore.getState().addToast;
    const prevTasks = get().tasks;
    const lists = get().lists;
    const existingTask = prevTasks.find((t) => t.id === activeTaskId);
    if (!existingTask || !user) return;

    const { nextTasks, patches } = moveTaskInBoard(
      prevTasks,
      lists,
      activeTaskId,
      targetListId,
      targetIndex
    );

    if (!patches.length) return;

    // Optimistic UI update
    set({ tasks: nextTasks });

    const targetList = lists.find((l) => l.id === targetListId);
    const movedList = existingTask.listId !== targetListId;

    if (isGuestMode) {
      if (movedList && targetList) {
        set((state) => ({
          activities: [
            {
              id: generateId('act'),
              boardId: existingTask.boardId,
              workspaceId: existingTask.workspaceId,
              taskId: existingTask.id,
              userId: user.uid,
              actorName: profile?.fullName || user.displayName || 'Member',
              action: `moved "${existingTask.title}" to ${targetList.title}`,
              metadata: {},
              memberIds: existingTask.memberIds,
              createdAt: new Date().toISOString(),
            },
            ...state.activities,
          ],
        }));
      }
      return;
    }

    try {
      await batchPersistTaskPositions(patches);
      if (movedList && targetList) {
        await logActivity({
          boardId: existingTask.boardId,
          workspaceId: existingTask.workspaceId,
          taskId: existingTask.id,
          user,
          profile,
          action: `moved "${existingTask.title}" to ${targetList.title}`,
          memberIds: existingTask.memberIds,
        });
      }
    } catch (err) {
      // Rollback optimistic move on failure
      set({ tasks: prevTasks });
      toast({
        title: 'Task move failed — rolled back',
        message: errMessage(err),
        variant: 'error',
      });
    }
  },

  // ==================== COMMENTS & NOTIFICATIONS ====================
  addComment: async (task, content) => {
    const { user, profile, isGuestMode } = useAuthStore.getState();
    const toast = useToastStore.getState().addToast;
    if (!user) return null;
    const mentions = parseMentions(content);

    if (isGuestMode) {
      const nowIso = new Date().toISOString();
      const comment: Comment = {
        id: generateId('cmt'),
        taskId: task.id,
        boardId: task.boardId,
        workspaceId: task.workspaceId,
        userId: user.uid,
        authorName: profile?.fullName || user.displayName || 'Member',
        authorAvatar: profile?.avatarUrl || '',
        content: content.trim(),
        mentions,
        memberIds: task.memberIds || [user.uid],
        createdAt: nowIso,
      };
      set((state) => ({
        comments: [...state.comments, comment],
        tasks: state.tasks.map((t) =>
          t.id === task.id ? { ...t, commentCount: (t.commentCount || 0) + 1 } : t
        ),
        activities: [
          {
            id: generateId('act'),
            boardId: task.boardId,
            workspaceId: task.workspaceId,
            taskId: task.id,
            userId: user.uid,
            actorName: comment.authorName,
            action: `commented on "${task.title}"`,
            metadata: {},
            memberIds: task.memberIds || [user.uid],
            createdAt: nowIso,
          },
          ...state.activities,
        ],
      }));
      return comment;
    }

    try {
      return await fbCreateComment({ task, user, profile, content, mentions });
    } catch (err) {
      toast({ title: 'Could not post comment', message: errMessage(err), variant: 'error' });
      return null;
    }
  },

  removeComment: async (commentId, taskId) => {
    const { isGuestMode } = useAuthStore.getState();
    const task = get().tasks.find((t) => t.id === taskId);
    const currentCount = task?.commentCount || 1;

    set((state) => ({
      comments: state.comments.filter((c) => c.id !== commentId),
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, commentCount: Math.max(0, (t.commentCount || 1) - 1) } : t
      ),
    }));

    if (isGuestMode) return;
    await fbDeleteComment(commentId, taskId, currentCount);
  },

  markNotificationRead: async (notificationId) => {
    const { isGuestMode } = useAuthStore.getState();
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === notificationId ? { ...n, isRead: true } : n
      ),
    }));
    if (!isGuestMode) {
      await fbMarkNotifRead(notificationId);
    }
  },

  markAllNotificationsRead: async () => {
    const { isGuestMode } = useAuthStore.getState();
    const current = get().notifications;
    set({
      notifications: current.map((n) => ({ ...n, isRead: true })),
    });
    if (!isGuestMode) {
      await fbMarkAllNotifsRead(current);
    }
  },
}));
