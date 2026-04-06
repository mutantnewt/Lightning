import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const nodeBin = process.env.NODE_BIN ?? process.execPath;
const moderatorScript = join(__dirname, "manage-local-moderator.mjs");
const smokeModerationScript = join(__dirname, "manage-smoke-moderation-submission.mjs");
const smokeCommunityProbeScript = join(
  __dirname,
  "manage-smoke-community-probe.mjs",
);

function resolveChromeBinary() {
  if (process.env.CHROME_BIN) {
    return process.env.CHROME_BIN;
  }

  const candidatePaths = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ];

  const resolvedCandidate = candidatePaths.find((candidatePath) =>
    existsSync(candidatePath),
  );

  return resolvedCandidate ?? "google-chrome";
}

const chromeBinary = resolveChromeBinary();

const targetUrl = process.env.LIGHTNING_SMOKE_URL ?? "http://127.0.0.1:5175/";
const signInIdentifier = process.env.LIGHTNING_SMOKE_IDENTIFIER;
const signInPassword = process.env.LIGHTNING_SMOKE_PASSWORD;
const expectedUserName = process.env.LIGHTNING_SMOKE_EXPECTED_USER ?? "Local Smoke";
const expectedFavoriteTitle =
  process.env.LIGHTNING_SMOKE_EXPECTED_FAVORITE ?? "Pride and Prejudice";
const expectedFavoriteBookId =
  process.env.LIGHTNING_SMOKE_EXPECTED_FAVORITE_BOOK_ID ?? "1";
const commentText =
  process.env.LIGHTNING_SMOKE_COMMENT_TEXT ??
  `Local smoke comment ${new Date().toISOString()}`;
const reviewText =
  process.env.LIGHTNING_SMOKE_REVIEW_TEXT ??
  `Local smoke review ${new Date().toISOString()}`;
const targetRating = Number(process.env.LIGHTNING_SMOKE_TARGET_RATING ?? "5");
const addBookQueries = (
  process.env.LIGHTNING_SMOKE_ADD_BOOK_QUERIES ??
  process.env.LIGHTNING_SMOKE_ADD_BOOK_QUERY ??
  "Middlemarch,War and Peace,The Secret Garden,Great Expectations,Leaves of Grass"
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const verifyModeration = process.env.LIGHTNING_SMOKE_VERIFY_MODERATION === "true";
const autoModerator = process.env.LIGHTNING_SMOKE_AUTO_MODERATOR === "true";
const moderatorIdentifier =
  process.env.LIGHTNING_SMOKE_MODERATOR_IDENTIFIER ?? signInIdentifier;
const moderationAction = process.env.LIGHTNING_SMOKE_MODERATION_ACTION ?? "reject";
const moderationNote =
  process.env.LIGHTNING_SMOKE_MODERATION_NOTE ??
  `Local smoke ${moderationAction} decision ${new Date().toISOString()}`;
const duplicateReviewMessage = "You can only keep one review per book.";

if (!signInIdentifier || !signInPassword) {
  console.error(
    "Missing LIGHTNING_SMOKE_IDENTIFIER or LIGHTNING_SMOKE_PASSWORD for the local frontend smoke test.",
  );
  process.exit(1);
}

if (
  moderationAction !== "reject" &&
  moderationAction !== "defer"
) {
  console.error(
    "LIGHTNING_SMOKE_MODERATION_ACTION must be either \"reject\" or \"defer\".",
  );
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: {
        ...process.env,
        ...(options.env ?? {}),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        });
        return;
      }

      reject(
        new Error(
          [
            `Command failed: ${command} ${args.join(" ")}`,
            stdout.trim(),
            stderr.trim(),
          ]
            .filter(Boolean)
            .join("\n"),
        ),
      );
    });
  });
}

async function runModeratorLifecycle(action) {
  if (!moderatorIdentifier) {
    throw new Error(
      "Moderator automation requires LIGHTNING_SMOKE_MODERATOR_IDENTIFIER or LIGHTNING_SMOKE_IDENTIFIER.",
    );
  }

  const result = await run(
    nodeBin,
    [moderatorScript, action, "--identifier", moderatorIdentifier],
    {
      cwd: __dirname,
    },
  );

  return result.stdout ? JSON.parse(result.stdout) : null;
}

async function runSmokeModerationSubmission(action, extraArgs = []) {
  const result = await run(
    nodeBin,
    [smokeModerationScript, action, ...extraArgs],
    {
      cwd: __dirname,
      env: {
        LIGHTNING_SMOKE_IDENTIFIER: signInIdentifier,
        LIGHTNING_SMOKE_EXPECTED_USER: expectedUserName,
      },
    },
  );

  return result.stdout ? JSON.parse(result.stdout) : null;
}

