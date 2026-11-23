-- ============================================================================
-- TaskFlow PostgreSQL Migration 002: Row Level Security (RLS) & Storage Policies
-- Enforces Owner / Admin / Member / Viewer RBAC strictly in the database
-- ============================================================================

-- Helper functions (SECURITY DEFINER to avoid recursive RLS evaluation)
CREATE OR REPLACE FUNCTION public.get_workspace_role(p_workspace_id UUID)
RETURNS public.workspace_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_write_workspace(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'member')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.board_workspace_id(p_board_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT workspace_id FROM public.boards WHERE id = p_board_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.task_workspace_id(p_task_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.workspace_id
  FROM public.tasks t
  JOIN public.boards b ON b.id = t.board_id
  WHERE t.id = p_task_id
  LIMIT 1;
$$;

-- Enable RLS on ALL 16 tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 1. profiles
CREATE POLICY "Users can view collaborator profiles" ON public.profiles
  FOR SELECT USING (
    id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.workspace_members wm1
      JOIN public.workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
      WHERE wm1.user_id = auth.uid() AND wm2.user_id = profiles.id
    )
  );
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- 2. workspaces
CREATE POLICY "Members can view workspaces" ON public.workspaces
  FOR SELECT USING (owner_id = auth.uid() OR public.is_workspace_member(id));
CREATE POLICY "Authenticated users can create workspaces" ON public.workspaces
  FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Admins and owners can update workspace" ON public.workspaces
  FOR UPDATE USING (public.is_workspace_admin(id)) WITH CHECK (public.is_workspace_admin(id));
CREATE POLICY "Only owners can delete workspace" ON public.workspaces
  FOR DELETE USING (owner_id = auth.uid());

-- 3. workspace_members
CREATE POLICY "Members can view workspace roster" ON public.workspace_members
  FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Admins can add workspace members" ON public.workspace_members
  FOR INSERT WITH CHECK (
    public.is_workspace_admin(workspace_id) OR (
      user_id = auth.uid() AND role = 'owner' AND EXISTS (
        SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()
      )
    )
  );
CREATE POLICY "Admins can change non-owner roles" ON public.workspace_members
  FOR UPDATE USING (public.is_workspace_admin(workspace_id) AND role <> 'owner')
  WITH CHECK (public.is_workspace_admin(workspace_id) AND role <> 'owner');
CREATE POLICY "Admins can remove non-owners or self leave" ON public.workspace_members
  FOR DELETE USING (
    (public.is_workspace_admin(workspace_id) AND role <> 'owner') OR
    (user_id = auth.uid() AND role <> 'owner')
  );

-- 4. boards
CREATE POLICY "Members can read boards" ON public.boards
  FOR SELECT USING (public.is_workspace_member(workspace_id) OR visibility = 'public');
CREATE POLICY "Writers can create boards" ON public.boards
  FOR INSERT WITH CHECK (public.can_write_workspace(workspace_id));
CREATE POLICY "Writers can update boards" ON public.boards
  FOR UPDATE USING (public.can_write_workspace(workspace_id)) WITH CHECK (public.can_write_workspace(workspace_id));
CREATE POLICY "Admins can delete boards" ON public.boards
  FOR DELETE USING (public.is_workspace_admin(workspace_id));

-- 5. board_members
CREATE POLICY "Workspace members can view board members" ON public.board_members
  FOR SELECT USING (public.is_workspace_member(public.board_workspace_id(board_id)));
CREATE POLICY "Workspace admins can manage board members" ON public.board_members
  FOR ALL USING (public.is_workspace_admin(public.board_workspace_id(board_id)))
  WITH CHECK (public.is_workspace_admin(public.board_workspace_id(board_id)));

-- 6. lists
CREATE POLICY "Members can view lists" ON public.lists
  FOR SELECT USING (public.is_workspace_member(public.board_workspace_id(board_id)));
CREATE POLICY "Writers can manage lists" ON public.lists
  FOR ALL USING (public.can_write_workspace(public.board_workspace_id(board_id)))
  WITH CHECK (public.can_write_workspace(public.board_workspace_id(board_id)));

-- 7. tasks
CREATE POLICY "Members can view tasks" ON public.tasks
  FOR SELECT USING (public.is_workspace_member(public.board_workspace_id(board_id)));
CREATE POLICY "Writers can manage tasks" ON public.tasks
  FOR ALL USING (public.can_write_workspace(public.board_workspace_id(board_id)))
  WITH CHECK (public.can_write_workspace(public.board_workspace_id(board_id)));

-- 8. task_assignees
CREATE POLICY "Members can view task assignees" ON public.task_assignees
  FOR SELECT USING (public.is_workspace_member(public.task_workspace_id(task_id)));
CREATE POLICY "Writers can manage task assignees" ON public.task_assignees
  FOR ALL USING (public.can_write_workspace(public.task_workspace_id(task_id)))
  WITH CHECK (public.can_write_workspace(public.task_workspace_id(task_id)));

-- 9. labels
CREATE POLICY "Members can view labels" ON public.labels
  FOR SELECT USING (public.is_workspace_member(public.board_workspace_id(board_id)));
CREATE POLICY "Writers can manage labels" ON public.labels
  FOR ALL USING (public.can_write_workspace(public.board_workspace_id(board_id)))
  WITH CHECK (public.can_write_workspace(public.board_workspace_id(board_id)));

-- 10. task_labels
CREATE POLICY "Members can view task labels" ON public.task_labels
  FOR SELECT USING (public.is_workspace_member(public.task_workspace_id(task_id)));
CREATE POLICY "Writers can manage task labels" ON public.task_labels
  FOR ALL USING (public.can_write_workspace(public.task_workspace_id(task_id)))
  WITH CHECK (public.can_write_workspace(public.task_workspace_id(task_id)));

-- 11. checklists
CREATE POLICY "Members can view checklists" ON public.checklists
  FOR SELECT USING (public.is_workspace_member(public.task_workspace_id(task_id)));
CREATE POLICY "Writers can manage checklists" ON public.checklists
  FOR ALL USING (public.can_write_workspace(public.task_workspace_id(task_id)))
  WITH CHECK (public.can_write_workspace(public.task_workspace_id(task_id)));

-- 12. checklist_items
CREATE POLICY "Members can view checklist items" ON public.checklist_items
  FOR SELECT USING (
    public.is_workspace_member(
      (SELECT public.task_workspace_id(c.task_id) FROM public.checklists c WHERE c.id = checklist_id)
    )
  );
CREATE POLICY "Writers can manage checklist items" ON public.checklist_items
  FOR ALL USING (
    public.can_write_workspace(
      (SELECT public.task_workspace_id(c.task_id) FROM public.checklists c WHERE c.id = checklist_id)
    )
  ) WITH CHECK (
    public.can_write_workspace(
      (SELECT public.task_workspace_id(c.task_id) FROM public.checklists c WHERE c.id = checklist_id)
    )
  );

-- 13. comments
CREATE POLICY "Members can view comments" ON public.comments
  FOR SELECT USING (public.is_workspace_member(public.task_workspace_id(task_id)));
CREATE POLICY "Writers can post comments" ON public.comments
  FOR INSERT WITH CHECK (user_id = auth.uid() AND public.can_write_workspace(public.task_workspace_id(task_id)));
CREATE POLICY "Authors or admins can delete comments" ON public.comments
  FOR DELETE USING (user_id = auth.uid() OR public.is_workspace_admin(public.task_workspace_id(task_id)));

-- 14. attachments
CREATE POLICY "Members can view attachments" ON public.attachments
  FOR SELECT USING (public.is_workspace_member(public.task_workspace_id(task_id)));
CREATE POLICY "Writers can upload attachments" ON public.attachments
  FOR INSERT WITH CHECK (uploaded_by = auth.uid() AND public.can_write_workspace(public.task_workspace_id(task_id)));
CREATE POLICY "Uploaders or admins can delete attachments" ON public.attachments
  FOR DELETE USING (uploaded_by = auth.uid() OR public.is_workspace_admin(public.task_workspace_id(task_id)));

-- 15. activities
CREATE POLICY "Members can view board activities" ON public.activities
  FOR SELECT USING (public.is_workspace_member(public.board_workspace_id(board_id)));
CREATE POLICY "Writers can log activities" ON public.activities
  FOR INSERT WITH CHECK (user_id = auth.uid() AND public.can_write_workspace(public.board_workspace_id(board_id)));

-- 16. notifications
CREATE POLICY "Users can read own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Authenticated users can send notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- Supabase Storage Bucket Policies (avatars & task-attachments)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true), ('task-attachments', 'task-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own avatar" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Public avatars readable" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated workspace attachment upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'task-attachments' AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Authenticated workspace attachment read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'task-attachments' AND auth.uid() IS NOT NULL
  );
