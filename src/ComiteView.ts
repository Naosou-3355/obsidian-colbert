import { ItemView, WorkspaceLeaf, Notice, TFile, TFolder, FileSystemAdapter } from "obsidian";
import { promises as fsp } from "fs";
import { join } from "path";
import type ComitePlugin from "./main";
import { startCommittee, RunHandle } from "./Runner";

export const COMITE_VIEW_TYPE = "comite-patrimonial-view";

export class ComiteView extends ItemView {
	private bootstrapSelectEl!: HTMLSelectElement;
	private skillsInputEl!: HTMLInputElement;
	private logsEl!: HTMLPreElement;
	private launchBtnEl!: HTMLButtonElement;
	private stopBtnEl!: HTMLButtonElement;
	private downloadBtnEl!: HTMLButtonElement;
	private bootstraps: TFile[] = [];
	private running = false;
	private currentHandle: RunHandle | null = null;
	private fullLogBuffer: string[] = [];
	private lastRun: {
		startIso: string;
		endIso: string;
		durationSec: number;
		bootstrapPath: string;
		skills: string;
		scriptPath: string;
		claudeBin: string;
		exitCode: number | null;
		signal: NodeJS.Signals | null;
		errorMessage?: string;
		artifacts: { kind: string; path: string }[];
	} | null = null;

	isRunning(): boolean {
		return this.running;
	}

	constructor(leaf: WorkspaceLeaf, private plugin: ComitePlugin) {
		super(leaf);
	}

	getViewType() {
		return COMITE_VIEW_TYPE;
	}

	getDisplayText() {
		return "Colbert";
	}

	getIcon() {
		return "scale";
	}

	async onOpen() {
		const root = this.containerEl.children[1] as HTMLElement;
		root.empty();
		root.addClass("colbert-view");

		root.createEl("h3", { text: "Lancer un comité" });

		const bootstrapRow = root.createDiv({ cls: "colbert-row" });
		bootstrapRow.createEl("label", { text: "Bootstrap :", cls: "colbert-label" });
		this.bootstrapSelectEl = bootstrapRow.createEl("select", { cls: "colbert-select" });
		const refreshBtn = bootstrapRow.createEl("button", {
			text: "↻",
			cls: "colbert-refresh",
			attr: { title: "Re-scanner le dossier des bootstraps" },
		});
		refreshBtn.onclick = () => this.refreshBootstraps();

		root.createEl("label", {
			text: "Skills override (CSV, vide = auto) :",
			cls: "colbert-label",
		});
		this.skillsInputEl = root.createEl("input", {
			type: "text",
			cls: "colbert-input",
			attr: { placeholder: "ex: avocat-fiscaliste,notaire" },
		});

		const btnRow = root.createDiv({ cls: "colbert-btn-row" });
		this.launchBtnEl = btnRow.createEl("button", {
			text: "Lancer comité",
			cls: "mod-cta colbert-launch",
		});
		this.launchBtnEl.onclick = () => this.launch();

		this.stopBtnEl = btnRow.createEl("button", {
			text: "Stopper",
			cls: "mod-warning colbert-stop",
		});
		this.stopBtnEl.style.display = "none";
		this.stopBtnEl.onclick = () => this.stop();

		this.downloadBtnEl = root.createEl("button", {
			text: "⬇ Télécharger logs du dernier run",
			cls: "colbert-download",
		});
		this.downloadBtnEl.style.display = "none";
		this.downloadBtnEl.onclick = () => this.downloadLastRun();

		this.logsEl = root.createEl("pre", { cls: "colbert-logs" });
		this.logsEl.textContent = "(logs à venir)";

		this.refreshBootstraps();
	}

	private refreshBootstraps() {
		const dir = this.plugin.settings.committeesDir;
		this.bootstrapSelectEl.empty();

		if (!dir) {
			const opt = this.bootstrapSelectEl.createEl("option", {
				text: "Configurer 'Dossier des bootstraps' dans les settings",
			});
			opt.disabled = true;
			this.bootstraps = [];
			return;
		}

		const folder = this.app.vault.getFolderByPath(dir);
		if (!folder || !(folder instanceof TFolder)) {
			const opt = this.bootstrapSelectEl.createEl("option", {
				text: `Dossier introuvable : ${dir}`,
			});
			opt.disabled = true;
			this.bootstraps = [];
			return;
		}

		this.bootstraps = folder.children
			.filter((f): f is TFile => f instanceof TFile)
			.filter((f) => /^committee-bootstrap-.*\.md$/.test(f.name))
			.sort((a, b) => b.stat.mtime - a.stat.mtime);

		if (this.bootstraps.length === 0) {
			const opt = this.bootstrapSelectEl.createEl("option", {
				text: "(aucun committee-bootstrap-*.md dans ce dossier)",
			});
			opt.disabled = true;
			return;
		}

		for (const b of this.bootstraps) {
			const date = new Date(b.stat.mtime).toISOString().slice(0, 10);
			this.bootstrapSelectEl.createEl("option", {
				text: `${b.basename} — ${date}`,
				value: b.path,
			});
		}
	}

