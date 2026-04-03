import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const awsBin = process.env.AWS_BIN ?? "/opt/homebrew/bin/aws";
const runtimePath = [
  dirname(awsBin),
  "/usr/local/bin",
  "/opt/homebrew/bin",
  process.env.PATH ?? "",
]
  .filter(Boolean)
  .join(":");

const envName = process.env.LIGHTNING_ENV ?? "local";
const region = process.env.AWS_REGION ?? "eu-west-2";
const stackName = process.env.LIGHTNING_CDK_STACK_NAME ?? "LightningLocalStack";
const expectedCatalogModeratorGroupName =
  `lightning-catalog-moderators-${envName}`;

function parseArgs(argv) {
  const positional = [];
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      options[key] = "true";
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return {
    action: positional[0] ?? "status",
    options,
  };
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        ...(options.env ?? {}),
        PATH: runtimePath,
      },
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

async function runAws(args) {
  const result = await run(awsBin, args);
  return result.stdout ? JSON.parse(result.stdout) : {};
}

async function describeStack() {
  try {
    const response = await runAws([
      "cloudformation",
      "describe-stacks",
      "--region",
      region,
      "--stack-name",
      stackName,
    ]);

    return response.Stacks?.[0] ?? null;
  } catch (error) {
    if (error instanceof Error && error.message.includes("does not exist")) {
      return null;
    }

    throw error;
  }
}

function outputsToMap(outputs) {
  return Object.fromEntries(
    (outputs ?? [])
      .filter((entry) => entry.OutputKey && entry.OutputValue)
      .map((entry) => [entry.OutputKey, entry.OutputValue]),
  );
}

async function resolveModeratorResources(options) {
  const stack = await describeStack();
  const outputMap = outputsToMap(stack?.Outputs);

  const userPoolId =
    options["user-pool-id"] ??
    process.env.COGNITO_USER_POOL_ID ??
    process.env.VITE_COGNITO_USER_POOL_ID ??
    outputMap.UserPoolId ??
    null;
  const groupName =
    options["group-name"] ??
    process.env.CATALOG_MODERATOR_GROUP_NAME ??
    process.env.VITE_CATALOG_MODERATOR_GROUP_NAME ??
    outputMap.CatalogModeratorGroupName ??
    expectedCatalogModeratorGroupName;

  if (!userPoolId) {
    throw new Error(
      "Unable to resolve a Cognito user pool ID. Ensure LightningLocalStack exists or pass --user-pool-id.",
    );
  }

  return {
    userPoolId,
    groupName,
    source: stack ? "cdk-stack" : "env",
  };
}

function getUserAttribute(user, name) {
  return (user.Attributes ?? []).find((attribute) => attribute.Name === name)?.Value ?? null;
}

async function resolveUsername(userPoolId, options) {
  const explicitUsername = options.username ?? process.env.LIGHTNING_SMOKE_COGNITO_USERNAME;

  if (explicitUsername) {
    return {
      username: explicitUsername,
      resolution: "explicit-username",
      email: null,
    };
  }

  const identifier =
    options.identifier ??
    process.env.LIGHTNING_MODERATOR_IDENTIFIER ??
    process.env.LIGHTNING_SMOKE_IDENTIFIER;

  if (!identifier) {
    throw new Error(
      "Provide --identifier, --username, LIGHTNING_MODERATOR_IDENTIFIER, or LIGHTNING_SMOKE_IDENTIFIER.",
    );
  }

  if (!identifier.includes("@")) {
    return {
      username: identifier,
      resolution: "identifier-username",
      email: null,
    };
  }

  const response = await runAws([
    "cognito-idp",
    "list-users",
    "--region",
    region,
    "--user-pool-id",
    userPoolId,
    "--filter",
    `email = "${identifier}"`,
    "--limit",
    "2",
  ]);

  const users = Array.isArray(response.Users) ? response.Users : [];

  if (users.length === 0) {
    throw new Error(`No Cognito user found for email ${identifier}.`);
  }

  const exactMatch =
    users.find((user) => getUserAttribute(user, "email") === identifier) ?? users[0];

  return {
    username: exactMatch.Username,
    resolution: "email-lookup",
    email: getUserAttribute(exactMatch, "email"),
  };
}

async function listGroupsForUser(userPoolId, username) {
  const response = await runAws([
    "cognito-idp",
    "admin-list-groups-for-user",
    "--region",
    region,
    "--user-pool-id",
    userPoolId,
    "--username",
    username,
  ]);

  return (response.Groups ?? [])
    .map((group) => group.GroupName)
    .filter((groupName) => typeof groupName === "string" && groupName.trim());
}

async function mutateGroupMembership(action, resources, username) {
  const groupsBefore = await listGroupsForUser(resources.userPoolId, username);
  const alreadyMember = groupsBefore.includes(resources.groupName);

  if (action === "grant" && !alreadyMember) {
    await run(
      awsBin,
      [
        "cognito-idp",
        "admin-add-user-to-group",
        "--region",
        region,
        "--user-pool-id",
        resources.userPoolId,
        "--username",
        username,
        "--group-name",
        resources.groupName,
      ],
    );
  }

  if (action === "revoke" && alreadyMember) {
    await run(
      awsBin,
      [
        "cognito-idp",
        "admin-remove-user-from-group",
        "--region",
        region,
        "--user-pool-id",
        resources.userPoolId,
        "--username",
        username,
        "--group-name",
        resources.groupName,
      ],
    );
  }

  const groupsAfter = await listGroupsForUser(resources.userPoolId, username);

  return {
    changed:
      action === "grant"
        ? !alreadyMember
        : action === "revoke"
          ? alreadyMember
          : false,
    groupsBefore,
    groupsAfter,
  };
}

async function main() {
  const { action, options } = parseArgs(process.argv.slice(2));

  if (!["status", "grant", "revoke"].includes(action)) {
    throw new Error(`Unsupported action "${action}". Use status, grant, or revoke.`);
  }

  const resources = await resolveModeratorResources(options);
  const user = await resolveUsername(resources.userPoolId, options);

  const mutation =
    action === "status"
      ? {
          changed: false,
          groupsBefore: await listGroupsForUser(resources.userPoolId, user.username),
          groupsAfter: null,
        }
      : await mutateGroupMembership(action, resources, user.username);

  const groups = mutation.groupsAfter ?? mutation.groupsBefore;

  console.log(
    JSON.stringify(
      {
        action,
        envName,
        region,
        stackName,
        userPoolId: resources.userPoolId,
        moderatorGroupName: resources.groupName,
        resourceResolutionSource: resources.source,
        username: user.username,
        userResolution: user.resolution,
        email: user.email,
        changed: mutation.changed,
        groupsBefore: mutation.groupsBefore,
        groups,
        isModerator: groups.includes(resources.groupName),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("Local moderator management failed:", error);
  process.exitCode = 1;
});
