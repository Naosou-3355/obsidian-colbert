import { Plugin, WorkspaceLeaf } from "obsidian";
import { ComiteView, COMITE_VIEW_TYPE } from "./ComiteView";
import { ComiteSettingTab, DEFAULT_SETTINGS, ComiteSettings } from "./settings";

export default class ComitePlugin extends Plugin {
	settings: ComiteSettings;

	async onload() {
		await this.loadSettings();

		this.registerView(
			COMITE_VIEW_TYPE,
			(leaf: WorkspaceLeaf) => new ComiteView(leaf, this)
		);

		this.addRibbonIcon("scale", "Colbert", () => this.activateView());

		this.addCommand({
			id: "open-comite-view",
			name: "Ouvrir le panneau Colbert",
			callback: () => this.activateView(),
		});

		this.addSettingTab(new ComiteSettingTab(this.app, this));
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(COMITE_VIEW_TYPE);
	}

	async activateView() {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(COMITE_VIEW_TYPE)[0];
		if (!leaf) {
			const right = workspace.getRightLeaf(false);
			if (!right) return;
			leaf = right;
			await leaf.setViewState({ type: COMITE_VIEW_TYPE, active: true });
		}
		workspace.revealLeaf(leaf);
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