async function runSmokeCommunityProbe(action, extraArgs = []) {
  const resolvedSmokeEnv =
    process.env.LIGHTNING_SMOKE_ENV ??
    (/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//u.test(targetUrl)
      ? "local"
      : undefined);

  const result = await run(
    nodeBin,
    [smokeCommunityProbeScript, action, ...extraArgs],
    {
      cwd: __dirname,
      env: {
        ...(resolvedSmokeEnv ? { LIGHTNING_SMOKE_ENV: resolvedSmokeEnv } : {}),
        LIGHTNING_SMOKE_EXPECTED_USER: expectedUserName,
        LIGHTNING_SMOKE_EXPECTED_FAVORITE_BOOK_ID: expectedFavoriteBookId,
      },
    },
  );

  return result.stdout ? JSON.parse(result.stdout) : null;
}

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Unable to resolve a debug port.")));
        return;
      }

      server.close(() => resolve(address.port));
    });
  });
}

async function waitFor(check, description, timeoutMs = 20_000, intervalMs = 250) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const result = await check();

      if (result) {
        return result;
      }
    } catch (error) {
      lastError = error;
    }

    await sleep(intervalMs);
  }

  const reason =
    lastError instanceof Error ? lastError.message : "condition never became truthy";
  throw new Error(`Timed out waiting for ${description}: ${reason}`);
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status}`);
  }

  return response.json();
}

class ChromeDevToolsClient {
  constructor(webSocket) {
    this.webSocket = webSocket;
    this.nextId = 1;
    this.pending = new Map();
    this.consoleMessages = [];
    this.exceptions = [];
    this.networkFailures = [];

    this.webSocket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));

      if (!("id" in message)) {
        this.handleEvent(message);
        return;
      }

      const pendingRequest = this.pending.get(message.id);

      if (!pendingRequest) {
        return;
      }

      this.pending.delete(message.id);

      if (message.error) {
        pendingRequest.reject(new Error(message.error.message ?? "CDP request failed."));
        return;
      }

      pendingRequest.resolve(message.result ?? {});
    });

    this.webSocket.addEventListener("error", (event) => {
      for (const pendingRequest of this.pending.values()) {
        pendingRequest.reject(
          new Error(`CDP websocket error: ${JSON.stringify(event)}`),
        );
      }
      this.pending.clear();
    });
  }

  handleEvent(message) {
    switch (message.method) {
      case "Runtime.consoleAPICalled":
        this.consoleMessages.push({
          type: message.params?.type ?? null,
          text: (message.params?.args ?? [])
            .map((arg) => arg?.value ?? arg?.description ?? null)
            .filter(Boolean)
            .join(" "),
        });
        this.consoleMessages = this.consoleMessages.slice(-20);
        break;
      case "Runtime.exceptionThrown":
        this.exceptions.push({
          text: message.params?.exceptionDetails?.text ?? null,
          description:
            message.params?.exceptionDetails?.exception?.description ?? null,
        });
        this.exceptions = this.exceptions.slice(-20);
        break;
      case "Network.loadingFailed":
        this.networkFailures.push({
          requestId: message.params?.requestId ?? null,
          errorText: message.params?.errorText ?? null,
          canceled: message.params?.canceled ?? false,
          blockedReason: message.params?.blockedReason ?? null,
        });
        this.networkFailures = this.networkFailures.slice(-20);
        break;
      default:
        break;
    }
  }

  send(method, params = {}) {
    const id = this.nextId++;

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.webSocket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });

    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text ?? "Runtime.evaluate failed.");
    }

    return result.result?.value;
  }
}

async function safeEvaluate(client, expression) {
  try {
    return await client.evaluate(expression);
  } catch (error) {
    return {
      evaluationError: error instanceof Error ? error.message : String(error),
    };
  }
}

async function setElementValue(client, selector, value) {
  return client.evaluate(`(() => {
    const field = document.querySelector(${JSON.stringify(selector)});

    if (!field) {
      throw new Error(${JSON.stringify(`Missing field for selector: ${selector}`)});
    }

    const isTextArea = field instanceof window.HTMLTextAreaElement;
    const prototype = isTextArea
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

    descriptor?.set?.call(field, ${JSON.stringify(value)});
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    field.focus();
    return true;
  })()`);
}

async function clickSelector(client, selector, description) {
  return client.evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});

    if (!(element instanceof HTMLElement)) {
      throw new Error(${JSON.stringify(`Missing ${description}.`)});
    }

    element.click();
    return true;
  })()`);
}

async function clickBookCardControl(client, bookTitle, selectorPrefix, description) {
  return client.evaluate(`(() => {
    const card = [...document.querySelectorAll('[data-book-title]')].find(
      (node) => node.getAttribute('data-book-title') === ${JSON.stringify(bookTitle)},
    );

    if (!(card instanceof HTMLElement)) {
      throw new Error(${JSON.stringify(`Missing book card for ${bookTitle}.`)});
    }

    const control = card.querySelector(${JSON.stringify(
      `[data-testid^="${selectorPrefix}"]`,
    )});

    if (!(control instanceof HTMLElement)) {
      throw new Error(${JSON.stringify(`Missing ${description} for ${bookTitle}.`)});
    }

    control.click();
    return true;
  })()`);
}

