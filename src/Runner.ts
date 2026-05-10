import { spawn } from "child_process";
import { existsSync } from "fs";

export interface RunOptions {
	scriptPath: string;
	cwd: string;
	claudeBin: string;
	bootstrapPath: string;
	skills?: string;
}

export interface RunResult {
	code: number | null;
	signal: NodeJS.Signals | null;
}

export interface RunHandle {
	wait: Promise<RunResult>;
	kill: () => void;
}

export function startCommittee(
	opts: RunOptions,
	onLog: (line: string) => void
): RunHandle {
	// Use source instead of exec so that SKILLS_ARRAY declared here is visible
	// inside committee.sh's update_status() calls (which run before line 620).
	// committee.sh is unchanged; the array is filled at line 620 as usual.
	const scriptArgs = [
		"--bootstrap", opts.bootstrapPath,
		"--force-full",
		"--yes",
	];
	if (opts.skills) scriptArgs.push("--skills", opts.skills);

	const args = [
		"-c", 'declare -a SKILLS_ARRAY=(); source "$@"',
		"--", opts.scriptPath,
		...scriptArgs,
	];

	// committee.sh requires bash 4+ (declare -A, etc.). macOS /bin/bash is 3.2,
	// so we always prepend Homebrew paths and prefer /opt/homebrew/bin/bash.
	const claudeDir = opts.claudeBin ? opts.claudeBin.replace(/\/[^/]+$/, "") : "";
	const pathPrefix = [claudeDir, "/opt/homebrew/bin", "/usr/local/bin"]
		.filter(Boolean)
		.join(":");

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { ANTHROPIC_API_KEY: _omit, ...inheritedEnv } = process.env;
	const env = {
		...inheritedEnv,
		PATH: `${pathPrefix}:${process.env.PATH ?? ""}`,
		TERM: process.env.TERM ?? "dumb",
	};

	// detached: true → bash devient leader d'un nouveau process group.
	// Permet de tuer toute la descendance via process.kill(-pgid, signal).
	const bashBin = existsSync("/opt/homebrew/bin/bash") ? "/opt/homebrew/bin/bash" : "bash";
	const proc = spawn(bashBin, args, { cwd: opts.cwd, env, detached: true });

	const handle = (buf: Buffer) => {
		buf
			.toString()
			.split("\n")
			.forEach((l) => {
				if (l.length) onLog(l);
			});
	};
	proc.stdout?.on("data", handle);
	proc.stderr?.on("data", handle);

	const wait = new Promise<RunResult>((resolve, reject) => {
		proc.on("error", (err) => reject(err));
		proc.on("close", (code, signal) => resolve({ code, signal }));
	});

	let killTimer: NodeJS.Timeout | null = null;

	const kill = () => {
		if (!proc.pid) return;
		try {
			process.kill(-proc.pid, "SIGTERM");
		} catch {
			try {
				proc.kill("SIGTERM");
			} catch {
				// process déjà mort
			}
		}
		if (killTimer) return;
		killTimer = setTimeout(() => {
			try {
				process.kill(-proc.pid!, "SIGKILL");
			} catch {
				// déjà mort
			}
		}, 3000);
	};

	wait.finally(() => {
		if (killTimer) clearTimeout(killTimer);
	});

	return { wait, kill };
}
