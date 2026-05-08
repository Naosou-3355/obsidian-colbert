import { spawn } from "child_process";

export interface RunOptions {
	scriptPath: string;
	cwd: string;
	claudeBin: string;
	bootstrapPath: string;
	skills?: string;
}

export async function runCommittee(
	opts: RunOptions,
	onLog: (line: string) => void
): Promise<{ code: number }> {
	const args = [
		opts.scriptPath,
		"--bootstrap",
		opts.bootstrapPath,
		"--force-full",
		"--yes",
	];
	if (opts.skills) args.push("--skills", opts.skills);

	const extraPath = opts.claudeBin
		? `${opts.claudeBin.replace(/\/[^/]+$/, "")}:`
		: "/usr/local/bin:/opt/homebrew/bin:";

	const env = {
		...process.env,
		PATH: `${extraPath}${process.env.PATH ?? ""}`,
	};

	return new Promise((resolve, reject) => {
		const proc = spawn("bash", args, { cwd: opts.cwd, env });

		const handle = (buf: Buffer) => {
			buf
				.toString()
				.split("\n")
				.forEach((l) => {
					if (l.length) onLog(l);
				});
		};
		proc.stdout.on("data", handle);
		proc.stderr.on("data", handle);

		proc.on("error", (err) => reject(err));
		proc.on("close", (code) => {
			if (code === 0) resolve({ code });
			else reject(new Error(`committee.sh exit ${code}`));
		});
	});
}
