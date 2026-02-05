export interface ThreadRecord {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  projectPath: string;
}

export function listThreadHistory(): Promise<ThreadRecord[]> {
  // Placeholder: call `thread/list` via app-server.
  return Promise.resolve([]);
}

export function resumeThread(_threadId: string): Promise<void> {
  // Placeholder: call `thread/resume` via app-server.
  return Promise.resolve();
}
