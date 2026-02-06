import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

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
  mergeWorkspace,
  WorkspaceCreationCancelledError,
} from "@/app/services/git/worktrees";
import { useThreadMetadata } from "@/app/state/threadMetadata";
import { useThreadUi } from "@/app/state/threadUi";
import { useRuntimeSettings } from "@/app/state/useRuntimeSettings";
import type { ThreadDetail } from "@/app/types";

interface ThreadModalsProps {
  thread?: ThreadDetail;
}

type ModalStatus = "idle" | "running" | "done" | "error" | "cancelled";
type MergeStrategy = "rebase" | "merge" | "squash";

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
  if (status === "cancelled") {
    return <AlertTriangle className="h-4 w-4 text-amber-300" />;
  }
  if (status === "error") {
    return <AlertTriangle className="h-4 w-4 text-rose-300" />;
  }
  return null;
}

function sanitizeBranchSegment(value: string) {
  return value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9/_-]/g, "")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

function withBranchPrefix(
  branchName: string,
  branchPrefix: string,
  applyPrefix: boolean,
) {
  const sanitized = sanitizeBranchSegment(branchName);
  if (!sanitized.length) {
    return "";
  }
  if (!applyPrefix) {
    return sanitized;
  }
  const prefix = sanitizeBranchSegment(branchPrefix);
  if (!prefix.length) {
    return sanitized;
  }
  if (sanitized.startsWith(`${prefix}/`) || sanitized === prefix) {
    return sanitized;
  }
  return `${prefix}/${sanitized}`;
}

