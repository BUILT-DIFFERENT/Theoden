import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { diffStatsFromText } from "@/app/services/cli/diffSummary";
import { useThreadDiffText } from "@/app/services/cli/useThreadDiff";
import {
  commitChanges,
  createPullRequest,
  getCurrentBranch,
  pushBranch,
} from "@/app/services/git/commits";
import {
  checkoutBranch,
  createBranch,
  createWorkspace,
} from "@/app/services/git/worktrees";
import { useThreadMetadata } from "@/app/state/threadMetadata";
import { useThreadUi } from "@/app/state/threadUi";
import type { ThreadDetail } from "@/app/types";

interface ThreadModalsProps {
  thread?: ThreadDetail;
}

type ModalStatus = "idle" | "running" | "done" | "error";

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-ink-900/90 p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg text-ink-50">{title}</h3>
          <button
            className="rounded-full border border-white/10 px-2 py-1 text-xs text-ink-300 hover:border-flare-300"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="mt-4 space-y-4 text-sm text-ink-300">{children}</div>
      </div>
    </div>
  );
}

function StatusIndicator({ status }: { status: ModalStatus }) {
  if (status === "running") {
    return <Loader2 className="h-4 w-4 animate-spin text-ink-400" />;
  }
  if (status === "done") {
    return <CheckCircle2 className="h-4 w-4 text-emerald-300" />;
  }
  if (status === "error") {
    return <AlertTriangle className="h-4 w-4 text-rose-300" />;
  }
  return null;
}