	private async launch() {
		if (this.running) return;

		const bootstrapPath = this.bootstrapSelectEl.value;
		if (!bootstrapPath || this.bootstraps.length === 0) {
			new Notice("Aucun bootstrap sélectionné.");
			return;
		}

		const { scriptPath, claudeBin } = this.plugin.settings;
		if (!scriptPath) {
			new Notice("Configurer 'Chemin de committee.sh' dans les settings.");
			return;
		}

		const adapter = this.app.vault.adapter;
		if (!(adapter instanceof FileSystemAdapter)) {
			new Notice("Plugin desktop uniquement (FileSystemAdapter requis).");
			return;
		}
		const cwd = adapter.getBasePath();
		const absoluteBootstrap = `${cwd}/${bootstrapPath}`;

		const runStart = Date.now();
		const skills = this.skillsInputEl.value.trim() || "";
		this.running = true;
		this.launchBtnEl.disabled = true;
		this.launchBtnEl.textContent = "Comité en cours…";
		this.stopBtnEl.style.display = "";
		this.downloadBtnEl.style.display = "none";
		this.logsEl.textContent = "";
		this.fullLogBuffer = [];

		new Notice("Comité lancé. Suivre les logs dans la sidebar.");

		let exitCode: number | null = null;
		let signal: NodeJS.Signals | null = null;
		let errorMessage: string | undefined;

		try {
			this.currentHandle = startCommittee(
				{
					scriptPath,
					cwd,
					claudeBin,
					bootstrapPath: absoluteBootstrap,
					skills: skills || undefined,
				},
				(line) => this.appendLog(line)
			);

			const result = await this.currentHandle.wait;
			exitCode = result.code;
			signal = result.signal;

			if (result.signal) {
				this.appendLog(`\n[STOPPED] Run interrompu (${result.signal}).`);
				new Notice("Run interrompu.");
			} else if (result.code === 0) {
				new Notice("Comité terminé. (Ouverture du Final Report : étape 6.)");
			} else {
				this.appendLog(`\n[ERROR] committee.sh exit ${result.code}`);
				new Notice(`Échec : exit ${result.code}`);
			}
		} catch (err: unknown) {
			errorMessage = err instanceof Error ? err.message : String(err);
			new Notice(`Échec : ${errorMessage}`);
			this.appendLog(`\n[ERROR] ${errorMessage}`);
		}

		const artifacts = await this.reportArtifacts(cwd, runStart);
		const runEnd = Date.now();

		this.lastRun = {
			startIso: new Date(runStart).toISOString(),
			endIso: new Date(runEnd).toISOString(),
			durationSec: Math.round((runEnd - runStart) / 1000),
			bootstrapPath: absoluteBootstrap,
			skills,
			scriptPath,
			claudeBin,
			exitCode,
			signal,
			errorMessage,
			artifacts,
		};

		this.currentHandle = null;
		this.running = false;
		this.launchBtnEl.disabled = false;
		this.launchBtnEl.textContent = "Lancer comité";
		this.stopBtnEl.style.display = "none";
		this.downloadBtnEl.style.display = "";
	}

	private stop() {
		if (!this.running || !this.currentHandle) return;
		this.appendLog("\n[STOPPING] Envoi de SIGTERM (puis SIGKILL après 3 s)…");
		this.stopBtnEl.disabled = true;
		this.currentHandle.kill();
		setTimeout(() => {
			this.stopBtnEl.disabled = false;
		}, 3500);
	}

	private async reportArtifacts(
		vaultRoot: string,
		runStart: number
	): Promise<{ kind: string; path: string }[]> {
		const { logsDir, finalReportsDir } = this.plugin.settings;
		const found: { kind: string; path: string }[] = [];

		if (finalReportsDir) {
			const items = await scanFsDir(join(vaultRoot, finalReportsDir), runStart);
			items.forEach((p) => found.push({ kind: "Final Report", path: p }));
		}

		if (logsDir) {
			const logRoot = join(vaultRoot, logsDir);
			const logFiles = await scanFsDir(logRoot, runStart, { filesOnly: true });
			logFiles.forEach((p) => found.push({ kind: "Log", path: p }));

			const runDirs = await scanFsDir(join(logRoot, "runs"), runStart, { dirsOnly: true });
			runDirs.forEach((p) => found.push({ kind: "Run dir", path: p }));
		}

		this.appendLog("");
		this.appendLog("=== ARTEFACTS PRODUITS DEPUIS LE LANCEMENT ===");
		if (found.length === 0) {
			this.appendLog("(aucun artefact détecté)");
			return found;
		}
		for (const a of found) {
			this.appendLog(`  • [${a.kind}] ${a.path}`);
		}
		this.appendLog("(supprimer manuellement si non désirés)");
		return found;
	}