async function clickReviewDeleteButton(client, reviewBody) {
  return client.evaluate(`(() => {
    const reviewCard = [...document.querySelectorAll('[data-testid^="review-item-"]')].find(
      (node) => (node.textContent || '').includes(${JSON.stringify(reviewBody)}),
    );

    if (!(reviewCard instanceof HTMLElement)) {
      throw new Error('Missing review card for deletion.');
    }

    const button = reviewCard.querySelector('[data-testid^="delete-review-"]');

    if (!(button instanceof HTMLElement)) {
      throw new Error('Missing delete-review button.');
    }

    button.click();
    return true;
  })()`);
}

async function clickCommentDeleteButton(client, commentBody) {
  return client.evaluate(`(() => {
    const commentCard = [...document.querySelectorAll('[data-testid^="comment-item-"]')].find(
      (node) => (node.textContent || '').includes(${JSON.stringify(commentBody)}),
    );

    if (!(commentCard instanceof HTMLElement)) {
      throw new Error('Missing comment card for deletion.');
    }

    const button = commentCard.querySelector('[data-testid^="delete-comment-"]');

    if (!(button instanceof HTMLElement)) {
      throw new Error('Missing delete-comment button.');
    }

    button.click();
    return true;
  })()`);
}

async function clickModerationDecisionButton(client, submissionId, action) {
  return client.evaluate(`(() => {
    const button = document.querySelector(${JSON.stringify(
      `[data-testid="${action}-submission-${submissionId}"]`,
    )});

    if (!(button instanceof HTMLElement)) {
      throw new Error(${JSON.stringify(`Missing moderation ${action} button.`)});
    }

    button.click();
    return true;
  })()`);
}

async function setBookCardRating(client, bookTitle, desiredRating) {
  return client.evaluate(`(() => {
    const card = [...document.querySelectorAll('[data-book-title]')].find(
      (node) => node.getAttribute('data-book-title') === ${JSON.stringify(bookTitle)},
    );

    if (!(card instanceof HTMLElement)) {
      throw new Error(${JSON.stringify(`Missing book card for ${bookTitle}.`)});
    }

    const ratingRoot = card.querySelector('[data-testid^="book-rating-"][data-rating-value]');

    if (!(ratingRoot instanceof HTMLElement)) {
      throw new Error(${JSON.stringify(`Missing rating root for ${bookTitle}.`)});
    }

    const currentValue = Number(ratingRoot.getAttribute('data-rating-value') || '0');
    const prefix = ratingRoot.getAttribute('data-testid')?.replace(/-root$/, '') || '';

    if (!prefix) {
      throw new Error(${JSON.stringify(`Missing rating test prefix for ${bookTitle}.`)});
    }

    if (Math.round(currentValue) === ${JSON.stringify(desiredRating)}) {
      return {
        currentValue,
        targetValue: ${JSON.stringify(desiredRating)},
        changed: false,
      };
    }

    const button = card.querySelector(
      '[data-testid="' + prefix + '-star-${desiredRating}"]',
    );

    if (!(button instanceof HTMLElement)) {
      throw new Error(${JSON.stringify(`Missing rating button for ${bookTitle}.`)});
    }

    button.click();

    return {
      currentValue,
      targetValue: ${JSON.stringify(desiredRating)},
      changed: true,
    };
  })()`);
}