export function ThreadModals({ thread }: ThreadModalsProps) {
  const { activeModal, setActiveModal } = useThreadUi();
  const { metadata, setMetadata } = useThreadMetadata(thread?.id);
  const [branchNameInput, setBranchNameInput] = useState(
    metadata.branch ?? thread?.branch ?? "feature/new-branch",
  );
  const [commitMessage, setCommitMessage] = useState("");
  const [commitOption, setCommitOption] = useState<
    "commit" | "commit_push" | "commit_pr"
  >("commit");
  const [includeUnstaged, setIncludeUnstaged] = useState(true);

  const [worktreeStatus, setWorktreeStatus] = useState<ModalStatus>("idle");
  const [worktreeLogs, setWorktreeLogs] = useState<string[]>([]);

  const [branchStatus, setBranchStatus] = useState<ModalStatus>("idle");
  const [branchLogs, setBranchLogs] = useState<string[]>([]);

  const [commitStatus, setCommitStatus] = useState<ModalStatus>("idle");
  const [commitLogs, setCommitLogs] = useState<string[]>([]);
  const [commitBranch, setCommitBranch] = useState<string>("main");

  const [prStatus, setPrStatus] = useState<ModalStatus>("idle");
  const [prLogs, setPrLogs] = useState<string[]>([]);
  const [prStepState, setPrStepState] = useState({
    committed: false,
    pushed: false,
    created: false,
  });

  const handleClose = () => setActiveModal(null);

  const worktreePath = metadata.worktreePath;
  const workspaceCwd = worktreePath ?? thread?.subtitle ?? "";
  const strategy = thread?.worktreeStrategy ?? "clone";
  const threadId = thread?.id ?? `thread-${Date.now()}`;
  const baseBranch = "main";
  const branchInputId = "thread-branch-name";
  const commitMessageId = "thread-commit-message";
  const liveDiffText = useThreadDiffText(thread?.id, thread?.diffText ?? "");
  const hasLiveDiff = liveDiffText.trim().length > 0;
  const liveDiffStats = hasLiveDiff
    ? diffStatsFromText(liveDiffText)
    : {
        additions: thread?.diffSummary.additions ?? 0,
        deletions: thread?.diffSummary.deletions ?? 0,
      };

  useEffect(() => {
    if (metadata.branch) {
      setBranchNameInput(metadata.branch);
      return;
    }
    if (thread?.branch) {
      setBranchNameInput(thread.branch);
    }
  }, [metadata.branch, thread?.branch]);

  useEffect(() => {
    if (activeModal !== "worktree") return;
    if (!thread?.subtitle) {
      setWorktreeStatus("error");
      setWorktreeLogs(["Missing repo path for worktree."]);
      return;
    }
    if (worktreeStatus !== "idle") return;
    setWorktreeStatus("running");
    setWorktreeLogs(["Creating worktree and running setup."]);
    const run = async () => {
      try {
        const result = await createWorkspace({
          repoPath: thread.subtitle,
          threadId,
          baseBranch,
          strategy,
          targetPath: worktreePath ?? undefined,
        });
        setWorktreeLogs(result.logs);
        setMetadata({ worktreePath: result.info.path });
        setWorktreeStatus("done");
      } catch (error) {
        setWorktreeStatus("error");
        setWorktreeLogs([
          "Failed to create worktree.",
          error instanceof Error ? error.message : "Unknown error",
        ]);
      }
    };
    void run();
  }, [
    activeModal,
    baseBranch,
    strategy,
    thread?.subtitle,
    threadId,
    worktreeStatus,
    worktreePath,
    setMetadata,
  ]);

  useEffect(() => {
    if (activeModal !== "commit") return;
    if (!workspaceCwd) return;
    const run = async () => {
      try {
        const branch = await getCurrentBranch(workspaceCwd);
        if (branch) {
          setCommitBranch(branch);
          setMetadata({ branch });
          setBranchNameInput(branch);
        }
      } catch (error) {
        console.warn("Failed to read branch", error);
      }
    };
    void run();
  }, [activeModal, setBranchNameInput, setMetadata, workspaceCwd]);

  useEffect(() => {
    if (activeModal !== "pr") return;
    if (prStatus !== "idle") return;
    if (!workspaceCwd) {
      setPrStatus("error");
      setPrLogs(["Missing workspace path."]);
      return;
    }
    setPrStatus("running");
    const run = async () => {
      try {
        const logs = await createPullRequest(workspaceCwd);
        setPrLogs(logs);
        setPrStepState((state) => ({ ...state, created: true }));
        setPrStatus("done");
      } catch (error) {
        setPrLogs([
          "Failed to create PR.",
          error instanceof Error ? error.message : "Unknown error",
        ]);
        setPrStatus("error");
      }
    };
    void run();
  }, [activeModal, prStatus, workspaceCwd]);

  const worktreeLines = useMemo(() => {
    if (worktreeLogs.length) return worktreeLogs;
    return ["Preparing worktree (detached HEAD)"];
  }, [worktreeLogs]);

  const handleCreateBranch = async () => {
    if (!workspaceCwd) {
      setBranchStatus("error");
      setBranchLogs(["Missing workspace path."]);
      return;
    }
    setBranchStatus("running");
    try {
      const result = await createBranch(workspaceCwd, branchNameInput);
      setBranchLogs(
        ["Branch created.", result.stdout, result.stderr].filter(Boolean),
      );
      setBranchStatus("done");
      await checkoutBranch(thread?.subtitle ?? workspaceCwd, branchNameInput);
      setMetadata({ branch: branchNameInput });
      setActiveModal(null);
    } catch (error) {
      setBranchStatus("error");
      setBranchLogs([
        "Failed to create branch.",
        error instanceof Error ? error.message : "Unknown error",
      ]);
    }
  };

  const handleCommit = async () => {
    if (!workspaceCwd) {
      setCommitStatus("error");
      setCommitLogs(["Missing workspace path."]);
      return;
    }
    setCommitStatus("running");
    setCommitLogs([]);
    try {
      const commit = await commitChanges({
        cwd: workspaceCwd,
        message: commitMessage,
        includeUnstaged,
      });
      setCommitLogs(commit.logs);
      setCommitBranch(commit.branch);
      setMetadata({ branch: commit.branch });
      setPrStepState({ committed: true, pushed: false, created: false });

      if (commitOption === "commit_push" || commitOption === "commit_pr") {
        const pushLogs = await pushBranch(workspaceCwd, commit.branch);
        setCommitLogs((prev) => [...prev, ...pushLogs]);
        setPrStepState((state) => ({ ...state, pushed: true }));
      }

      setCommitStatus("done");
      if (commitOption === "commit_pr") {
        setActiveModal("pr");
        return;
      }
      handleClose();
    } catch (error) {
      setCommitStatus("error");
      setCommitLogs([
        "Failed to commit.",
        error instanceof Error ? error.message : "Unknown error",
      ]);
    }
  };

  if (!activeModal) return null;

  if (activeModal === "worktree") {
    return (
      <ModalShell title="Creating worktree" onClose={handleClose}>
        <p>Creating a worktree and running setup.</p>
        <div className="rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-xs text-ink-200">
          {worktreeLines.map((line, index) => (
            <div key={`${line}-${index}`}>{line}</div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <StatusIndicator status={worktreeStatus} />
          <button
            className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
            onClick={() => setActiveModal(null)}
          >
            Work locally instead
          </button>
          <button
            className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
            onClick={handleClose}
          >
            Cancel
          </button>
        </div>
      </ModalShell>
    );
  }

  if (activeModal === "branch") {
    return (
      <ModalShell title="Create branch" onClose={handleClose}>
        <p>
          A branch will be created and checked out in this worktree. Once
          created, you should do your work from this directory. You cannot
          checkout this branch on your local repo.
        </p>
        <div className="space-y-2">
          <label
            className="text-xs uppercase tracking-[0.2em] text-ink-500"
            htmlFor={branchInputId}
          >
            Branch name
          </label>
          <input
            id={branchInputId}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-ink-100"
            value={branchNameInput}
            onChange={(event) => setBranchNameInput(event.target.value)}
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-ink-400">Set prefix</span>
          <input type="checkbox" className="accent-flare-300" />
        </div>
        {branchLogs.length ? (
          <div className="rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-xs text-ink-200">
            {branchLogs.map((line, index) => (
              <div key={`${line}-${index}`}>{line}</div>
            ))}
          </div>
        ) : null}
        <div className="flex justify-end gap-2 text-xs">
          <button
            className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
            onClick={handleClose}
          >
            Close
          </button>
          <button
            className="rounded-full border border-flare-300 bg-flare-400/10 px-3 py-1 text-ink-50 hover:bg-flare-400/20"
            onClick={() => {
              void handleCreateBranch();
            }}
          >
            Continue
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-400">
          <StatusIndicator status={branchStatus} />
          <span>{branchStatus === "running" ? "Creating branch" : ""}</span>
        </div>
      </ModalShell>
    );
  }

  if (activeModal === "commit") {
    const summary = thread?.diffSummary;
    const summaryAdditions = summary ? liveDiffStats.additions : 0;
    const summaryDeletions = summary ? liveDiffStats.deletions : 0;
    return (
      <ModalShell title="Commit your changes" onClose={handleClose}>
        <div className="space-y-2 text-xs text-ink-400">
          <p>
            Branch: {commitBranch || thread?.projectId || "feature/worktree"}
          </p>
          <p>
            Changes: {summary?.filesChanged ?? 0} files · +{summaryAdditions} /
            -{summaryDeletions}
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            className="accent-flare-300"
            checked={includeUnstaged}
            onChange={(event) => setIncludeUnstaged(event.target.checked)}
          />
          Include unstaged
        </label>
        <div>
          <label
            className="text-xs uppercase tracking-[0.2em] text-ink-500"
            htmlFor={commitMessageId}
          >
            Commit message
          </label>
          <textarea
            id={commitMessageId}
            className="mt-2 h-24 w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-ink-100"
            placeholder="Leave blank and codex will generate a commit message for you."
            value={commitMessage}
            onChange={(event) => setCommitMessage(event.target.value)}
          />
        </div>
        <div className="space-y-2 text-xs">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={commitOption === "commit"}
              onChange={() => setCommitOption("commit")}
            />
            Commit
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={commitOption === "commit_push"}
              onChange={() => setCommitOption("commit_push")}
            />
            Commit and push
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={commitOption === "commit_pr"}
              onChange={() => setCommitOption("commit_pr")}
            />
            Commit and create PR
          </label>
        </div>
        {commitLogs.length ? (
          <div className="rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-xs text-ink-200">
            {commitLogs.map((line, index) => (
              <div key={`${line}-${index}`}>{line}</div>
            ))}
          </div>
        ) : null}
        <div className="flex justify-end gap-2 text-xs">
          <button
            className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
            onClick={handleClose}
          >
            Close
          </button>
          <button
            className="rounded-full border border-flare-300 bg-flare-400/10 px-3 py-1 text-ink-50 hover:bg-flare-400/20"
            onClick={() => {
              void handleCommit();
            }}
          >
            Continue
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-400">
          <StatusIndicator status={commitStatus} />
          <span>{commitStatus === "running" ? "Committing changes" : ""}</span>
        </div>
      </ModalShell>
    );
  }

  if (activeModal === "pr") {
    const steps = [
      { label: "Committed", done: prStepState.committed },
      { label: "Pushed", done: prStepState.pushed },
      { label: "Creating PR", done: prStepState.created },
    ];
    return (
      <ModalShell title="Creating a PR" onClose={handleClose}>
        <p>Creating a PR from your worktree branch.</p>
        <div className="space-y-2 text-sm">
          {steps.map((step) => (
            <div
              key={step.label}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2"
            >
              <span>{step.label}</span>
              {step.done ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-ink-400" />
              )}
            </div>
          ))}
        </div>
        {prLogs.length ? (
          <div className="rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-xs text-ink-200">
            {prLogs.map((line, index) => (
              <div key={`${line}-${index}`}>{line}</div>
            ))}
          </div>
        ) : null}
        <div className="flex items-center gap-2 text-xs text-ink-400">
          <StatusIndicator status={prStatus} />
          <span>{prStatus === "running" ? "Creating PR" : ""}</span>
        </div>
        <div className="flex justify-end gap-2 text-xs">
          <button
            className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
            onClick={handleClose}
          >
            Close
          </button>
        </div>
      </ModalShell>
    );
  }

  return null;
}
