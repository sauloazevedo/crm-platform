"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Trash2, X, Check } from "lucide-react";
import styles from "./board-shell.module.css";

type Task = {
  id: string;
  title: string;
  notes: string;
};

type Lane = {
  id: string;
  title: string;
  tasks: Task[];
};

type DraftTask = {
  title: string;
  notes: string;
};

const initialLanes: Lane[] = [
  {
    id: "lane-new",
    title: "New Intake",
    tasks: [
      { id: "task-1", title: "Maria Alvarez", notes: "1040 + dependents. Waiting on intake form." },
      { id: "task-2", title: "Prime Stone LLC", notes: "Business onboarding and EIN confirmation." },
    ],
  },
  {
    id: "lane-docs",
    title: "Docs Pending",
    tasks: [
      { id: "task-3", title: "Jonathan Lee", notes: "Needs W-2 and prior year return." },
    ],
  },
  {
    id: "lane-review",
    title: "Review Queue",
    tasks: [
      { id: "task-4", title: "Santos Family", notes: "Final review before filing approval." },
    ],
  },
];

function reorder<T>(items: T[], startIndex: number, endIndex: number) {
  const copy = [...items];
  const [removed] = copy.splice(startIndex, 1);
  copy.splice(endIndex, 0, removed);
  return copy;
}