export function ThreadModals({ thread }: ThreadModalsProps) {
  const runtimeSettings = useRuntimeSettings();
  const { activeModal, setActiveModal } = useThreadUi();
  const { metadata, setMetadata } = useThreadMetadata(thread?.id);
  const threadId = thread?.id ?? `thread-${Date.now()}`;
  const baseBranch = runtimeSettings.defaultBranch || "main";
  const branchPrefix = runtimeSettings.worktreeBranchPrefix;
  const retentionDays = Number.parseInt(
    runtimeSettings.worktreeRetentionDays,
    10,
  );
  const keepMergedDays = Number.isFinite(retentionDays) ? retentionDays : 0;
  const removeMergedWorktreeDefault =
    runtimeSettings.autoPruneMergedWorktrees && keepMergedDays <= 0;

  const [branchNameInput, setBranchNameInput] = useState(
    metadata.branch ?? thread?.branch ?? "feature/new-branch",
  );
  const [applyBranchPrefix, setApplyBranchPrefix] = useState(
    sanitizeBranchSegment(branchPrefix).length > 0,
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

  const [mergeStatus, setMergeStatus] = useState<ModalStatus>("idle");
  const [mergeLogs, setMergeLogs] = useState<string[]>([]);
  const [mergeStrategy, setMergeStrategy] = useState<MergeStrategy>("merge");
  const [removeMergedWorktree, setRemoveMergedWorktree] = useState(
    removeMergedWorktreeDefault,
  );

  const worktreeAbortRef = useRef<AbortController | null>(null);

  const worktreePath = metadata.worktreePath;
  const workspaceCwd = worktreePath ?? thread?.subtitle ?? "";
  const repoPath = thread?.subtitle ?? "";
  const strategy = runtimeSettings.worktreeStrategy;
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

  const resolvedBranchName = withBranchPrefix(
    branchNameInput,
    branchPrefix,
    applyBranchPrefix,
  );

  const handleClose = () => {
    setActiveModal(null);
  };

  const handleCancelWorktreeSetup = () => {
    if (worktreeStatus !== "running") {
      handleClose();
      return;
    }
    worktreeAbortRef.current?.abort();
    setWorktreeLogs((current) => [...current, "Cancellation requested."]);
  };

  useEffect(() => {
    if (metadata.branch) {
      setBranchNameInput(metadata.branch);
      return;
    }
    if (thread?.branch) {
      setBranchNameInput(thread.branch);
      return;
    }
    const suggested = sanitizeBranchSegment(
      `${threadId.split("-").slice(-1)[0] ?? "feature"}`,
    );
    if (suggested.length) {
      setBranchNameInput(suggested);
    }
  }, [metadata.branch, thread?.branch, threadId]);

  useEffect(() => {
    if (activeModal !== "merge") {
      return;
    }
    setMergeStatus("idle");
    setMergeLogs([]);
    setRemoveMergedWorktree(removeMergedWorktreeDefault);
  }, [activeModal, removeMergedWorktreeDefault]);

  useEffect(() => {
    if (activeModal !== "worktree") {
      return;
    }
    if (!repoPath) {
      setWorktreeStatus("error");
      setWorktreeLogs(["Missing repo path for worktree."]);
      return;
    }
    if (worktreeStatus !== "idle") {
      return;
    }

    const controller = new AbortController();
    worktreeAbortRef.current = controller;
    setWorktreeStatus("running");
    setWorktreeLogs([
      `Creating worktree with ${strategy === "git_worktree" ? "git worktree" : "clone"} strategy.`,
      `Base branch: ${baseBranch}`,
    ]);

    const run = async () => {
      try {
        const result = await createWorkspace(
          {
            repoPath,
            threadId,
            baseBranch,
            strategy,
            targetPath: worktreePath ?? undefined,
          },
          { signal: controller.signal },
        );
        setWorktreeLogs(result.logs);
        setMetadata({
          worktreePath: result.info.path,
          branch: result.info.branch,
        });
        setWorktreeStatus("done");
      } catch (error) {
        if (error instanceof WorkspaceCreationCancelledError) {
          setWorktreeStatus("cancelled");
          setWorktreeLogs((current) => [
            ...current,
            "Worktree creation cancelled.",
          ]);
          return;
        }
        setWorktreeStatus("error");
        setWorktreeLogs([
          "Failed to create worktree.",
          error instanceof Error ? error.message : "Unknown error",
        ]);
      } finally {
        if (worktreeAbortRef.current === controller) {
          worktreeAbortRef.current = null;
        }
      }
    };
    void run();
  }, [
    activeModal,
    baseBranch,
    repoPath,
    setMetadata,
    strategy,
    threadId,
    worktreePath,
    worktreeStatus,
  ]);

  useEffect(() => {
    if (activeModal !== "commit") {
      return;
    }
    if (!workspaceCwd) {
      return;
    }
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
    if (activeModal !== "pr") {
      return;
    }
    if (prStatus !== "idle") {
      return;
    }
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
    if (worktreeLogs.length) {
      return worktreeLogs;
    }
    return ["Preparing worktree (detached HEAD)"];
  }, [worktreeLogs]);

  const handleCreateBranch = async () => {
    if (!workspaceCwd) {
      setBranchStatus("error");
      setBranchLogs(["Missing workspace path."]);
      return;
    }
    if (!resolvedBranchName.length) {
      setBranchStatus("error");
      setBranchLogs(["Enter a valid branch name."]);
      return;
    }
    setBranchStatus("running");
    setBranchLogs([]);
    try {
      const result = await createBranch(workspaceCwd, resolvedBranchName);
      setBranchLogs(
        ["Branch created.", result.stdout, result.stderr].filter(Boolean),
      );
      setBranchStatus("done");
      await checkoutBranch(
        thread?.subtitle ?? workspaceCwd,
        resolvedBranchName,
      );
      setMetadata({ branch: resolvedBranchName });
      handleClose();
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

  const handleMerge = async () => {
    if (!repoPath || !worktreePath) {
      setMergeStatus("error");
      setMergeLogs(["Missing repo/worktree path for merge."]);
      return;
    }
    setMergeStatus("running");
    setMergeLogs([]);
    try {
      const result = await mergeWorkspace({
        repoPath,
        workspacePath: worktreePath,
        targetBranch: baseBranch,
        strategy: mergeStrategy,
        removeWorktree: removeMergedWorktree,
      });
      setMergeLogs(result.logs);
      setMetadata({
        branch: baseBranch,
        worktreePath: removeMergedWorktree ? undefined : worktreePath,
      });
      if (!removeMergedWorktree && keepMergedDays > 0) {
        setMergeLogs((current) => [
          ...current,
          `Keeping merged worktree for ${keepMergedDays} day(s).`,
        ]);
      }
      setMergeStatus("done");
    } catch (error) {
      setMergeStatus("error");
      setMergeLogs([
        "Failed to bring worktree branch back to main.",
        error instanceof Error ? error.message : "Unknown error",
      ]);
    }
  };

  if (!activeModal) {
    return null;
  }

  if (activeModal === "worktree") {
    return (
      <ModalShell
        title="Creating worktree"
        onClose={() => {
          if (worktreeStatus === "running") {
            handleCancelWorktreeSetup();
            return;
          }
          handleClose();
        }}
      >
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
            disabled={worktreeStatus === "running"}
          >
            Work locally instead
          </button>
          <button
            className="rounded-full border border-white/10 px-3 py-1 hover:border-flare-300"
            onClick={handleCancelWorktreeSetup}
          >
            {worktreeStatus === "running" ? "Cancel setup" : "Close"}
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
          created, continue your changes here before merging back to{" "}
          {baseBranch}.
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
          <p className="text-xs text-ink-500">
            Final: {resolvedBranchName || "invalid"}
          </p>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-ink-400">Apply prefix ({branchPrefix})</span>
          <input
            type="checkbox"
            className="accent-flare-300"
            checked={applyBranchPrefix}
            onChange={(event) => setApplyBranchPrefix(event.target.checked)}
          />
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
            disabled={branchStatus === "running"}
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

  if (activeModal === "merge") {
    return (
      <ModalShell title="Bring back to main" onClose={handleClose}>
        <p>
          Merge the current worktree branch back into{" "}
          <span className="text-ink-100">{baseBranch}</span>.
        </p>
        <div className="space-y-2 text-xs">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={mergeStrategy === "merge"}
              onChange={() => setMergeStrategy("merge")}
            />
            Merge commit
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={mergeStrategy === "rebase"}
              onChange={() => setMergeStrategy("rebase")}
            />
            Rebase then fast-forward
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={mergeStrategy === "squash"}
              onChange={() => setMergeStrategy("squash")}
            />
            Squash merge
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            className="accent-flare-300"
            checked={removeMergedWorktree}
            onChange={(event) => setRemoveMergedWorktree(event.target.checked)}
          />
          Remove merged worktree immediately
        </label>
        {!removeMergedWorktree && keepMergedDays > 0 ? (
          <p className="text-xs text-ink-500">
            This worktree will be retained for {keepMergedDays} day(s) per
            settings.
          </p>
        ) : null}
        {mergeLogs.length ? (
          <div className="rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-xs text-ink-200">
            {mergeLogs.map((line, index) => (
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
            className="rounded-full border border-flare-300 bg-flare-400/10 px-3 py-1 text-ink-50 hover:bg-flare-400/20 disabled:opacity-60"
            onClick={() => {
              void handleMerge();
            }}
            disabled={mergeStatus === "running"}
          >
            {mergeStatus === "running" ? "Merging…" : "Bring back to main"}
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-400">
          <StatusIndicator status={mergeStatus} />
          <span>{mergeStatus === "running" ? "Merging changes" : ""}</span>
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