async function main() {
  let primaryError = null;
  let moderatorRestoreError = null;
  let moderatorGranted = false;
  let preparedModerationSubmission = null;
  let preparedCommunityProbe = null;

  if (verifyModeration && autoModerator) {
    await runModeratorLifecycle("grant");
    moderatorGranted = true;
  }

  if (verifyModeration) {
    preparedModerationSubmission = await runSmokeModerationSubmission("prepare");
  }

  preparedCommunityProbe = await runSmokeCommunityProbe("prepare");

  const debugPort = await getAvailablePort();
  const userDataDir = mkdtempSync(join(tmpdir(), "lightning-chrome-smoke-"));
  const chrome = spawn(
    chromeBinary,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--disable-sync",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userDataDir}`,
      targetUrl,
    ],
    {
      stdio: "ignore",
    },
  );
  let cleanedUp = false;

  const cleanup = async () => {
    if (cleanedUp) {
      return;
    }

    cleanedUp = true;

    if (!chrome.killed && chrome.exitCode === null && chrome.signalCode === null) {
      chrome.kill("SIGKILL");
    }

    if (chrome.exitCode === null && chrome.signalCode === null) {
      await Promise.race([once(chrome, "close"), sleep(1_000)]);
    }

    try {
      rmSync(userDataDir, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 200,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? "Unknown error");
      console.warn(`Smoke cleanup warning: ${message}`);
    }
  };

  const cleanupSync = () => {
    if (cleanedUp) {
      return;
    }

    cleanedUp = true;

    if (!chrome.killed && chrome.exitCode === null && chrome.signalCode === null) {
      chrome.kill("SIGKILL");
    }

    try {
      rmSync(userDataDir, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 200,
      });
    } catch {
      // Best effort only during process teardown.
    }
  };

  process.on("exit", cleanupSync);
  process.on("SIGINT", () => {
    cleanupSync();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    cleanupSync();
    process.exit(143);
  });

  try {
    await waitFor(
      async () => {
        const version = await fetchJson(`http://127.0.0.1:${debugPort}/json/version`);
        return version.webSocketDebuggerUrl ? version : null;
      },
      "Chrome DevTools endpoint",
      20_000,
      500,
    );

    const target = await waitFor(
      async () => {
        const targets = await fetchJson(`http://127.0.0.1:${debugPort}/json/list`);
        return (
          targets.find(
            (candidate) =>
              candidate.type === "page" &&
              String(candidate.url).startsWith(targetUrl),
          ) ?? null
        );
      },
      "frontend page target",
      20_000,
      500,
    );

    const webSocket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      webSocket.addEventListener("open", resolve, { once: true });
      webSocket.addEventListener("error", reject, { once: true });
    });

    const client = new ChromeDevToolsClient(webSocket);
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Network.enable");

    await waitFor(
      async () =>
        (await client.evaluate(
          "document.readyState === 'complete' && document.body?.innerText?.includes('Lightning Classics')",
        ))
          ? true
          : null,
      "frontend home page render",
      20_000,
      500,
    );

    const initialSnapshot = await client.evaluate(`(() => ({
      title: document.title,
      url: location.href,
      hasLightningBrand: document.body?.innerText?.includes('Lightning Classics') ?? false,
      hasSearchButton: [...document.querySelectorAll('button')].some((node) => (node.textContent || '').includes('Search')),
      hasAuthButton: [...document.querySelectorAll('button')].some((node) => (node.textContent || '').includes('Sign In / Sign Up'))
    }))()`);

    await client.evaluate(`(() => {
      const button = [...document.querySelectorAll('button')].find((node) =>
        (node.textContent || '').includes('Sign In / Sign Up')
      );

      if (!button) {
        throw new Error('Missing Sign In / Sign Up button on the home page.');
      }

      button.click();
      return true;
    })()`);

    await waitFor(
      async () =>
        (await client.evaluate(
          "Boolean(document.getElementById('identifier')) && Boolean(document.getElementById('password'))",
        ))
          ? true
          : null,
      "auth dialog open",
      10_000,
      250,
    );

    const fillSnapshot = await client.evaluate(`(() => {
      return {
        identifierPresent: Boolean(document.getElementById('identifier')),
        passwordPresent: Boolean(document.getElementById('password'))
      };
    })()`);

    await setElementValue(client, "#identifier", signInIdentifier);
    await setElementValue(client, "#password", signInPassword);

    await client.evaluate(`(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const submit = dialog?.querySelector('button[type="submit"]');

      if (!submit) {
        throw new Error('Missing sign-in submit button in the auth dialog.');
      }

      submit.click();
      return true;
    })()`);

    try {
      await waitFor(
        async () =>
          (await client.evaluate(`(() => {
            const signedOutButtonVisible = [...document.querySelectorAll('button')].some((node) =>
              (node.textContent || '').includes('Sign Out')
            );

            return document.body?.innerText?.includes(${JSON.stringify(expectedUserName)}) &&
              signedOutButtonVisible;
          })()`))
            ? true
            : null,
        "signed-in navbar state",
        25_000,
        500,
      );
    } catch (error) {
      const signInDiagnostic = await safeEvaluate(
        client,
        `(() => ({
          title: document.title,
          url: location.href,
          bodyExcerpt: (document.body?.innerText || '').slice(0, 1200),
          authDialogVisible: Boolean(document.querySelector('[role="dialog"]')),
          dialogTitle: document.querySelector('[role="dialog"] h2, [role="dialog"] [data-slot="dialog-title"]')?.textContent || null,
          submitButtonText: document.querySelector('[role="dialog"] button[type="submit"]')?.textContent || null,
          identifierValue: document.getElementById('identifier')?.value || null,
          passwordLength: document.getElementById('password')?.value?.length || 0
        }))()`,
      );
      const clientDiagnostics = {
        consoleMessages: client.consoleMessages,
        exceptions: client.exceptions,
        networkFailures: client.networkFailures,
      };

      throw new Error(
        `${error instanceof Error ? error.message : String(error)}\nSign-in diagnostic: ${JSON.stringify(signInDiagnostic)}\nClient diagnostic: ${JSON.stringify(clientDiagnostics)}`,
      );
    }

    let moderationSnapshot = null;
    let moderationDecisionSnapshot = null;

    if (verifyModeration) {
      await client.evaluate(`(() => {
        const link = [...document.querySelectorAll('a')].find((node) =>
          (node.textContent || '').includes('Moderation')
        );

        if (!link) {
          throw new Error('Missing Moderation link after moderator sign-in.');
        }

        link.click();
        return true;
      })()`);

      await waitFor(
        async () =>
          (await client.evaluate(`(() => {
            if (location.pathname !== '/moderation') {
              return false;
            }

            const hasTargetSubmission = Boolean(
              document.querySelector(${JSON.stringify(
                `[data-testid="moderation-notes-${preparedModerationSubmission?.submissionId ?? ""}"]`,
              )}),
            );
            const bodyText = document.body?.innerText || '';
            const isLoading = bodyText.includes('Loading pending submissions...');

            if (isLoading) {
              return false;
            }

            return hasTargetSubmission;
          })()`))
            ? true
            : null,
        "moderation page render for smoke submission",
        20_000,
        500,
      );

      moderationSnapshot = await client.evaluate(`(() => ({
        path: location.pathname,
        hasQueueCards: document.querySelectorAll('[data-testid="moderation-submission-card"]').length > 0,
        queueCardCount: document.querySelectorAll('[data-testid="moderation-submission-card"]').length,
        emptyStateVisible: (document.body?.innerText || '').includes('No pending book submissions need review right now.'),
        targetSubmissionId: ${JSON.stringify(
          preparedModerationSubmission?.submissionId ?? null,
        )},
        targetSubmissionVisible: Boolean(
          document.querySelector(${JSON.stringify(
            `[data-testid="moderation-notes-${preparedModerationSubmission?.submissionId ?? ""}"]`,
          )}),
        ),
        excerpt: (document.body?.innerText || '').slice(0, 1200),
      }))()`);

      await setElementValue(
        client,
        `[data-testid="moderation-notes-${preparedModerationSubmission?.submissionId ?? ""}"]`,
        moderationNote,
      );

      await clickModerationDecisionButton(
        client,
        preparedModerationSubmission?.submissionId,
        moderationAction,
      );

      await waitFor(
        async () =>
          (await client.evaluate(`(() => {
            return !document.querySelector(${JSON.stringify(
              `[data-testid="moderation-notes-${preparedModerationSubmission?.submissionId ?? ""}"]`,
            )});
          })()`))
            ? true
            : null,
        `moderation ${moderationAction} UI update`,
        20_000,
        500,
      );

      const expectedModerationStatus =
        moderationAction === "defer" ? "deferred" : "rejected";
      const persistedModerationStatus = await waitFor(
        async () => {
          const status = await runSmokeModerationSubmission("status", [
            "--submission-id",
            preparedModerationSubmission?.submissionId ?? "",
          ]);

          return status?.submission?.status === expectedModerationStatus
            ? status
            : null;
        },
        `moderation ${moderationAction} persistence`,
        20_000,
        500,
      );

      moderationDecisionSnapshot = await client.evaluate(`(() => ({
        path: location.pathname,
        targetSubmissionVisibleAfterDecision: Boolean(
          document.querySelector(${JSON.stringify(
            `[data-testid="moderation-notes-${preparedModerationSubmission?.submissionId ?? ""}"]`,
          )}),
        ),
        toastExcerpt: [...document.querySelectorAll('[data-sonner-toast], [data-toast], [role="status"]')]
          .map((node) => node.textContent || '')
          .join(' ')
          .slice(0, 600),
      }))()`);
      moderationDecisionSnapshot = {
        ...moderationDecisionSnapshot,
        action: moderationAction,
        note: moderationNote,
        expectedStatus: expectedModerationStatus,
        persistedStatus: persistedModerationStatus?.submission?.status ?? null,
        persistedSubmissionId: persistedModerationStatus?.submissionId ?? null,
      };
    }

    await client.evaluate(`(() => {
      const link = [...document.querySelectorAll('a')].find((node) =>
        (node.textContent || '').includes('Favorites')
      );

      if (!link) {
        throw new Error('Missing Favorites link after sign-in.');
      }

      link.click();
      return true;
    })()`);

    try {
      await waitFor(
        async () =>
          (await client.evaluate(`location.pathname === '/favorites' &&
            document.body?.innerText?.includes(${JSON.stringify(expectedFavoriteTitle)})`))
            ? true
            : null,
        "favorites page render",
        20_000,
        500,
      );
    } catch (error) {
      const favoritesDiagnostic = await safeEvaluate(
        client,
        `(() => ({
          title: document.title,
          url: location.href,
          path: location.pathname,
          signedInUserVisible: document.body?.innerText?.includes(${JSON.stringify(expectedUserName)}) ?? false,
          favoriteBookVisible: document.body?.innerText?.includes(${JSON.stringify(expectedFavoriteTitle)}) ?? false,
          favoriteHeadingVisible: document.body?.innerText?.includes('Favorites') ?? false,
          availableBookTitles: [...document.querySelectorAll('[data-book-title]')]
            .map((node) => node.getAttribute('data-book-title'))
            .filter(Boolean)
            .slice(0, 20),
          bodyExcerpt: (document.body?.innerText || '').slice(0, 1400),
        }))()`,
      );
      const clientDiagnostics = {
        consoleMessages: client.consoleMessages,
        exceptions: client.exceptions,
        networkFailures: client.networkFailures,
      };

      throw new Error(
        `${error instanceof Error ? error.message : String(error)}\nFavorites diagnostic: ${JSON.stringify(favoritesDiagnostic)}\nClient diagnostic: ${JSON.stringify(clientDiagnostics)}`,
      );
    }

    await clickBookCardControl(
      client,
      expectedFavoriteTitle,
      "book-comments-toggle-",
      "comments toggle",
    );

    await waitFor(
      async () =>
        (await client.evaluate(
          "Boolean(document.querySelector('[data-testid^=\"comment-input-\"]'))",
        ))
          ? true
          : null,
      "comment editor open",
      10_000,
      250,
    );

    let commentPaginationSnapshot = null;

    if (preparedCommunityProbe?.loadMoreExpected && preparedCommunityProbe?.pageTwoProbeText) {
      await waitFor(
        async () =>
          (await client.evaluate(
            "Boolean(document.querySelector('[data-testid^=\"load-more-comments-\"]'))",
          ))
            ? true
            : null,
        "comment load-more control",
        10_000,
        250,
      );

      commentPaginationSnapshot = await client.evaluate(`(() => ({
        loadMoreVisible: Boolean(document.querySelector('[data-testid^="load-more-comments-"]')),
        probeVisibleBeforeLoadMore: [...document.querySelectorAll('[data-testid^="comment-item-"]')].some(
          (node) => (node.textContent || '').includes(${JSON.stringify(preparedCommunityProbe.pageTwoProbeText)}),
        ),
      }))()`);

      await clickSelector(
        client,
        '[data-testid^="load-more-comments-"]',
        "load-more-comments button",
      );

      await waitFor(
        async () =>
          (await client.evaluate(`(() => {
            return [...document.querySelectorAll('[data-testid^="comment-item-"]')].some(
              (node) => (node.textContent || '').includes(${JSON.stringify(preparedCommunityProbe.pageTwoProbeText)}),
            );
          })()`))
            ? true
            : null,
        "comment pagination second page render",
        20_000,
        500,
      );

      commentPaginationSnapshot = await client.evaluate(`(() => ({
        loadMoreVisible: Boolean(document.querySelector('[data-testid^="load-more-comments-"]')),
        probeVisibleBeforeLoadMore: ${JSON.stringify(
          commentPaginationSnapshot?.probeVisibleBeforeLoadMore ?? false,
        )},
        probeVisibleAfterLoadMore: [...document.querySelectorAll('[data-testid^="comment-item-"]')].some(
          (node) => (node.textContent || '').includes(${JSON.stringify(preparedCommunityProbe.pageTwoProbeText)}),
        ),
      }))()`);
    }

    await setElementValue(client, '[data-testid^="comment-input-"]', commentText);
    await clickSelector(client, '[data-testid^="post-comment-"]', "post-comment button");

    await waitFor(
      async () =>
        (await client.evaluate(`(() => {
          return [...document.querySelectorAll('[data-testid^="comment-item-"]')].some(
            (node) => (node.textContent || '').includes(${JSON.stringify(commentText)}),
          );
        })()`))
          ? true
          : null,
      "comment creation render",
      20_000,
      500,
    );

    await clickCommentDeleteButton(client, commentText);

    await waitFor(
      async () =>
        (await client.evaluate(`(() => {
          return ![...document.querySelectorAll('[data-testid^="comment-item-"]')].some(
            (node) => (node.textContent || '').includes(${JSON.stringify(commentText)}),
          );
        })()`))
          ? true
          : null,
      "comment deletion render",
      20_000,
      500,
    );

    const ratingUpdate = await setBookCardRating(
      client,
      expectedFavoriteTitle,
      targetRating,
    );

    if (ratingUpdate.changed) {
      await waitFor(
        async () =>
          (await client.evaluate(`(() => {
            const card = [...document.querySelectorAll('[data-book-title]')].find(
              (node) => node.getAttribute('data-book-title') === ${JSON.stringify(expectedFavoriteTitle)},
            );

            if (!(card instanceof HTMLElement)) {
              return null;
            }

            const ratingRoot = card.querySelector('[data-testid^="book-rating-"][data-rating-value]');

            if (!(ratingRoot instanceof HTMLElement)) {
              return null;
            }

            return Number(ratingRoot.getAttribute('data-rating-value') || '0') === ${JSON.stringify(targetRating)};
          })()`))
            ? true
            : null,
        "rating update render",
        20_000,
        500,
      );
    }

    await clickBookCardControl(
      client,
      expectedFavoriteTitle,
      "book-reviews-toggle-",
      "reviews toggle",
    );

    await waitFor(
      async () =>
        (await client.evaluate(
          "Boolean(document.querySelector('[data-testid^=\"review-input-\"]'))",
        ))
          ? true
          : null,
      "review editor open",
      10_000,
      250,
    );

    await setElementValue(client, '[data-testid^="review-input-"]', reviewText);
    await clickSelector(client, '[data-testid^="post-review-"]', "post-review button");

    await waitFor(
      async () =>
        (await client.evaluate(`(() => {
          return [...document.querySelectorAll('[data-testid^="review-item-"]')].some(
            (node) => (node.textContent || '').includes(${JSON.stringify(reviewText)}),
          );
        })()`))
          ? true
          : null,
      "review creation render",
      20_000,
      500,
    );

    await waitFor(
      async () =>
        (await client.evaluate(`(() => {
          const reviewInput = document.querySelector('[data-testid^="review-input-"]');
          const postButton = document.querySelector('[data-testid^="post-review-"]');

          if (!reviewInput || !postButton) {
            return false;
          }

          const buttonText = postButton.textContent || '';
          const inputValue = reviewInput.value || '';

          return buttonText.includes('Post Review') && inputValue.length === 0;
        })()`))
          ? true
          : null,
      "review form ready for duplicate attempt",
      10_000,
      250,
    );

    const duplicateReviewText = `${reviewText} duplicate attempt`;

    await setElementValue(
      client,
      '[data-testid^="review-input-"]',
      duplicateReviewText,
    );
    await clickSelector(client, '[data-testid^="post-review-"]', "post-review button");

    await waitFor(
      async () =>
        (await client.evaluate(`(() => {
          const inlineError = document.querySelector('[data-testid^="review-submit-error-"]');
          return (
            (inlineError?.textContent || '').includes(${JSON.stringify(duplicateReviewMessage)}) ||
            (document.body?.innerText?.includes(${JSON.stringify(duplicateReviewMessage)}) ?? false)
          );
        })()`))
          ? true
          : null,
      "duplicate review conflict feedback",
      10_000,
      250,
    );

    const duplicateReviewSnapshot = await client.evaluate(`(() => ({
      duplicateMessageVisible: (
        (document.querySelector('[data-testid^="review-submit-error-"]')?.textContent || '').includes(${JSON.stringify(duplicateReviewMessage)}) ||
        document.body?.innerText?.includes(${JSON.stringify(duplicateReviewMessage)}) ||
        false
      ),
      duplicateAttemptRendered: [...document.querySelectorAll('[data-testid^="review-item-"]')].some(
        (node) => (node.textContent || '').includes(${JSON.stringify(duplicateReviewText)}),
      ),
      originalReviewStillVisible: [...document.querySelectorAll('[data-testid^="review-item-"]')].some(
        (node) => (node.textContent || '').includes(${JSON.stringify(reviewText)}),
      ),
    }))()`);

    await waitFor(
      async () =>
        (await client.evaluate(`(() => {
          const reviewCard = [...document.querySelectorAll('[data-testid^="review-item-"]')].find(
            (node) => (node.textContent || '').includes(${JSON.stringify(reviewText)}),
          );

          if (!(reviewCard instanceof HTMLElement)) {
            return false;
          }

          return reviewCard.querySelector('[data-testid^="delete-review-"]') instanceof HTMLElement;
        })()`))
          ? true
          : null,
      "review delete button ready",
      10_000,
      250,
    );

    await clickReviewDeleteButton(client, reviewText);

    await waitFor(
      async () =>
        (await client.evaluate(`(() => {
          return ![...document.querySelectorAll('[data-testid^="review-item-"]')].some(
            (node) => (node.textContent || '').includes(${JSON.stringify(reviewText)}),
          );
        })()`))
          ? true
          : null,
      "review deletion render",
      20_000,
      500,
    );

    const communitySnapshot = await client.evaluate(`(() => ({
      path: location.pathname,
      favoriteBookVisible: document.body?.innerText?.includes(${JSON.stringify(expectedFavoriteTitle)}) ?? false,
      commentRemoved: ![...document.querySelectorAll('[data-testid^="comment-item-"]')].some(
        (node) => (node.textContent || '').includes(${JSON.stringify(commentText)}),
      ),
      reviewRemoved: ![...document.querySelectorAll('[data-testid^="review-item-"]')].some(
        (node) => (node.textContent || '').includes(${JSON.stringify(reviewText)}),
      ),
      ratingValue: (() => {
        const card = [...document.querySelectorAll('[data-book-title]')].find(
          (node) => node.getAttribute('data-book-title') === ${JSON.stringify(expectedFavoriteTitle)},
        );
        const ratingRoot = card?.querySelector('[data-testid^="book-rating-"][data-rating-value]');
        return ratingRoot?.getAttribute('data-rating-value') ?? null;
      })(),
    }))()`);

    await client.evaluate(
      `window.location.assign(${JSON.stringify(
        new URL("/add-book", targetUrl).toString(),
      )})`,
    );

    await waitFor(
      async () =>
        (await client.evaluate(
          "location.pathname === '/add-book' && Boolean(document.querySelector('[data-testid=\"add-book-search-form\"]'))",
        ))
          ? true
          : null,
      "Add Book page render",
      20_000,
      500,
    );

    let addBookSelection = null;
    let resolvedAddBookQuery = null;

    for (const candidateQuery of addBookQueries) {
      await setElementValue(client, '[data-testid="add-book-title-input"]', candidateQuery);
      await clickSelector(
        client,
        '[data-testid="add-book-search-submit"]',
        "Add Book search submit",
      );

      try {
        addBookSelection = await waitFor(
          async () => {
            const selection = await client.evaluate(`(() => {
              const results = [...document.querySelectorAll('[data-testid="add-book-search-result"]')];
              const preferred = results.find((node) =>
                (node.getAttribute('data-book-title') || '').toLowerCase().includes(
                  ${JSON.stringify(candidateQuery.toLowerCase())},
                ),
              ) ?? results[0];

              if (!(preferred instanceof HTMLElement)) {
                return null;
              }

              return {
                title: preferred.getAttribute('data-book-title'),
                author: preferred.getAttribute('data-book-author'),
              };
            })()`);

            return selection?.title ? selection : null;
          },
          `Add Book search results for ${candidateQuery}`,
          8_000,
          500,
        );
        resolvedAddBookQuery = candidateQuery;
        break;
      } catch {
        await waitFor(
          async () =>
            (await client.evaluate(
              "location.pathname === '/add-book' && Boolean(document.querySelector('[data-testid=\"add-book-search-form\"]'))",
            ))
              ? true
              : null,
          "Add Book search form reset after empty result",
          5_000,
          250,
        );
      }
    }

    if (!addBookSelection || !resolvedAddBookQuery) {
      throw new Error(
        `Unable to find an Add Book suggestion for any configured query: ${addBookQueries.join(", ")}`,
      );
    }

    await client.evaluate(`(() => {
      const results = [...document.querySelectorAll('[data-testid="add-book-search-result"]')];
      const preferred = results.find(
        (node) =>
          node.getAttribute('data-book-title') === ${JSON.stringify(addBookSelection.title)} &&
          node.getAttribute('data-book-author') === ${JSON.stringify(addBookSelection.author)},
      );

      if (!(preferred instanceof HTMLElement)) {
        throw new Error('Missing selected Add Book result card.');
      }

      const button = preferred.querySelector('[data-testid="add-book-select-result"]');

      if (!(button instanceof HTMLElement)) {
        throw new Error('Missing Add Book result select button.');
      }

      button.click();
      return true;
    })()`);

    await waitFor(
      async () =>
        (await client.evaluate(`(() => {
          const detailsCard = document.querySelector('[data-testid="add-book-details-card"]');

          return Boolean(detailsCard) &&
            (detailsCard.textContent || '').includes(${JSON.stringify(addBookSelection.title)});
        })()`))
          ? true
          : null,
      "Add Book details render",
      20_000,
      500,
    );

    const finalSnapshot = await client.evaluate(`(() => ({
      title: document.title,
      url: location.href,
      path: location.pathname,
      signedInUserVisible: document.body?.innerText?.includes(${JSON.stringify(expectedUserName)}) ?? false,
      addBookDetailsVisible: Boolean(document.querySelector('[data-testid="add-book-details-card"]')),
      addBookQueryUsed: ${JSON.stringify(resolvedAddBookQuery)},
      addBookSelection: {
        title: ${JSON.stringify(addBookSelection.title)},
        author: ${JSON.stringify(addBookSelection.author)},
      },
      excerpt: (document.body?.innerText || '').slice(0, 1400)
    }))()`);

    console.log(
      JSON.stringify(
        {
          targetUrl,
          autoModerator,
          commentText,
          reviewText,
          targetRating,
          addBookQueries,
          initialSnapshot,
          fillSnapshot,
          preparedModerationSubmission,
          moderationSnapshot,
          moderationDecisionSnapshot,
          preparedCommunityProbe,
          commentPaginationSnapshot,
          ratingUpdate,
          duplicateReviewSnapshot,
          communitySnapshot,
          finalSnapshot,
        },
        null,
        2,
      ),
    );

    webSocket.close();
  } catch (error) {
    primaryError = error;
  } finally {
    cleanup();

    if (moderatorGranted) {
      try {
        await runModeratorLifecycle("revoke");
      } catch (error) {
        moderatorRestoreError =
          error instanceof Error ? error : new Error(String(error));
      }
    }
  }

  if (primaryError && moderatorRestoreError) {
    throw new Error(
      `${primaryError instanceof Error ? primaryError.message : String(primaryError)}\n\n${
        moderatorRestoreError.message
      }`,
    );
  }

  if (primaryError) {
    throw primaryError;
  }

  if (moderatorRestoreError) {
    throw moderatorRestoreError;
  }
}

main().catch((error) => {
  console.error("Local frontend smoke test failed:", error);
  process.exitCode = 1;
});