export function BoardShell() {
  const [lanes, setLanes] = useState<Lane[]>(initialLanes);
  const [newLaneTitle, setNewLaneTitle] = useState("");
  const [laneDrafts, setLaneDrafts] = useState<Record<string, DraftTask>>({});
  const [draggedLaneId, setDraggedLaneId] = useState<string | null>(null);
  const [draggedTask, setDraggedTask] = useState<{
    laneId: string;
    taskId: string;
  } | null>(null);
  const [editingTask, setEditingTask] = useState<{
    laneId: string;
    taskId: string;
    title: string;
    notes: string;
  } | null>(null);

  function addLane() {
    const title = newLaneTitle.trim();
    if (!title) return;

    setLanes((current) => [
      ...current,
      {
        id: `lane-${crypto.randomUUID()}`,
        title,
        tasks: [],
      },
    ]);
    setNewLaneTitle("");
  }

  function updateLaneTitle(laneId: string, title: string) {
    setLanes((current) =>
      current.map((lane) => (lane.id === laneId ? { ...lane, title } : lane))
    );
  }

  function deleteLane(laneId: string) {
    setLanes((current) => current.filter((lane) => lane.id !== laneId));
    setLaneDrafts((current) => {
      const next = { ...current };
      delete next[laneId];
      return next;
    });
  }

  function updateLaneDraft(laneId: string, field: keyof DraftTask, value: string) {
    setLaneDrafts((current) => ({
      ...current,
      [laneId]: {
        title: current[laneId]?.title ?? "",
        notes: current[laneId]?.notes ?? "",
        [field]: value,
      },
    }));
  }

  function addTask(laneId: string) {
    const draft = laneDrafts[laneId];
    const title = draft?.title?.trim();
    const notes = draft?.notes?.trim() ?? "";
    if (!title) return;

    setLanes((current) =>
      current.map((lane) =>
        lane.id === laneId
          ? {
              ...lane,
              tasks: [
                ...lane.tasks,
                {
                  id: `task-${crypto.randomUUID()}`,
                  title,
                  notes,
                },
              ],
            }
          : lane
      )
    );

    setLaneDrafts((current) => ({
      ...current,
      [laneId]: {
        title: "",
        notes: "",
      },
    }));
  }

  function startEditingTask(laneId: string, taskId: string) {
    const lane = lanes.find((item) => item.id === laneId);
    const task = lane?.tasks.find((item) => item.id === taskId);
    if (!task) return;

    setEditingTask({
      laneId,
      taskId,
      title: task.title,
      notes: task.notes,
    });
  }

  function saveTaskEdit() {
    if (!editingTask?.title.trim()) return;

    setLanes((current) =>
      current.map((item) =>
        item.id === editingTask.laneId
          ? {
              ...item,
              tasks: item.tasks.map((taskItem) =>
                taskItem.id === editingTask.taskId
                  ? {
                      ...taskItem,
                      title: editingTask.title.trim(),
                      notes: editingTask.notes.trim(),
                    }
                  : taskItem
              ),
            }
          : item
      )
    );

    setEditingTask(null);
  }

  function deleteTask(laneId: string, taskId: string) {
    setLanes((current) =>
      current.map((lane) =>
        lane.id === laneId
          ? { ...lane, tasks: lane.tasks.filter((task) => task.id !== taskId) }
          : lane
      )
    );
  }

  function moveTask(targetLaneId: string, targetIndex?: number) {
    if (!draggedTask) return;

    setLanes((current) => {
      const sourceLane = current.find((lane) => lane.id === draggedTask.laneId);
      const sourceTask = sourceLane?.tasks.find((task) => task.id === draggedTask.taskId);
      if (!sourceLane || !sourceTask) return current;

      const withoutTask = current.map((lane) =>
        lane.id === draggedTask.laneId
          ? { ...lane, tasks: lane.tasks.filter((task) => task.id !== draggedTask.taskId) }
          : lane
      );

      return withoutTask.map((lane) => {
        if (lane.id !== targetLaneId) return lane;

        const nextTasks = [...lane.tasks];
        const insertionIndex = targetIndex ?? nextTasks.length;
        nextTasks.splice(insertionIndex, 0, sourceTask);
        return { ...lane, tasks: nextTasks };
      });
    });

    setDraggedTask(null);
  }

  function reorderLane(targetLaneId: string) {
    if (!draggedLaneId || draggedLaneId === targetLaneId) return;

    setLanes((current) => {
      const startIndex = current.findIndex((lane) => lane.id === draggedLaneId);
      const endIndex = current.findIndex((lane) => lane.id === targetLaneId);
      if (startIndex === -1 || endIndex === -1) return current;
      return reorder(current, startIndex, endIndex);
    });
    setDraggedLaneId(null);
  }

  function reorderTaskWithinLane(laneId: string, taskId: string) {
    if (!draggedTask || draggedTask.laneId !== laneId || draggedTask.taskId === taskId) return;

    setLanes((current) =>
      current.map((lane) => {
        if (lane.id !== laneId) return lane;

        const startIndex = lane.tasks.findIndex((task) => task.id === draggedTask.taskId);
        const endIndex = lane.tasks.findIndex((task) => task.id === taskId);
        if (startIndex === -1 || endIndex === -1) return lane;

        return {
          ...lane,
          tasks: reorder(lane.tasks, startIndex, endIndex),
        };
      })
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>CRM Workflow Board</p>
          <h1>Esteiras</h1>
          <p className={styles.copy}>
            Organize o fluxo operacional em colunas tipo Trello. Crie esteiras, mova a ordem delas
            e gerencie tasks por etapa.
          </p>
        </div>

        <div className={styles.headerActions}>
          <div className={styles.navActions}>
            <Link href="/dashboard" className={styles.secondaryAction}>
              Back to dashboard
            </Link>
            <Link href="/crm" className={styles.secondaryAction}>
              Back to CRM
            </Link>
          </div>
          <div className={styles.addLaneBox}>
            <input
              value={newLaneTitle}
              onChange={(event) => setNewLaneTitle(event.target.value)}
              placeholder="New lane title"
            />
            <button type="button" onClick={addLane}>
              Create lane
            </button>
          </div>
        </div>
      </header>

      <section className={styles.board}>
        {lanes.map((lane) => (
          <article
            key={lane.id}
            className={styles.lane}
            draggable
            onDragStart={() => setDraggedLaneId(lane.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => reorderLane(lane.id)}
          >
            <div className={styles.laneHeader}>
              <input
                className={styles.laneTitle}
                value={lane.title}
                onChange={(event) => updateLaneTitle(lane.id, event.target.value)}
              />
              <button type="button" className={styles.deleteLaneButton} onClick={() => deleteLane(lane.id)}>
                <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
                <span className={styles.srOnly}>Delete lane</span>
              </button>
            </div>

            <div
              className={styles.taskList}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => moveTask(lane.id)}
            >
              {lane.tasks.map((task) => (
                <div
                  key={task.id}
                  className={styles.taskCard}
                  draggable
                  onDragStart={() => setDraggedTask({ laneId: lane.id, taskId: task.id })}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (draggedTask?.laneId === lane.id) {
                      reorderTaskWithinLane(lane.id, task.id);
                    } else {
                      const targetIndex = lane.tasks.findIndex((item) => item.id === task.id);
                      moveTask(lane.id, targetIndex);
                    }
                  }}
                >
                  {editingTask?.laneId === lane.id && editingTask.taskId === task.id ? (
                    <div className={styles.taskEditor}>
                      <input
                        value={editingTask.title}
                        onChange={(event) =>
                          setEditingTask((current) =>
                            current ? { ...current, title: event.target.value } : current
                          )
                        }
                        placeholder="Task title"
                      />
                      <textarea
                        value={editingTask.notes}
                        onChange={(event) =>
                          setEditingTask((current) =>
                            current ? { ...current, notes: event.target.value } : current
                          )
                        }
                        placeholder="Task notes"
                        rows={4}
                      />
                      <div className={styles.taskActions}>
                        <button type="button" onClick={saveTaskEdit}>
                          <Check size={16} strokeWidth={2} aria-hidden="true" />
                          <span className={styles.srOnly}>Save task</span>
                        </button>
                        <button type="button" onClick={() => setEditingTask(null)}>
                          <X size={16} strokeWidth={2} aria-hidden="true" />
                          <span className={styles.srOnly}>Cancel editing task</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className={styles.taskHeader}>
                        <strong>{task.title}</strong>
                        <div className={styles.taskActions}>
                          <button type="button" onClick={() => startEditingTask(lane.id, task.id)}>
                            <Pencil size={16} strokeWidth={2} aria-hidden="true" />
                            <span className={styles.srOnly}>Edit task</span>
                          </button>
                          <button type="button" onClick={() => deleteTask(lane.id, task.id)}>
                            <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
                            <span className={styles.srOnly}>Delete task</span>
                          </button>
                        </div>
                      </div>
                      <p>{task.notes}</p>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className={styles.newTaskComposer}>
              <input
                value={laneDrafts[lane.id]?.title ?? ""}
                onChange={(event) => updateLaneDraft(lane.id, "title", event.target.value)}
                placeholder="New task title"
              />
              <textarea
                value={laneDrafts[lane.id]?.notes ?? ""}
                onChange={(event) => updateLaneDraft(lane.id, "notes", event.target.value)}
                placeholder="Task details"
                rows={3}
              />
              <button type="button" className={styles.addTaskButton} onClick={() => addTask(lane.id)}>
                Add task
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
