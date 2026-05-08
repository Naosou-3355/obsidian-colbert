import { ItemView, WorkspaceLeaf, Notice, TFile, TFolder, FileSystemAdapter } from "obsidian";
import type ComitePlugin from "./main";
import { runCommittee } from "./Runner";

export const COMITE_VIEW_TYPE = "comite-patrimonial-view";

export class ComiteView extends ItemView {
	private bootstrapSelectEl!: HTMLSelectElement;
	private skillsInputEl!: HTMLInputElement;
	private logsEl!: HTMLPreElement;
	private btnEl!: HTMLButtonElement;
	private bootstraps: TFile[] = [];
	private running = false;

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

		this.btnEl = root.createEl("button", {
			text: "Lancer comité",
			cls: "mod-cta colbert-launch",
		});
		this.btnEl.onclick = () => this.launch();

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

		this.running = true;
		this.btnEl.disabled = true;
		this.btnEl.textContent = "Comité en cours…";
		this.logsEl.textContent = "";

		new Notice("Comité lancé. Suivre les logs dans la sidebar.");

		try {
			await runCommittee(
				{
					scriptPath,
					cwd,
					claudeBin,
					bootstrapPath: absoluteBootstrap,
					skills: this.skillsInputEl.value.trim() || undefined,
				},
				(line) => this.appendLog(line)
			);
			new Notice("Comité terminé. (Ouverture du Final Report : étape 6.)");
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			new Notice(`Échec : ${msg}`);
			this.appendLog(`\n[ERROR] ${msg}`);
		} finally {
			this.running = false;
			this.btnEl.disabled = false;
			this.btnEl.textContent = "Lancer comité";
		}
	}

	private appendLog(line: string) {
		const max = 2000;
		this.logsEl.textContent = (this.logsEl.textContent ?? "") + line + "\n";
		const lines = this.logsEl.textContent.split("\n");
		if (lines.length > max) {
			this.logsEl.textContent = lines.slice(lines.length - max).join("\n");
		}
		this.logsEl.scrollTop = this.logsEl.scrollHeight;
	}

	async onClose() {}
}
