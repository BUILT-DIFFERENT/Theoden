import { getCachedExternalChatgptTokens } from "@/app/services/cli/account";
import { registerApprovalRequest } from "@/app/services/cli/approvals";
import { respondAppServerRequest } from "@/app/services/cli/appServer";
import {
  getArray,
  getString,
  isRecord,
} from "@/app/services/cli/appServerPayload";
import type { AppServerRequest } from "@/app/services/cli/appServerPayload";

interface ToolUserInputOption {
  label: string;
  description: string;
}

interface ToolUserInputQuestion {
  id: string;
  header: string;
  question: string;
  isOther: boolean;
  options: ToolUserInputOption[];
}

const USER_INPUT_REQUEST_METHODS = new Set([
  "item/tool/requestUserInput",
  "tool/requestUserInput",
]);

const UNSUPPORTED_SERVER_REQUEST_METHODS = new Set([
  "item/tool/call",
  "applyPatchApproval",
  "execCommandApproval",
]);

function parseToolUserInputQuestions(request: AppServerRequest) {
  const params = request.params;
  if (!params) return [] as ToolUserInputQuestion[];
  const rawQuestions = getArray(params, "questions") ?? [];
  return rawQuestions
    .map((rawQuestion) => {
      if (!isRecord(rawQuestion)) {
        return null;
      }
      const id = getString(rawQuestion, "id");
      const header = getString(rawQuestion, "header");
      const question = getString(rawQuestion, "question");
      if (!id || !header || !question) {
        return null;
      }
      const isOther = rawQuestion.isOther === true;
      const options = (getArray(rawQuestion, "options") ?? [])
        .map((option) => {
          if (!isRecord(option)) {
            return null;
          }
          const label = getString(option, "label");
          const description = getString(option, "description");
          if (!label || !description) {
            return null;
          }
          return {
            label,
            description,
          } satisfies ToolUserInputOption;
        })
        .filter((option): option is ToolUserInputOption => option !== null);
      return {
        id,
        header,
        question,
        isOther,
        options,
      } satisfies ToolUserInputQuestion;
    })
    .filter((question): question is ToolUserInputQuestion => question !== null);
}

function promptLabelForOption(
  question: ToolUserInputQuestion,
  selection: string,
) {
  const trimmedSelection = selection.trim();
  if (!trimmedSelection) {
    return null;
  }
  const selectedIndex = Number.parseInt(trimmedSelection, 10);
  if (
    Number.isInteger(selectedIndex) &&
    selectedIndex > 0 &&
    selectedIndex <= question.options.length
  ) {
    return question.options[selectedIndex - 1]?.label ?? null;
  }
  return trimmedSelection;
}

function promptForToolUserInput(question: ToolUserInputQuestion) {
  if (typeof window === "undefined" || typeof window.prompt !== "function") {
    return null;
  }

  const optionsHint = question.options.length
    ? `\n\n${question.options
        .map(
          (option, index) =>
            `${index + 1}. ${option.label} - ${option.description}`,
        )
        .join("\n")}`
    : "";
  const otherHint = question.isOther ? "\nOther: enter custom text." : "";
  const body = `${question.header}\n${question.question}${optionsHint}${otherHint}`;
  const defaultValue = question.options[0]?.label ?? "";
  const rawInput = window.prompt(body, defaultValue);
  if (rawInput === null) {
    return null;
  }

  const selected = promptLabelForOption(question, rawInput);
  if (!selected && question.options.length) {
    return question.options[0].label;
  }
  return selected;
}

async function handleToolRequestUserInput(request: AppServerRequest) {
  const questions = parseToolUserInputQuestions(request);
  const answers = questions.reduce<Record<string, { answers: string[] }>>(
    (acc, question) => {
      const answer = promptForToolUserInput(question);
      acc[question.id] = {
        answers: answer ? [answer] : [],
      };
      return acc;
    },
    {},
  );
  await respondAppServerRequest(request.id, { answers });
}

async function handleChatgptAuthTokenRefresh(request: AppServerRequest) {
  const tokens = getCachedExternalChatgptTokens();
  if (!tokens) {
    await respondAppServerRequest(request.id, undefined, {
      code: -32001,
      message:
        "No external ChatGPT auth tokens available. Re-run account/login/start with chatgptAuthTokens.",
    });
    return;
  }
  await respondAppServerRequest(request.id, {
    idToken: tokens.idToken,
    accessToken: tokens.accessToken,
  });
}

async function respondUnsupportedRequest(request: AppServerRequest) {
  console.warn("Declined unsupported app-server request", {
    id: request.id,
    method: request.method,
  });
  await respondAppServerRequest(request.id, undefined, {
    code: -32601,
    message: `Unsupported app-server request method: ${request.method}`,
  });
}

export async function handleAppServerRequest(request: AppServerRequest) {
  if (registerApprovalRequest(request)) {
    return;
  }

  if (USER_INPUT_REQUEST_METHODS.has(request.method)) {
    await handleToolRequestUserInput(request);
    return;
  }

  if (request.method === "account/chatgptAuthTokens/refresh") {
    await handleChatgptAuthTokenRefresh(request);
    return;
  }

  if (UNSUPPORTED_SERVER_REQUEST_METHODS.has(request.method)) {
    await respondUnsupportedRequest(request);
    return;
  }

  await respondUnsupportedRequest(request);
}
