import { Modal, Plugin, WorkspaceLeaf } from "obsidian";
import { ComiteView, COMITE_VIEW_TYPE } from "./ComiteView";
import { ComiteSettingTab, DEFAULT_SETTINGS, ComiteSettings } from "./settings";

class CloseConfirmModal extends Modal {
	private onConfirm: () => void;

	constructor(app: import("obsidian").App, onConfirm: () => void) {
		super(app);
		this.onConfirm = onConfirm;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("p", { text: "Un run est en cours. Stopper et fermer le panneau ?" });
		const btnRow = contentEl.createDiv({ cls: "modal-button-container" });

		const cancelBtn = btnRow.createEl("button", { text: "Annuler" });
		cancelBtn.onclick = () => this.close();

		const confirmBtn = btnRow.createEl("button", { text: "Stopper et fermer", cls: "mod-warning" });
		confirmBtn.onclick = () => {
			this.close();
			this.onConfirm();
		};
	}

	onClose() {
		this.contentEl.empty();
	}
}

export default class ComitePlugin extends Plugin {
	settings: ComiteSettings;

	async onload() {
		await this.loadSettings();

		this.registerView(
			COMITE_VIEW_TYPE,
			(leaf: WorkspaceLeaf) => new ComiteView(leaf, this)
		);

		this.addRibbonIcon("scale", "Colbert", () => this.toggleView());

		this.addCommand({
			id: "open-comite-view",
			name: "Ouvrir le panneau Colbert",
			callback: () => this.toggleView(),
		});

		this.addSettingTab(new ComiteSettingTab(this.app, this));
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(COMITE_VIEW_TYPE);
	}

	private async closeView() {
		this.app.workspace.detachLeavesOfType(COMITE_VIEW_TYPE);
	}

	async toggleView() {
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(COMITE_VIEW_TYPE)[0];

		if (existing) {
			const view = existing.view;
			if (view instanceof ComiteView && view.isRunning()) {
				new CloseConfirmModal(this.app, () => this.closeView()).open();
			} else {
				await this.closeView();
			}
			return;
		}

		const right = workspace.getRightLeaf(false);
		if (!right) return;
		await right.setViewState({ type: COMITE_VIEW_TYPE, active: true });
		workspace.revealLeaf(right);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<ComiteSettings>
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
