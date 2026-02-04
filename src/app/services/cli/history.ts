export interface ThreadRecord {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  projectPath: string;
}

export async function listThreadHistory(): Promise<ThreadRecord[]> {
  // Placeholder: call `thread/list` via app-server.
  return [];
}

export async function resumeThread(_threadId: string) {
  // Placeholder: call `thread/resume` via app-server.
  return;
}
