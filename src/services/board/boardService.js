import {
  collection,
  doc,
  query,
  where,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase/config.js';
import { clampString, generateId, POSITION_STEP } from '../../utils/kanban.js';
import {
  BOARD_TEMPLATES,
  DEFAULT_BOARD_LABELS,
  FIELD_LIMITS,
} from '../../constants/templates.js';

export function subscribeUserBoards(uid, callback, onError) {
  const q = query(collection(db, 'boards'), where('memberIds', 'array-contains', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, 'boards');
    }
  );
}

export function subscribeUserLists(uid, callback, onError) {
  const q = query(collection(db, 'lists'), where('memberIds', 'array-contains', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      callback(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, 'lists');
    }
  );
}

export async function createBoard({
  workspace,
  user,
  title,
  description = '',
  background,
  visibility = 'workspace',
  templateId = 'blank',
}) {
  const template = BOARD_TEMPLATES.find((t) => t.id === templateId) || BOARD_TEMPLATES[0];
  const boardId = generateId('brd');
  const memberIds = workspace.memberIds?.length ? workspace.memberIds : [user.uid];

  const boardDoc = {
    workspaceId: workspace.id,
    title: clampString(title, FIELD_LIMITS.boardTitle),
    description: clampString(description || template.description, FIELD_LIMITS.boardDesc),
    background: clampString(background || template.background || 'slate', 120),
    visibility: ['workspace', 'private', 'public'].includes(visibility) ? visibility : 'workspace',
    isArchived: false,
    ownerId: user.uid,
    memberIds,
    labels: DEFAULT_BOARD_LABELS,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'boards', boardId), boardDoc);

    // Create default/template Kanban lists sequentially after board exists
    const listBatch = writeBatch(db);
    const createdLists = [];
    template.lists.forEach((listTitle, idx) => {
      const listId = generateId('lst');
      const listData = {
        boardId,
        workspaceId: workspace.id,
        title: clampString(listTitle, FIELD_LIMITS.listTitle),
        position: (idx + 1) * POSITION_STEP,
        ownerId: user.uid,
        memberIds,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      listBatch.set(doc(db, 'lists', listId), listData);
      createdLists.push({ id: listId, ...listData });
    });
    await listBatch.commit();

    // Create starter template tasks if template includes them
    if (template.sampleTasks?.length) {
      const taskBatch = writeBatch(db);
      const now = new Date();
      template.sampleTasks.forEach((sample, idx) => {
        const targetList = createdLists[sample.listIndex] || createdLists[0];
        if (!targetList) return;
        const due = new Date(now.getTime() + (sample.daysOffset || 0) * 86400000);
        const taskId = generateId('tsk');
        taskBatch.set(doc(db, 'tasks', taskId), {
          boardId,
          workspaceId: workspace.id,
          listId: targetList.id,
          title: clampString(sample.title, FIELD_LIMITS.taskTitle),
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
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      await taskBatch.commit();
    }

    return { id: boardId, ...boardDoc };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `boards/${boardId}`);
    return null;
  }
}

export async function updateBoard(boardId, updates) {
  const patch = { updatedAt: serverTimestamp() };
  if (updates.title !== undefined) patch.title = clampString(updates.title, FIELD_LIMITS.boardTitle);
  if (updates.description !== undefined) patch.description = clampString(updates.description, FIELD_LIMITS.boardDesc);
  if (updates.background !== undefined) patch.background = clampString(updates.background, 120);
  if (updates.visibility !== undefined) patch.visibility = updates.visibility;
  if (updates.isArchived !== undefined) patch.isArchived = Boolean(updates.isArchived);
  if (updates.labels !== undefined) patch.labels = updates.labels.slice(0, 20);
  if (updates.memberIds !== undefined) patch.memberIds = updates.memberIds.slice(0, FIELD_LIMITS.maxMembers);

  try {
    await updateDoc(doc(db, 'boards', boardId), patch);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `boards/${boardId}`);
  }
}

export async function deleteBoard(boardId) {
  try {
    await deleteDoc(doc(db, 'boards', boardId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `boards/${boardId}`);
  }
}

export async function createList({ board, user, title, position }) {
  const listId = generateId('lst');
  const safeTitle = clampString(title, FIELD_LIMITS.listTitle);
  const memberIds = board.memberIds?.length ? board.memberIds : [user.uid];

  try {
    await setDoc(doc(db, 'lists', listId), {
      boardId: board.id,
      workspaceId: board.workspaceId,
      title: safeTitle,
      position,
      ownerId: user.uid,
      memberIds,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return {
      id: listId,
      boardId: board.id,
      workspaceId: board.workspaceId,
      title: safeTitle,
      position,
      ownerId: user.uid,
      memberIds,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `lists/${listId}`);
    return null;
  }
}

export async function updateList(listId, updates) {
  const patch = { updatedAt: serverTimestamp() };
  if (updates.title !== undefined) patch.title = clampString(updates.title, FIELD_LIMITS.listTitle);
  if (updates.position !== undefined) patch.position = Number(updates.position);

  try {
    await updateDoc(doc(db, 'lists', listId), patch);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `lists/${listId}`);
  }
}

export async function deleteList(listId) {
  try {
    await deleteDoc(doc(db, 'lists', listId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `lists/${listId}`);
  }
}

export async function batchPersistListPositions(patches) {
  if (!patches.length) return;
  const batch = writeBatch(db);
  for (const p of patches) {
    batch.update(doc(db, 'lists', p.id), {
      position: Number(p.position),
      updatedAt: serverTimestamp(),
    });
  }
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'lists');
  }
}