	private appendLog(line: string) {
		this.fullLogBuffer.push(line);

		const max = 2000;
		this.logsEl.textContent = (this.logsEl.textContent ?? "") + line + "\n";
		const lines = this.logsEl.textContent.split("\n");
		if (lines.length > max) {
			this.logsEl.textContent = lines.slice(lines.length - max).join("\n");
		}
		this.logsEl.scrollTop = this.logsEl.scrollHeight;
	}

	private async downloadLastRun() {
		if (!this.lastRun) {
			new Notice("Aucun run à télécharger.");
			return;
		}
		const r = this.lastRun;
		const adapter = this.app.vault.adapter;
		const vaultLogContent = await readFileSafe(findVaultLogPath(r.artifacts));

		let status: string;
		if (r.signal) status = `INTERRUPTED (${r.signal})`;
		else if (r.errorMessage) status = `EXCEPTION (${r.errorMessage})`;
		else if (r.exitCode === 0) status = "SUCCESS";
		else status = `FAILED (exit ${r.exitCode})`;

		const artifactsBlock = r.artifacts.length
			? r.artifacts.map((a) => `  - [${a.kind}] ${a.path}`).join("\n")
			: "  (none)";

		const report = [
			"========================================================================",
			"  COLBERT — Run Report",
			"========================================================================",
			"",
			"## Metadata",
			`  Run start    : ${r.startIso}`,
			`  Run end      : ${r.endIso}`,
			`  Duration     : ${r.durationSec}s`,
			`  Status       : ${status}`,
			`  Exit code    : ${r.exitCode}`,
			`  Signal       : ${r.signal ?? "-"}`,
			r.errorMessage ? `  Error        : ${r.errorMessage}` : "",
			"",
			"## Inputs",
			`  Bootstrap    : ${r.bootstrapPath}`,
			`  Skills override : ${r.skills || "(auto)"}`,
			`  Script path  : ${r.scriptPath}`,
			`  Claude bin   : ${r.claudeBin || "(auto from PATH)"}`,
			`  Vault root   : ${adapter instanceof FileSystemAdapter ? adapter.getBasePath() : "(unknown)"}`,
			"",
			"## Artifacts",
			artifactsBlock,
			"",
			"## Streamed stdout/stderr (full, not truncated)",
			"------------------------------------------------------------------------",
			this.fullLogBuffer.join("\n"),
			"------------------------------------------------------------------------",
			"",
			"## Vault log file content (if found)",
			"------------------------------------------------------------------------",
			vaultLogContent,
			"------------------------------------------------------------------------",
			"",
		]
			.filter((l) => l !== "")
			.join("\n");

		const slug = r.bootstrapPath.split("/").pop()?.replace(/\.md$/, "") ?? "run";
		const ts = r.startIso.replace(/[:.]/g, "-");
		const filename = `colbert-run-${ts}-${slug}.txt`;

		const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		setTimeout(() => URL.revokeObjectURL(url), 1000);

		new Notice(`Téléchargement : ${filename}`);
	}

	async onClose() {
		if (this.currentHandle) {
			this.currentHandle.kill();
		}
	}
}

interface ScanOpts {
	filesOnly?: boolean;
	dirsOnly?: boolean;
}

function findVaultLogPath(artifacts: { kind: string; path: string }[]): string | null {
	const log = artifacts.find((a) => a.kind === "Log" && a.path.endsWith(".log"));
	return log ? log.path : null;
}

async function readFileSafe(path: string | null): Promise<string> {
	if (!path) return "(no vault log file detected for this run)";
	try {
		return await fsp.readFile(path, "utf8");
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return `(could not read ${path}: ${msg})`;
	}
}

async function scanFsDir(absDir: string, sinceMs: number, opts: ScanOpts = {}): Promise<string[]> {
	try {
		const entries = await fsp.readdir(absDir, { withFileTypes: true });
		const results: string[] = [];
		for (const e of entries) {
			const full = join(absDir, e.name);
			let stat;
			try {
				stat = await fsp.stat(full);
			} catch {
				continue;
			}
			if (stat.mtimeMs < sinceMs) continue;
			if (opts.filesOnly && !e.isFile()) continue;
			if (opts.dirsOnly && !e.isDirectory()) continue;
			results.push(e.isDirectory() ? full + "/" : full);
		}
		return results.sort();
	} catch {
		return [];
	}
}
